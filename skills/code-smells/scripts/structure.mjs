#!/usr/bin/env node
// Collect evidence only: no smell thresholds, ranking, or presentation limits.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { open, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire, isBuiltin } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';

const packages = ['madge', 'precinct', '@dagrejs/graphlib', 'node-source-walk', 'filing-cabinet', 'fast-xml-parser', 'iconv-lite'];
const graphExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
// PMD 7.28 language registration metadata, not guesses from a mixed manifest.
// Ambiguous extensions require an explicit choice; JSX/TSX are not JS/TS CPD grammars.
const cpdExtensions = {
  apex: ['cls', 'trigger'], coco: ['coco'], cpp: ['h', 'hpp', 'hxx', 'c', 'cpp', 'cxx', 'cc', 'C'],
  cs: ['cs'], css: ['css'], dart: ['dart'], ecmascript: ['js'],
  fortran: ['for', 'f', 'f66', 'f77', 'f90'], gherkin: ['feature'], go: ['go'],
  groovy: ['groovy'], html: ['html', 'htm', 'xhtml', 'xht', 'shtml'], java: ['java'],
  jsp: ['jsp', 'jspx', 'jspf', 'tag'], julia: ['jl'], kotlin: ['kt', 'ktm'], lua: ['lua'],
  matlab: ['m'], modelica: ['mo'], objectivec: ['h', 'm'], perl: ['pm', 'pl', 't'],
  php: ['php', 'class'], plsql: ['sql', 'trg', 'prc', 'fnc', 'pld', 'pls', 'plh', 'plb', 'pck', 'pks', 'pkh', 'pkb', 'typ', 'tyb', 'tps', 'tpb'],
  pom: ['pom'], python: ['py'], ruby: ['rb', 'cgi', 'class'], rust: ['rs'], scala: ['scala'],
  swift: ['swift'], tsql: ['sql'], typescript: ['ts'], velocity: ['vm'],
  visualforce: ['page', 'component'], wsdl: ['wsdl'], xml: ['xml'], xsl: ['xsl', 'xslt'],
};
const aliases = { mjs: 'js', cjs: 'js', mts: 'ts', cts: 'ts' };
const posix = value => value.split(path.sep).join('/');
const within = (child, parent) => child === parent || child.startsWith(`${parent}${path.sep}`);
const sha256 = data => createHash('sha256').update(data).digest('hex');
const json = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];

// Stream subprocess output to disk, without exec's buffer limit or an invented timeout.
async function run(command, args, directory, prefix) {
  const stdout = await open(`${prefix}.stdout.log`, 'wx');
  const stderr = await open(`${prefix}.stderr.log`, 'wx');
  try {
    return await new Promise(resolve => {
      const child = spawn(command, args, { cwd: directory, stdio: ['ignore', stdout.fd, stderr.fd] });
      child.on('error', error => resolve({ command, args, error: error.message }));
      child.on('close', (exitCode, signal) => resolve({ command, args, exitCode, signal }));
    });
  } finally {
    await stdout.close();
    await stderr.close();
  }
}

