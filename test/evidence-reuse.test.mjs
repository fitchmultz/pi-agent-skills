import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/verification-before-completion/SKILL.md"), "utf8");
const propose = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const panel = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/review-panel.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/verification-before-completion/evals/evals.json"), "utf8"));

test("unchanged full-suite evidence is shared instead of rerun", () => {
  assert.match(skill, /shared evidence ledger/i);
  assert.match(skill, /HEAD\^\{tree\}/);
  assert.match(skill, /Do not rerun a still-valid full suite/i);
  assert.match(skill, /Do not reuse an entry produced on a dirty checkout/i);
  assert.match(skill, /dependencies, toolchain, configuration, generated artifacts/i);
  assert.match(propose, /current inspectable evidence/i);
  assert.doesNotMatch(propose, /passing tests need fresh output/i);
  assert.match(panel, /evidence ledger/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-reuse-full-suite-on-unchanged-tree"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-change-invalidates-reused-evidence"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-dirty-tree-not-reusable"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-environment-invalidates-reused-evidence"));
});
