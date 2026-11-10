import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillDir = fileURLToPath(new URL("../skills/pi-development/", import.meta.url));
const skill = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
const { evals } = JSON.parse(readFileSync(path.join(skillDir, "evals/evals.json"), "utf8"));

test("Pi guidance links its shipped resolver and conditional references", () => {
  for (const file of [
    "scripts/resolve_pi.py",
    "references/current-version-hazards.md",
    "references/runtime-authoring-guide.md",
    "references/lifecycle-checklist.md",
    "references/tool-design-checklist.md",
    "references/tui-authoring-guide.md",
    "references/provider-model-guide.md",
    "references/idea-evaluation-checklist.md",
    "references/linux-docker-validation.md",
    "references/publishing/workflow.md",
  ]) {
    assert.ok(skill.includes(file), `missing entry-point link: ${file}`);
    assert.ok(existsSync(path.join(skillDir, file)), `missing resource: ${file}`);
  }
});

test("Pi contract scenarios remain available to behavioral evaluation", () => {
  const ids = new Set(evals.map(({ id }) => id));
  for (const id of [
    "typebox-1-3-7-migration",
    "pi-schema-tool-validation-1-5",
    "scoped-model-extension-picker",
    "message-renderer-output-padding",
    "rpc-user-bash-policy",
    "active-session-replacement-persistence",
    "models-request-transforms-and-null-headers",
    "json-rpc-delta-message-updates",
    "model-refresh-and-auth-cancellation",
    "provider-refresh-generation-publication",
    "oauth-refresh-concrete-abort-signal",
    "agent-core-v4-session-repositories",
    "agent-core-filesystem-rename",
    "remote-session-metadata-snapshot",
    "public-extension-shared-host-policy",
    "official-fork-lifecycle-boundary",
    "optional-tools-and-execution-cwd",
  ]) assert.ok(ids.has(id), `missing eval: ${id}`);
});

// Execute the shipped inline recipes, rather than asserting their source text.
const packRecipes = [
  "references/publishing/workflow.md",
  "references/linux-docker-validation.md",
].flatMap(file => [...readFileSync(path.join(skillDir, file), "utf8")
  .matchAll(/(?:node|"\$NODE_BIN") -e '([\s\S]*?)'\s+([^\n]*)/g)]
  .filter(([, , args]) => args.includes('"$pack_json"'))
  .map(([, code], index) => ({ file, index, code })));
const name = "@fixture/pi-pack-shapes";
const version = "1.2.3";
const filename = "fixture-pi-pack-shapes-1.2.3.tgz";
// Captured from the same no-script package with npm 11.19.0 and 12.2.0.
const packShapes = ["npm11", "npm12"].map(npm => JSON.parse(readFileSync(
  new URL(`./fixtures/${npm}-pack.json`, import.meta.url), "utf8")));