async function loadTools(directory, output, root) {
  let require = createRequire(path.join(directory, 'package.json'));
  try { for (const name of packages) require.resolve(name); }
  catch {
    if (within(directory, root)) throw new Error('Install tooling outside the source root (or supply an already installed --tools-dir)');
    await mkdir(directory, { recursive: true });
    const install = await run('npm', ['install', '--prefix', directory, '--ignore-scripts', '--no-audit', '--no-fund', ...packages], output, path.join(output, 'npm-install'));
    if (install.exitCode !== 0) throw new Error(`Tool installation failed: ${JSON.stringify(install)}; see npm-install logs`);
    require = createRequire(path.join(directory, 'package.json'));
  }
  const modules = Object.fromEntries(packages.map(name => {
    const imported = require(name);
    return [name, imported.default ?? imported];
  }));
  const versions = {};
  for (const name of packages) {
    // Some packages do not export package.json. Walk up from their real entry point.
    let directory = path.dirname(require.resolve(name));
    while (true) {
      try {
        const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
        if (metadata.name === name) { versions[name] = metadata.version; break; }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error(`Cannot find version for ${name}`);
      directory = parent;
    }
  }
  return { modules, versions };
}

async function graphEvidence(files, root, tsConfig, modules) {
  const precinct = modules.precinct;
  const cabinet = modules['filing-cabinet'];
  const Walker = modules['node-source-walk'];
  const { Graph, alg } = modules['@dagrejs/graphlib'];
  const detectiveOptions = { es6: { mixedImports: true }, ts: { mixedImports: true }, tsx: { mixedImports: true } };
  const result = {
    status: 'complete', files: [], parseErrors: [], unresolvedImports: [], boundaryImports: [],
    unsupported: [], graph: {}, cyclicComponents: [],
    limitations: [
      'Static JS/TS imports only; computed imports, framework discovery, and runtime dependency injection are not exhaustive.',
      'Includes type-only and literal dynamic imports; a cyclic component is not necessarily a runtime initialization cycle.',
      'Only inventory files are traversed; boundary imports are retained separately, not silently followed into excluded source.',
      'One resolver configuration per invocation; supply the relevant --tsconfig and run additional project-native analysis for other configurations/bundler aliases.',
    ],
  };
  const eligible = files.filter(file => {
    if (file.status !== 'ready') return false;
    if (!graphExtensions.has(path.extname(file.path))) {
      result.unsupported.push({ path: file.path, reason: 'unsupported_graph_language' });
      return false;
    }
    return true;
  });
  const inputs = new Set(eligible.map(file => path.join(root, file.path)));
  const valid = [];
  for (const file of eligible) {
    const filename = path.join(root, file.path);
    try {
      if (!['utf-8', 'utf-8-sig', 'utf8'].includes(file.encoding.toLowerCase())) throw new Error('Madge/Precinct require UTF-8 source');
      // Precinct catches JS parser exceptions internally; its walker is needed to expose them.
      if (!['.ts', '.tsx'].includes(path.extname(filename))) new Walker().parse(await readFile(filename, 'utf8'));
      const imports = precinct.paperwork(filename, { ...detectiveOptions, includeCore: false });
      valid.push(filename);
      result.files.push(file.path);
      for (const specifier of imports) {
        if (isBuiltin(specifier)) continue;
        try {
          const target = cabinet({ partial: specifier, filename, directory: root, ast: precinct.ast, tsConfig });
          if (!target) result.unresolvedImports.push({ path: file.path, specifier });
          else if (!inputs.has(path.resolve(target))) result.boundaryImports.push({ path: file.path, specifier, target: posix(path.relative(root, target)) });
        } catch (error) { result.unresolvedImports.push({ path: file.path, specifier, error: error.message }); }
      }
    } catch (error) { result.parseErrors.push({ path: file.path, error: error.message }); }
  }
  if (valid.length) {
    try {
      const analysis = await modules.madge(valid, { baseDir: root, tsConfig, detectiveOptions, dependencyFilter: filename => inputs.has(path.resolve(filename)) });
      result.graph = analysis.obj();
      result.warnings = analysis.warnings();
      const graph = new Graph({ directed: true });
      for (const [from, targets] of Object.entries(result.graph)) {
        graph.setNode(from);
        for (const to of targets) graph.setEdge(from, to);
      }
      result.cyclicComponents = alg.findCycles(graph).map(members => {
        const group = new Set(members);
        return { members: members.sort(), edges: graph.edges().filter(({ v, w }) => group.has(v) && group.has(w)).map(({ v, w }) => ({ from: v, to: w })) };
      });
    } catch (error) { result.error = error.message; }
  }
  if (result.error || result.parseErrors.length || result.unresolvedImports.length || result.boundaryImports.length || result.unsupported.length || result.warnings?.skipped?.length) result.status = 'partial';
  result.coverage = { requested: eligible.length, parsed: result.files.length, parseErrors: result.parseErrors.length, unresolvedImports: result.unresolvedImports.length, boundaryImports: result.boundaryImports.length, unsupported: result.unsupported.length, nodes: Object.keys(result.graph).length, edges: Object.values(result.graph).reduce((sum, targets) => sum + targets.length, 0) };
  return result;
}

async function duplicateEvidence(files, output, modules, overrides) {
  const { XMLParser, XMLValidator } = modules['fast-xml-parser'];
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, parseTagValue: false, trimValues: false, processEntities: false });
  const result = {
    status: 'complete', groups: [], unsupported: [], suppressionMarkers: [],
    limitations: [
      'PMD maximal lexical clone groups, not every repeated substring or semantic equivalence; whitespace/comments are ignored by the language lexer.',
      'Minimum one token is the nonempty token unit. Trivial coincidences are preserved for parent-model review, not ranked as smells.',
      'Project CPD-OFF/CPD-ON and language-specific suppression constructs remain effective; marker locations are textual evidence, not proof of a parsed comment.',
      'Extension routing follows PMD 7.28 metadata; unfamiliar/ambiguous formats need an explicit language choice or a project-native analyzer.',
    ],
  };
  const version = await run('pmd', ['--version'], output, path.join(output, 'pmd-version'));
  result.tool = { ...version, version: await readFile(path.join(output, 'pmd-version.stdout.log'), 'utf8') };
  const groups = new Map();
  for (const file of files.filter(file => file.status === 'ready')) {
    const originalExtension = path.extname(file.path).slice(1);
    const extension = aliases[originalExtension] ?? originalExtension;
    const languages = Object.entries(cpdExtensions).filter(([, extensions]) => extensions.includes(extension)).map(([language]) => language);
    const language = overrides.get(originalExtension) ?? (languages.length === 1 ? languages[0] : null);
    if (!language || !languages.includes(language)) {
      result.unsupported.push({ path: file.path, reason: languages.length > 1 ? 'ambiguous_cpd_language' : 'unsupported_cpd_language', languages });
      continue;
    }
    for (const [index, line] of file.text.split(/\r\n|\n|\r/).entries()) {
      for (const marker of line.matchAll(/CPD-(?:OFF|ON)/g)) result.suppressionMarkers.push({ path: file.path, line: index + 1, marker: marker[0] });
    }
    if (!groups.has(language)) groups.set(language, []);
    groups.get(language).push({ ...file, extension });
  }
  for (const [language, inputs] of groups) {
    const directory = path.join(output, `cpd-${language}`);
    await mkdir(directory);
    // A lossless safe-name snapshot avoids PMD manifest comma/newline/trim semantics
    // and OS argv limits without splitting clone groups or changing their contents.
    const mapping = {};
    for (const [index, file] of inputs.entries()) {
      const alias = `${index}.${file.extension}`;
      await writeFile(path.join(directory, alias), file.text, { flag: 'wx' });
      mapping[alias] = { path: file.path, sha256: file.sha256, encoding: file.encoding };
    }
    await json(path.join(directory, 'paths.json'), mapping);
    await writeFile(path.join(directory, 'files.txt'), `${Object.keys(mapping).join('\n')}\n`, { flag: 'wx' });
    // PMD 7.28 --no-skip-blocks leaves C++'s default property enabled.
    // Explicitly clear the pattern so #if 0 code is still collected.
    const args = ['cpd', '--file-list', 'files.txt', '--language', language, '--minimum-tokens', '1', '--skip-blocks-pattern', '', '--no-fail-on-violation', '--format', 'xml', '--report-file', 'report.xml'];
    const command = await run('pmd', args, directory, path.join(directory, 'pmd'));
    const group = { language, status: 'complete', command, report: `cpd-${language}/report.xml`, manifest: `cpd-${language}/paths.json`, requested: inputs.map(file => file.path), files: [], duplications: [], errors: [], missing: [] };
    const originalPath = filename => mapping[path.basename(filename)]?.path ?? filename;
    try {
      const xml = await readFile(path.join(directory, 'report.xml'), 'utf8');
      const validation = XMLValidator.validate(xml);
      if (validation !== true) throw new Error(`Invalid CPD XML: ${JSON.stringify(validation)}`);
      const report = parser.parse(xml)['pmd-cpd'];
      if (!report) throw new Error('CPD report has no pmd-cpd root');
      group.pmdVersion = report.pmdVersion;
      group.files = list(report.file).map(file => ({ ...file, path: originalPath(file.path) }));
      group.duplications = list(report.duplication).map(duplication => ({ ...duplication, file: list(duplication.file).map(file => ({ ...file, path: originalPath(file.path) })) }));
      group.errors = list(report.error).map(error => ({ ...error, filename: originalPath(error.filename) }));
    } catch (error) { group.error = error.message; }
    const analyzed = new Set(group.files.map(file => file.path));
    group.missing = group.requested.filter(filename => !analyzed.has(filename));
    if (command.exitCode !== 0 || group.error || group.errors.length || group.missing.length) group.status = 'partial';
    result.groups.push(group);
  }
  if (version.exitCode !== 0 || result.unsupported.length || result.groups.some(group => group.status !== 'complete')) result.status = 'partial';
  result.coverage = { requested: files.filter(file => file.status === 'ready').length, analyzed: result.groups.reduce((sum, group) => sum + group.files.length, 0), unsupported: result.unsupported.length, errors: result.groups.reduce((sum, group) => sum + group.errors.length, 0), missing: result.groups.reduce((sum, group) => sum + group.missing.length, 0), cloneGroups: result.groups.reduce((sum, group) => sum + group.duplications.length, 0) };
  return result;
}

