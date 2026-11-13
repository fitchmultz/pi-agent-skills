// The pi-development skill cites hundreds of Pi facts in code spans: names that a host declares,
// documentation files and headings, schema files, environment variables, and bundled versions.
// This check looks up every one in the Pi package of the host that the run was given. It fails
// when a host no longer has a cited fact, and when official Pi has a fact that the skill marks as
// fork-only. "Facts that npm test checks" in docs/refreshing-pi-development.md tells a refresh
// how to answer each failure.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { findPackageJSON } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const skillDir = "skills/pi-development";
const sdk = "@earendil-works/pi-coding-agent";
const self = "test/pi-development-facts.test.mjs";
const procedure = "docs/refreshing-pi-development.md (\"Facts that npm test checks\")";

// Written directly after the closing backtick of a code span, with no space. It states that official
// Pi does not have the last part of the span: the last name of a dotted path, or the heading of a
// documentation link. One marked mention marks the fact in the whole skill.
const forkOnlyMark = "<!-- fork-only -->";

// Names in code spans that no Pi package holds. A name that the selected host does not have fails
// until the skill line is corrected, the fork-only mark is added, or the name is listed here.
const notHostNames = new Map([
  { why: "tools that separate extensions register (pi-change-working-dir, pi-ask-question, @fitchmultz/pi-subagents)",
    names: ["change_dir", "ask_question", "agent_runs", "load_subagent"] },
  { why: "the skill says that neither host has it, or that pi-agent-core no longer exports it",
    names: ["discover_tools", "sendSessionIdHeader", "continueSession", "AgentHarness", "RemoteSession", "PiClient",
      "Session", "Storage"] },
  { why: "a function inside Pi's MCP extension, which no declaration carries",
    names: ["ensureDiscoveryActive"] },
  { why: "fields of package.json, tsconfig.json, and the fleet.json of fitchmultz/.github",
    names: ["devDependencies", "peerDependencies", "peerDependenciesMeta", "bundledDependencies", "publishConfig",
      "compilerOptions", "noEmit", "NodeNext", "npmRelease", "npmPackage"] },
  { why: "variables of the shared qualifier and of GitHub Actions in fitchmultz/.github",
    names: ["PI_HOST_INDEX", "PI_HOST_CLI", "PI_COMPAT_EXPECTED_VERSION", "PI_COMPAT_EXPECTED_PACKAGE_DIR",
      "NPM_RELEASE_ENABLED", "SELF_HOSTED_RUNNERS"] },
  { why: "shell variables that the skill's own recipes define",
    names: ["PI_ROOT", "PROVIDER_ID", "RELEASE_ARTIFACT_DIR", "AUTHORIZED_GIT_COMMIT", "AUTHORIZED_GIT_TAG",
      "AUTHORIZED_NPM_NAME", "AUTHORIZED_NPM_VERSION", "AUTHORIZED_NPM_TAG", "AUTHORIZED_NPM_ACCESS",
      "target_env", "host_env"] },
  { why: "names that Bash, Docker, npm, and Node own",
    names: ["BASH_ENV", "DOCKER_HOST", "NPM_TOKEN", "StringDecoder", "Dockerfile"] },
  { why: "words that name a spelling style or stand for a value",
    names: ["snake_case", "camelCase", "vX"] },
  { why: "documents of the owner's package repositories and of fitchmultz/.github, not of Pi",
    names: ["docs/development.md", "docs/reference.md", "docs/strict-quality-standard.md",
      "docs/integration.md", "docs/qualification.md", "docs/npm-releases.md"] },
].flatMap(({ why, names }) => names.map(name => [name, why])));

// ---------------------------------------------------------------------------------------------
// The host

// The shared qualifier (scripts/qualify.mjs in fitchmultz/.github) sets PI_COMPAT_HOST to
// "official" or "fork" and PI_HOST_INDEX to that host's SDK. A plain `npm test` sets neither:
// the host is then the development SDK, which package.json pins to the stamp's official release.
function selectHost() {
  const given = process.env.PI_COMPAT_HOST;
  const flavor = given ?? (process.env.PI_HOST_INDEX ? undefined : "official");
  assert.ok(flavor === "official" || flavor === "fork",
    `PI_HOST_INDEX selects a host, so PI_COMPAT_HOST must say which one: "official" or "fork". It is ${JSON.stringify(given)}.`);
  const index = process.env.PI_HOST_INDEX
    ? pathToFileURL(process.env.PI_HOST_INDEX).href
    : import.meta.resolve(sdk);
  const packageDir = realpathSync(fileURLToPath(new URL("..", index)));
  const { version } = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
  return { flavor, packageDir, version, title: `${flavor === "fork" ? "the fork" : "official Pi"} ${version}`,
    selectedBy: given ? `PI_COMPAT_HOST=${given}` : "the development SDK of a plain local run" };
}

