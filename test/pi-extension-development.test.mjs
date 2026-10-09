import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillDir = fileURLToPath(new URL("../skills/pi-extension-development/", import.meta.url));
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