async function main() {
  const { values } = parseArgs({ options: {
    inventory: { type: 'string' }, output: { type: 'string' }, 'tools-dir': { type: 'string' }, tsconfig: { type: 'string' },
    'cpd-language': { type: 'string', multiple: true }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: node structure.mjs --inventory inventory.json --output NEW_REPORT_DIR [--tools-dir REUSABLE_NPM_TOOLS] [--tsconfig PATH] [--cpd-language h=cpp]\nReport directory must have an existing parent outside the source root. Exit 2 means evidence was saved with coverage gaps.');
    return;
  }
  if (!values.inventory || !values.output) throw new Error('--inventory and --output are required');
  const inventory = JSON.parse(await readFile(values.inventory, 'utf8'));
  if (!path.isAbsolute(inventory.root) || !Array.isArray(inventory.files)) throw new Error('Inventory requires an absolute root and files array');
  const root = await realpath(inventory.root);
  const output = path.join(await realpath(path.dirname(path.resolve(values.output))), path.basename(values.output));
  if (within(output, root)) throw new Error('Report directory must be outside the source root');
  const seen = new Set();
  for (const file of inventory.files) {
    if (typeof file.path !== 'string' || !file.path || file.path.split('/').some(part => !part || part === '.' || part === '..') || path.isAbsolute(file.path) || seen.has(file.path)) throw new Error(`Invalid or duplicate inventory path: ${file.path}`);
    seen.add(file.path);
  }
  const overrides = new Map();
  for (const option of values['cpd-language'] ?? []) {
    const [extension, language, extra] = option.replace(/^\./, '').split('=');
    if (extra || !cpdExtensions[language]?.includes(extension)) throw new Error(`--cpd-language needs a PMD registered extension=language pair: ${option}`);
    overrides.set(extension, language);
  }
  await mkdir(output); // Exclusive: never reuse or replace an existing report.
  const report = { schema_version: 1, root, scopes: inventory.scopes, inventory: path.resolve(values.inventory), files: [], sourceChanges: [], tools: {}, status: 'partial' };
  try {
    const toolsDirectory = path.resolve(values['tools-dir'] ?? path.join(output, 'tooling'));
    const { modules, versions } = await loadTools(toolsDirectory, output, root);
    report.tools = { directory: toolsDirectory, versions };
    const iconv = modules['iconv-lite'];
    for (const input of inventory.files) {
      const file = { path: input.path, sha256: input.sha256, inventoryStatus: input.status, encoding: input.encoding ?? 'utf-8', status: 'excluded' };
      report.files.push(file);
      if (!['analyzed', 'unsupported', 'parser_error'].includes(input.status)) continue;
      try {
        const filename = path.join(root, file.path);
        if (await realpath(filename) !== filename) throw new Error('Source path traverses a symlink');
        const descriptor = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
        let data;
        try {
          if (!(await descriptor.stat()).isFile()) throw new Error('Source is not a regular file');
          data = await descriptor.readFile();
        } finally { await descriptor.close(); }
        if (!/^[a-f0-9]{64}$/.test(file.sha256 ?? '') || sha256(data) !== file.sha256) throw new Error('Source hash differs from inventory; recollect current evidence');
        const encoding = file.encoding === 'utf-8-sig' ? 'utf-8' : file.encoding;
        if (!iconv.encodingExists(encoding)) throw new Error(`Unsupported source encoding: ${encoding}`);
        file.text = iconv.decode(data, encoding);
        file.status = 'ready';
      } catch (error) { file.status = 'input_error'; file.error = error.message; }
    }
    // Keep aliases rooted in the same physical path as the inventory (e.g. macOS /tmp).
    const tsConfig = values.tsconfig ? await realpath(values.tsconfig) : undefined;
    report.graph = await graphEvidence(report.files, root, tsConfig, modules);
    report.duplicates = await duplicateEvidence(report.files, output, modules, overrides);
    // Neither live graph parsing nor inventory collection is an atomic snapshot.
    for (const file of report.files.filter(file => file.status === 'ready')) {
      try {
        if (sha256(await readFile(path.join(root, file.path))) !== file.sha256) report.sourceChanges.push(file.path);
      } catch { report.sourceChanges.push(file.path); }
    }
    if (report.graph.status === 'complete' && report.duplicates.status === 'complete' && !report.sourceChanges.length && report.files.every(file => file.status === 'ready') && inventory.coverage?.inventory_complete !== false) report.status = 'complete';
  } catch (error) { report.error = error.message; }
  for (const file of report.files) delete file.text;
  report.coverage = { inventoryFiles: inventory.files.length, ready: report.files.filter(file => file.status === 'ready').length, excluded: report.files.filter(file => file.status === 'excluded').length, inputErrors: report.files.filter(file => file.status === 'input_error').length, sourceChanges: report.sourceChanges.length };
  await json(path.join(output, 'structure.json'), report);
  console.log(path.join(output, 'structure.json'));
  if (report.status !== 'complete') process.exitCode = 2;
}

main().catch(error => { console.error(`structure: ${error.message}`); process.exitCode = 1; });