test("pack recipes accept observed npm 11/12 output and fail closed on ambiguous identity", () => {
  assert.equal(packRecipes.length, 5, "exercise every documented pack parser");
  const dir = mkdtempSync(path.join(tmpdir(), "pi-pack-recipes-"));
  try {
    const packPath = path.join(dir, "pack.json");
    const evidencePath = path.join(dir, "release-evidence.json");
    const markerPath = path.join(dir, ".pi-release-artifact");
    writeFileSync(path.join(dir, filename), "retained release artifact\n");
    const sha256 = createHash("sha256").update("retained release artifact\n").digest("hex");
    const evidence = { artifactId: "owned-artifact", name, version, filename, sha256,
      registry: "https://registry.npmjs.org", tag: "latest", access: "public",
      gitCommit: "approved-commit", gitTag: "v1.2.3" };
    writeFileSync(evidencePath, JSON.stringify(evidence));
    writeFileSync(markerPath, "owned-artifact\n");
    for (const { file, index, code } of packRecipes) {
      const publication = file.endsWith("workflow.md") && index === 3;
      const args = publication
        ? [evidencePath, markerPath, packPath, dir, name, version, evidence.registry,
          evidence.tag, evidence.access, evidence.gitCommit, evidence.gitTag, sha256]
        : [packPath, name, version];
      const run = value => {
        writeFileSync(packPath, JSON.stringify(value));
        return spawnSync(process.execPath, ["-e", code, ...args], {
          encoding: "utf8", env: {}, timeout: 5000,
        });
      };
      const label = `${file} parser ${index}`;
      for (const shape of packShapes) {
        const result = run(shape);
        assert.equal(result.status, 0, `${label}: ${result.stderr}`);
        if (file.endsWith("workflow.md") && index === 2) {
          assert.deepEqual(JSON.parse(result.stdout), { name, version, filename,
            files: [{ path: "index.js", size: 26, mode: 420 },
              { path: "package.json", size: 90, mode: 420 }] });
        } else {
          assert.equal(result.stdout, publication ? path.join(dir, filename) : filename, label);
        }
      }
      const record = packShapes[0][0];
      for (const invalid of [null, "invalid", [], [record, record], [null],
        { unexpected: record }, { unexpected: record, [name]: record },
        [{ ...record, name: "another-package" }], { [name]: { ...record, name: "another-package" } },
        [{ ...record, filename: "" }]]) {
        assert.notEqual(run(invalid).status, 0, `${label} accepted ambiguous/malformed metadata`);
      }
      if (file.endsWith("workflow.md") && index > 0) {
        assert.notEqual(run([{ ...record, version: "9.9.9" }]).status, 0, `${label} accepted wrong version`);
      }
      if (file.endsWith("workflow.md") && (index === 1 || index === 2)) {
        assert.notEqual(run([{ ...record, files: null }]).status, 0, `${label} accepted missing manifest`);
      }
      if (publication) {
        for (const [changed, error] of [[{ ...evidence, sha256: "changed" }, /release tarball hash changed/],
          [{ ...evidence, filename: "../escaped.tgz" }, /escaped artifact directory/],
          [{ ...evidence, artifactId: "not-owned" }, /artifact marker mismatch/]]) {
          writeFileSync(evidencePath, JSON.stringify(changed));
          const result = run([{ ...record, filename: changed.filename }]);
          assert.notEqual(result.status, 0, `${label} accepted changed hash/path/marker`);
          assert.match(result.stderr, error, label);
        }
        writeFileSync(evidencePath, JSON.stringify(evidence));
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The stamp is the one record of the official release and fork commit the skill was checked
// against. docs/refreshing-pi-development.md describes it and the places that repeat it.
const root = fileURLToPath(new URL("../", import.meta.url));
const markdownUnder = dir => readdirSync(path.join(root, dir), { recursive: true })
  .filter(file => file.endsWith(".md")).map(file => path.join(dir, file));
const linesOf = file => readFileSync(path.join(root, file), "utf8").split("\n")
  .map((text, index) => ({ at: `${file}:${index + 1}`, text }));

function readStamp() {
  const frontmatter = skill.slice(0, skill.indexOf("\n---\n", 3));
  const value = (key, shape) => {
    const found = [...frontmatter.matchAll(new RegExp(`^  ${key}: "(${shape})"$`, "gm"))];
    assert.equal(found.length, 1, `SKILL.md frontmatter needs exactly one \`  ${key}: "<value>"\` line`);
    return found[0][1];
  };
  return { official: value("last-verified-pi", "\\d+\\.\\d+\\.\\d+"), fork: value("fork-source", "[0-9a-f]{40}") };
}

test("the refresh procedure's own commands read the stamp", { skip: process.platform === "win32" }, () => {
  const stamp = readStamp();
  const commands = readFileSync(path.join(root, "docs/refreshing-pi-development.md"), "utf8")
    .split("\n").filter(line => /^stamp_(official|fork)=/.test(line));
  assert.equal(commands.length, 2, "the procedure reads both stamp values");
  const result = spawnSync("sh", ["-c",
    `${commands.join("\n")}\nprintf '%s %s' "$stamp_official" "$stamp_fork"`], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${stamp.official} ${stamp.fork}`);
});

test("official versions and fork commits written in the skill equal the stamp", () => {
  const stamp = readStamp();
  const version = /(?<![\w.])v?(\d+\.\d+\.\d+)(?!\w|\.\d)/g;
  const commit = /(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])|(?<=`)[0-9a-f]{7,39}(?=`)|(?<=fitchmultz\/pi\/(?:tree|commit|blob)\/)[0-9a-f]{7,39}(?![0-9a-f])/g;
  // A package's own changelog heading in a format example; it names no Pi release.
  const exampleVersions = new Set(["1.2.0"]);
  const wrong = [];
  for (const file of ["skills/pi-development/SKILL.md", ...markdownUnder("skills/pi-development/references")]) {
    let companionRows = false;
    for (const { at, text } of linesOf(file)) {
      // Other components' versions live only in the hazards table that starts with this header.
      if (text.startsWith("| Component | Version |")) companionRows = true;
      else if (!text.startsWith("|")) companionRows = false;
      const versionExempt = (companionRows && !text.includes("pi-coding-agent")) || /^  version: "/.test(text);
      for (const [, found] of versionExempt ? [] : text.matchAll(version)) {
        if (found !== stamp.official && !exampleVersions.has(found)) wrong.push(`${at}: version ${found}`);
      }
      for (const { 0: found, index } of text.matchAll(commit)) {
        // An official-repository commit is cited as: Upstream `<id>`.
        if (!/\d/.test(found) || !/[a-f]/.test(found) || /Upstream `$/.test(text.slice(0, index))) continue;
        if (!stamp.fork.startsWith(found)) wrong.push(`${at}: commit ${found}`);
      }
    }
  }
  assert.deepEqual(wrong, [], `The stamp is official ${stamp.official} and fork ${stamp.fork}. `
    + "Make each of these equal it, remove it, or move a companion version into the Component table of "
    + "references/current-version-hazards.md. docs/refreshing-pi-development.md describes the stamp.");
});

test("the development SDK pin and the Pi floors outside the skill equal the stamp", () => {
  const stamp = readStamp();
  const sdk = "@earendil-works/pi-coding-agent";
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(manifest.devDependencies[sdk], stamp.official, "package.json development SDK pin");
  assert.equal(lock.packages[`node_modules/${sdk}`].version, stamp.official, "package-lock.json development SDK");
  // Release history, evaluation reports and evaluation prompts keep the versions they describe.
  const files = ["README.md", "AGENTS.md", ...markdownUnder("docs"), ...markdownUnder("skills")]
    .filter(file => file !== path.join("docs", "evaluation-results.md")
      && !file.startsWith(path.join("skills", "pi-development") + path.sep));
  const wrong = files.flatMap(linesOf).flatMap(({ at, text }) =>
    [...text.matchAll(/\bPi\s+`?v?(\d+\.\d+\.\d+)/g)]
      .filter(([, found]) => found !== stamp.official).map(([, found]) => `${at}: Pi ${found}`));
  assert.deepEqual(wrong, [], `These name a Pi version other than the stamp's official ${stamp.official}.`);
});
