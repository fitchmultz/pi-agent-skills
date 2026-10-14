import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../skills/code-smells/scripts/structure.mjs', import.meta.url));
const temporary = mkdtempSync(path.join(os.tmpdir(), 'code-smells-structure-test-'));
const tools = process.env.CODE_SMELLS_TOOLS_DIR ?? path.join(temporary, 'tools');
const pmdAvailable = spawnSync('pmd', ['--version'], { stdio: 'ignore' }).status === 0;
after(() => rmSync(temporary, { recursive: true, force: true }));

function fixture(name, sources) {
  const directory = path.join(temporary, name);
  const root = path.join(directory, 'source');
  mkdirSync(root, { recursive: true });
  const files = Object.entries(sources).map(([filename, source]) => {
    mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
    writeFileSync(path.join(root, filename), source);
    return { path: filename, sha256: createHash('sha256').update(source).digest('hex'), status: 'analyzed', encoding: 'utf-8' };
  });
  const inventory = path.join(directory, 'inventory.json');
  writeFileSync(inventory, JSON.stringify({ root, scopes: ['.'], files, coverage: { inventory_complete: true } }));
  return { directory, root, inventory, files };
}

function collect(input, name = 'report', extra = []) {
  const output = path.join(input.directory, name);
  const result = spawnSync(process.execPath, [script, '--inventory', input.inventory, '--output', output, '--tools-dir', tools, ...extra], { encoding: 'utf8' });
  return { ...result, output, report: result.status === 0 || result.status === 2 ? JSON.parse(readFileSync(path.join(output, 'structure.json'), 'utf8')) : null };
}

// Contract: source-attributed gaps must not turn malformed/unresolved modules into
// a clean graph; SCCs must retain all real members and edges, including aliases.
test('CLI retains complete cyclic components and exposes parser/resolver gaps', () => {
  const input = fixture('graph', {
    'a.ts': 'import { b } from "@/b"; import { c } from "./c"; export const a = b + c;\n',
    'b.ts': 'import { a } from "./a"; export const b = a;\n',
    'c.ts': 'import { b } from "./b"; export const c = b;\n',
    'self.cjs': 'require("./self.cjs");\n',
    'esm.mjs': 'import "./self.cjs";\n',
    'bad.ts': 'import { broken syntax!!!;\n',
    'bad.js': 'export function broken( {\n',
    'missing.ts': 'import "./not-there";\n',
    'outside.ts': 'import "../outside";\n',
    'other.py': 'def valid():\n    return 7\n',
  });
  writeFileSync(path.join(input.directory, 'outside.ts'), 'export const outside = 1;\n');
  const tsconfig = path.join(input.root, 'tsconfig.json');
  writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } } }));
  const result = collect(input, 'report', ['--tsconfig', tsconfig]);
  assert.equal(result.status, 2, result.stderr);
  const graph = result.report.graph;
  assert.equal(graph.status, 'partial');
  const component = graph.cyclicComponents.find(group => group.members.includes('a.ts'));
  assert.deepEqual(component.members, ['a.ts', 'b.ts', 'c.ts']);
  assert.deepEqual(component.edges.map(({ from, to }) => `${from}->${to}`).sort(), ['a.ts->b.ts', 'a.ts->c.ts', 'b.ts->a.ts', 'c.ts->b.ts']);
  assert.ok(graph.cyclicComponents.some(group => group.members.length === 1 && group.members[0] === 'self.cjs'));
  assert.deepEqual(graph.graph['esm.mjs'], ['self.cjs']);
  assert.deepEqual(graph.parseErrors.map(file => file.path).sort(), ['bad.js', 'bad.ts']);
  assert.ok(graph.parseErrors.every(file => file.error.length > 0));
  assert.ok(graph.unresolvedImports.some(item => item.path === 'missing.ts' && item.specifier === './not-there'));
  assert.ok(graph.boundaryImports.some(item => item.path === 'outside.ts' && item.target === '../outside.ts'));
  assert.ok(!('../outside.ts' in graph.graph));
  assert.deepEqual(graph.unsupported.map(file => file.path), ['other.py']);
  assert.equal(graph.coverage.parseErrors, 2);
  assert.equal(graph.coverage.edges, 6);
  assert.ok(result.report.tools.versions.madge);
});