const slug = heading => heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replaceAll(" ", "-");

/** Everything the check compares the skill with: what the host package and its Pi dependencies ship. */
function readHost({ packageDir }) {
  // The coding agent, every @earendil-works package it depends on, and the TypeBox it bundles.
  const packages = new Map();
  const visit = dir => {
    const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    if (packages.has(manifest.name)) return;
    packages.set(manifest.name, { dir, manifest });
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      if (!name.startsWith("@earendil-works/") && name !== "typebox") continue;
      const found = findPackageJSON(name, pathToFileURL(path.join(dir, "package.json")));
      assert.ok(found, `${manifest.name} depends on ${name}, which is not installed beside ${dir}`);
      visit(path.dirname(found));
    }
  };
  visit(packageDir);

  const declared = new Set();
  const quoted = new Set();
  const constants = new Set();
  let declarationFiles = 0;
  let codeFiles = 0;
  for (const [name, { dir }] of packages) {
    for (const file of readdirSync(dir, { recursive: true })) {
      // Bundles repeat the modules beside them and add third-party code.
      if (/(^|[\\/])(node_modules|bundle|bun)[\\/]/.test(file)) continue;
      if (/\.d\.[mc]?ts$/.test(file)) {
        declarationFiles += 1;
        const text = readFileSync(path.join(dir, file), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
        for (const [found] of text.matchAll(/[A-Za-z_$][\w$]*/g)) declared.add(found);
      } else if (/\.[mc]?js$/.test(file) && name.startsWith("@earendil-works/")) {
        // Code holds what declarations do not: tool names and wire values as whole quoted strings,
        // and environment variables and constants as upper-case identifiers.
        codeFiles += 1;
        for (const [, , string, constant] of readFileSync(path.join(dir, file), "utf8")
          .matchAll(/(["'])([A-Za-z_]\w*)\1|\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g)) {
          if (string) quoted.add(string);
          else constants.add(constant);
        }
      }
    }
  }

  const schemaDir = path.join(packageDir, "schemas");
  const schemaFiles = existsSync(schemaDir) ? readdirSync(schemaDir).filter(file => file.endsWith(".schema.json")) : [];
  const propertyNames = file => {
    const names = new Set();
    const walk = (value, inProperties) => {
      if (value === null || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (inProperties) names.add(key);
        walk(child, !inProperties && key === "properties");
      }
    };
    walk(JSON.parse(readFileSync(path.join(schemaDir, file), "utf8")), false);
    return names;
  };
  const settings = schemaFiles.includes("settings.schema.json") ? propertyNames("settings.schema.json") : new Set();
  const configuration = new Set(schemaFiles.flatMap(file => [...propertyNames(file)]));

  const docsDir = path.join(packageDir, "docs");
  const docs = new Map((existsSync(docsDir) ? readdirSync(docsDir) : []).filter(file => file.endsWith(".md"))
    .map(file => [`docs/${file}`, new Set([...readFileSync(path.join(docsDir, file), "utf8")
      .matchAll(/^#{1,6} +(.+)$/gm)].map(([, heading]) => slug(heading)))]));

  const searched = {
    name: `a name: as an identifier in ${declarationFiles} declaration files, or as a whole quoted string or an upper-case identifier in ${codeFiles} JavaScript files, of ${[...packages.keys()].join(", ")} (resolved from ${packageDir}); or as a property name in ${path.join(schemaDir, "*.schema.json")}`,
    doc: `a documentation file or heading: in ${docsDir} (${docs.size} files)`,
    schema: `a schema file: in ${schemaDir} (${schemaFiles.length} files)`,
  };
  return { packages, declared, quoted, constants, settings, configuration, docs, schemaFiles: new Set(schemaFiles), searched };
}

/** The kind of fact that the host holds `fact` as; undefined when the host does not have it. */
function heldAs(host, { kind, key }) {
  if (kind === "schema") return host.schemaFiles.has(key.slice("schemas/".length)) ? "schema file" : undefined;
  if (kind === "doc") {
    const [file, anchor] = key.split("#");
    if (!host.docs.has(file)) return undefined;
    if (anchor === undefined) return "documentation file";
    return host.docs.get(file).has(anchor) ? "documentation heading" : undefined;
  }
  // `Prefix*` cites the names that start with the prefix.
  const has = key.endsWith("*")
    ? names => [...names].some(name => name.startsWith(key.slice(0, -1)))
    : names => names.has(key);
  if (/^[A-Z][A-Z0-9_]*\*?$/.test(key)) {
    return has(host.declared) || has(host.constants) || has(host.quoted) ? "environment variable or constant" : undefined;
  }
  if (has(host.settings)) return "setting name";
  if (has(host.declared)) return "declared name";
  if (has(host.configuration)) return "configuration key";
  if (has(host.quoted)) return "tool name or wire value";
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// The skill

const word = "[A-Za-z_][A-Za-z0-9_]*";
// `Name`, `a.b.c`, `a.b()`, `a.b(args)`, `Name<T>`, `name: value`, `name?: type`, `NAME=value`, `Prefix*`.
const namePath = new RegExp(`^(?:await |new )?(${word}(?:\\.${word})*)(\\*)?(?:\\(.*\\)|<.*>|\\??: .+|=\\S*)?$`);
const fileName = /\.(?:md|json|jsonl|ts|tsx|js|mjs|cjs|ya?ml|toml|sh|py|tgz|txt|log|lock)$/;
// camelCase, PascalCase, and names with an underscore. A plain lowercase word or an acronym is also
// an English word or a keyword, so finding it in a host proves nothing.
const distinctive = name => /[a-z0-9][A-Z]|[A-Za-z0-9]_[A-Za-z0-9]/.test(name) || /^[A-Z][a-z]/.test(name);

/**
 * The facts that one code span cites. `markable` is the fact that a fork-only mark after the span
 * covers: the heading of a documentation link, else the one file, else the last name of a path.
 */
function citedFacts(span) {
  const doc = /^(docs\/[\w.-]+\.md)(#[\w-]+)?$/.exec(span);
  if (doc) {
    const facts = [{ kind: "doc", key: doc[1], text: `the file ${doc[1]}` }];
    if (doc[2]) facts.push({ kind: "doc", key: doc[1] + doc[2], text: `the heading ${doc[2]} in ${doc[1]}` });
    return { facts, markable: facts.at(-1) };
  }
  const schema = /^schemas\/(?:\{([\w,-]+)\}|([\w-]+))\.schema\.json$/.exec(span);
  if (schema) {
    const facts = (schema[1] ?? schema[2]).split(",").map(name => `schemas/${name}.schema.json`)
      .map(key => ({ kind: "schema", key, text: `the file ${key}` }));
    return { facts, markable: facts.length === 1 ? facts[0] : undefined };
  }
  const name = namePath.exec(span);
  if (!name || fileName.test(name[1])) return { facts: [] };
  const parts = name[1].split(".");
  if (name[2]) parts.push(`${parts.pop()}*`);
  const facts = parts.filter(distinctive).map(key => ({ kind: "name", key,
    text: key.endsWith("*") ? `a name that starts with ${key.slice(0, -1)}` : `the name ${key}` }));
  return { facts, markable: distinctive(parts.at(-1)) ? facts.at(-1) : undefined };
}

/** Every fact that the skill's Markdown cites outside fenced code, with each line that cites it. */
function readSkill() {
  const facts = new Map();
  const misplacedMarks = [];
  const files = readdirSync(path.join(root, skillDir), { recursive: true })
    .filter(file => file.endsWith(".md")).map(file => `${skillDir}/${file.split(path.sep).join("/")}`).sort();
  for (const file of files) {
    let fenced = false;
    readFileSync(path.join(root, file), "utf8").split("\n").forEach((line, index) => {
      const at = `${file}:${index + 1}`;
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      let attached = 0;
      for (const [, span, mark] of line.matchAll(/`([^`]+)`(<!-- fork-only -->)?/g)) {
        const cited = citedFacts(span);
        const mention = `${at}: \`${span}\``;
        if (mark) attached += 1;
        if (mark && !cited.markable) misplacedMarks.push(`${mention}: the mark covers no fact that this check reads`);
        for (const fact of cited.facts) {
          const entry = facts.get(fact.key) ?? { ...fact, mentions: [], marked: [] };
          facts.set(fact.key, entry);
          entry.mentions.push(mention);
          if (mark && fact === cited.markable) entry.marked.push(mention);
        }
      }
      if (line.split(forkOnlyMark).length - 1 !== attached) misplacedMarks.push(`${at}: a mark does not directly follow a code span`);
    });
  }
  return { files, facts: [...facts.values()], misplacedMarks };
}

/** The bundled versions in the Component table of the hazards reference, each with the host's value. */
function bundledVersions(host, flavor) {
  const file = `${skillDir}/references/current-version-hazards.md`;
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  const row = (label, pattern) => {
    const index = lines.findIndex(line => line.startsWith(`| ${label} |`));
    const cited = index < 0 ? null : pattern.exec(lines[index]);
    assert.ok(cited, `${file}: the Component table needs a "${label}" row that matches ${pattern}`);
    return { at: `${file}:${index + 1}`, cited: cited[1] };
  };
  const coding = host.packages.get(sdk);
  const nodePattern = flavor === "fork"
    ? /(?:the fork declares|Both distributions declare) `engines\.node ([^`]+)`/
    : /(?:Official Pi declares|Both distributions declare) `engines\.node ([^`]+)`/;
  return [
    { ...row("TypeBox bundled with Pi", flavor === "fork" ? /`([\d.]+)` on the fork/ : /`([\d.]+)` on official Pi/),
      what: "the TypeBox version", actual: host.packages.get("typebox")?.manifest.version,
      where: `the version of the typebox package that ${coding.dir} resolves` },
    { ...row("Node and npm", nodePattern),
      what: "engines.node", actual: coding.manifest.engines?.node,
      where: `engines.node in ${path.join(coding.dir, "package.json")}` },
  ];
}

// ---------------------------------------------------------------------------------------------
// The rules

const host = selectHost();
const hostFacts = readHost(host);
const skill = readSkill();
const checked = skill.facts.filter(fact => !notHostNames.has(fact.key));
const forkOnly = checked.filter(fact => fact.marked.length > 0);
const shared = checked.filter(fact => fact.marked.length === 0);

/** One line for each mention of each fact, then where each kind of fact was looked for. */
function list(facts, mentionsOf) {
  const kinds = new Set(facts.map(fact => fact.kind));
  return [
    ...facts.flatMap(fact => mentionsOf(fact).map(mention => `  ${mention} cites ${fact.text}`)),
    `Looked for in ${host.title}:`,
    ...[...kinds].map(kind => `  ${hostFacts.searched[kind]}`),
  ].join("\n");
}

/** Rules 1 and 2 are one comparison: the host has every fact in `facts`, and the bundled versions match. */
function assertHostHas(facts) {
  const missing = facts.filter(fact => !heldAs(hostFacts, fact));
  assert.equal(missing.length, 0, `The skill cites facts that ${host.title} does not have (${missing.length}):\n${list(missing, fact => fact.mentions)}\n`
    + "For each fact: if the host removed or renamed it, correct or remove the skill line. "
    + (host.flavor === "official" ? `If only the fork has it, write ${forkOnlyMark} directly after one code span that cites it. ` : "")
    + `If no Pi package ever holds the name, add it to notHostNames in ${self} with the reason. See ${procedure}.`);
  const wrong = bundledVersions(hostFacts, host.flavor).filter(({ cited, actual }) => cited !== actual);
  assert.equal(wrong.length, 0, `The skill states bundled versions that differ from ${host.title} (${wrong.length}):\n`
    + wrong.map(({ at, what, cited, actual, where }) => `  ${at}: ${what} \`${cited}\`; the host has ${actual} (${where})`).join("\n")
    + `\nWrite the host's value into that row. See ${procedure}.`);
}

const skipUnless = flavor => host.flavor === flavor ? false
  : `not checked: this run has ${host.title}, selected by ${host.selectedBy}. The "${flavor}" CI job checks this rule.`;

test("the fact check reads the selected host and the skill's marks", t => {
  // The qualifier states which package and version it selected.
  const { PI_COMPAT_EXPECTED_PACKAGE_DIR: expectedDir, PI_COMPAT_EXPECTED_VERSION: expectedVersion } = process.env;
  if (expectedDir) assert.equal(host.packageDir, realpathSync(expectedDir));
  if (expectedVersion) assert.equal(host.version, expectedVersion);
  assert.deepEqual(skill.misplacedMarks, [],
    `Write ${forkOnlyMark} directly after the closing backtick of a code span that cites a fact. See ${procedure}.`);
  const kinds = {};
  for (const fact of checked) {
    const kind = heldAs(hostFacts, fact) ?? (fact.marked.length > 0 ? "marked fork-only and absent" : "missing");
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  kinds["bundled version"] = bundledVersions(hostFacts, host.flavor).length;
  t.diagnostic(JSON.stringify({ host: host.flavor, version: host.version, selectedBy: host.selectedBy, packageDir: host.packageDir,
    skillFiles: skill.files.length, facts: checked.length + kinds["bundled version"],
    mentions: checked.reduce((sum, fact) => sum + fact.mentions.length, 0),
    markedForkOnly: forkOnly.length, notHostNames: notHostNames.size, kinds }));
});

test("rule 1: the fork has every fact that the skill cites", { skip: skipUnless("fork") }, () => {
  assertHostHas(checked);
});

test("rule 2: official Pi has every fact that the skill cites without the fork-only mark", { skip: skipUnless("official") }, () => {
  assertHostHas(shared);
});

test("rule 3: official Pi has no fact that the skill marks as fork-only", { skip: skipUnless("official") }, () => {
  const shipped = forkOnly.filter(fact => heldAs(hostFacts, fact));
  assert.equal(shipped.length, 0, `The skill marks facts as fork-only that ${host.title} has (${shipped.length}):\n${list(shipped, fact => fact.marked)}\n`
    + `Remove ${forkOnlyMark} from each of these lines and move its statement to the shared contracts. See ${procedure}.`);
});