// Contract: no file-size or occurrence cap; cross-file lexical evidence is kept
// for every supported group, with lossless original paths and explicit coverage.
test('CLI keeps large files, every clone occurrence, languages, unusual paths and CPD errors', { skip: !pmdAvailable }, () => {
  const implementations = {
    js: 'function bill(items) {\n let total = 0;\n for (const item of items) {\n  if (item.active) total += item.price;\n }\n return total;\n}\n',
    ts: 'function bill(items: any[]) {\n let total = 0;\n for (const item of items) {\n  if (item.active) total += item.price;\n }\n return total;\n}\n',
    py: 'def bill(items):\n    total = 0\n    for item in items:\n        if item.active:\n            total += item.price\n    return total\n',
    rs: 'fn bill(items: &[Item]) -> i32 {\n let mut total = 0;\n for item in items {\n  if item.active { total += item.price; }\n }\n total\n}\n',
    cpp: '#if 0\nint bill(int price) {\n int total = 0;\n if (price > 0) {\n  total += price;\n }\n return total;\n}\n#endif\n',
  };
  const sources = {};
  for (const [extension, source] of Object.entries(implementations)) {
    for (const name of ['one', 'two', 'three', 'four']) sources[`${name}.${extension}`] = source;
  }
  sources['comma,dir/ leading\nname.py'] = implementations.py;
  sources['large.js'] = `//${'padding'.repeat(160_000)}\n${implementations.js}`;
  sources['suppressed.js'] = '// CPD-OFF\nconst secret = 420;\n// CPD-ON\n';
  sources['bad.py'] = 'def broken():\n    """unterminated\n';
  sources['widget.tsx'] = 'export const Widget = () => <div />;\n';
  sources['ambiguous.h'] = 'int example();\n';
  const input = fixture('clones', sources);
  // A metrics-parser gap is not an exclusion from other supported analyses.
  input.files.find(file => file.path === 'one.rs').status = 'unsupported';
  writeFileSync(input.inventory, JSON.stringify({ root: input.root, scopes: ['.'], files: input.files }));
  const result = collect(input);
  assert.equal(result.status, 2, result.stderr);
  const clones = result.report.duplicates;
  assert.equal(clones.status, 'partial');
  assert.deepEqual(clones.groups.map(group => group.language).sort(), ['cpp', 'ecmascript', 'python', 'rust', 'typescript']);
  for (const [extension, language] of [['js', 'ecmascript'], ['ts', 'typescript'], ['py', 'python'], ['rs', 'rust'], ['cpp', 'cpp']]) {
    const group = clones.groups.find(group => group.language === language);
    const expected = ['one', 'two', 'three', 'four'].map(name => `${name}.${extension}`);
    if (extension === 'js') expected.push('large.js');
    if (extension === 'py') expected.push('comma,dir/ leading\nname.py');
    assert.ok(group.duplications.some(duplication => Number(duplication.lines) >= 6 && expected.every(filename => duplication.file.some(file => file.path === filename))), `${language}: all full implementation occurrences must survive`);
    for (const filename of expected) assert.ok(group.files.some(file => file.path === filename && Number(file.totalNumberOfTokens) > 0), filename);
    assert.ok(readFileSync(path.join(result.output, group.report), 'utf8').includes('<pmd-cpd'));
    assert.match(group.pmdVersion, /^\d+\.\d+\.\d+/);
  }
  const python = clones.groups.find(group => group.language === 'python');
  assert.equal(python.command.exitCode, 5);
  assert.ok(python.errors.some(error => error.filename === 'bad.py'));
  assert.deepEqual(python.missing, ['bad.py']);
  assert.ok(clones.unsupported.some(file => file.path === 'widget.tsx' && file.reason === 'unsupported_cpd_language'));
  assert.ok(clones.unsupported.some(file => file.path === 'ambiguous.h' && file.reason === 'ambiguous_cpd_language'));
  assert.deepEqual(clones.suppressionMarkers, [{ path: 'suppressed.js', line: 1, marker: 'CPD-OFF' }, { path: 'suppressed.js', line: 3, marker: 'CPD-ON' }]);
  assert.equal(clones.coverage.analyzed, input.files.length - 3);
  assert.equal(clones.coverage.errors, 1);
  assert.ok(clones.coverage.cloneGroups > 4); // Trivial token groups were not screened away.
});

// Contract: an evidence invocation cannot replace prior reports or read a path
// outside its inventory root, and stale inventory hashes cannot certify new code.
test('CLI preserves existing outputs and refuses stale or escaping inventory evidence', () => {
  const input = fixture('safety', { 'valid.js': 'export const stable = 42;\n' });
  if (pmdAvailable) {
    const clean = collect(input, 'clean');
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(clean.report.status, 'complete');
    assert.deepEqual(clean.report.duplicates.groups[0].missing, []);
    assert.equal(clean.report.graph.coverage.nodes, 1);
  }
  const existing = path.join(input.directory, 'existing');
  mkdirSync(existing);
  writeFileSync(path.join(existing, 'structure.json'), 'valuable existing report');
  const collision = collect(input, 'existing');
  assert.equal(collision.status, 1);
  assert.equal(readFileSync(path.join(existing, 'structure.json'), 'utf8'), 'valuable existing report');
  assert.deepEqual(readdirSync(existing), ['structure.json']);

  writeFileSync(path.join(input.root, 'valid.js'), 'export const changed = 99;\n');
  const stale = collect(input, 'stale');
  assert.equal(stale.status, 2, stale.stderr);
  assert.equal(stale.report.files[0].status, 'input_error');
  assert.match(stale.report.files[0].error, /hash differs/);
  assert.equal(stale.report.coverage.ready, 0);

  writeFileSync(input.inventory, JSON.stringify({ root: input.root, files: [{ ...input.files[0], path: '../outside.js' }] }));
  const escape = collect(input, 'escape');
  assert.equal(escape.status, 1);
  assert.match(escape.stderr, /Invalid or duplicate inventory path/);
  assert.ok(!readdirSync(input.directory).includes('escape'));
});
