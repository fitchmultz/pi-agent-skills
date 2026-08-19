import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = readFileSync(path.join(root, "skills/pi-extension-development/SKILL.md"), "utf8");
const extensionEvals = JSON.parse(
  readFileSync(path.join(root, "skills/pi-extension-development/evals/evals.json"), "utf8"),
);
const propose = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const proposeEvals = JSON.parse(
  readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"),
);
const mergeGate = readFileSync(
  path.join(root, "skills/propose-then-ship-pi/references/merge-gate.md"),
  "utf8",
);

test("approved repository delivery needs no second confirmation", () => {
  assert.match(extension, /If no ship gate is defined, do not infer one/);
  assert.match(extension, /Repository delivery:/);
  assert.match(extension, /Explicit external actions:/);
  assert.match(propose, /push the branch, then open the PR/);
  assert.match(propose, /does not authorize tags, releases, external artifact publication/);
  assert.match(propose, /\| Deployment \|/);
  assert.match(mergeGate, /Run or verify the repository's own defined deployment/);
  assert.ok(extensionEvals.evals.some(({ id }) => id === "approved-task-routine-repository-delivery"));
  assert.ok(proposeEvals.evals.some(({ id }) => id === "edge-personal-pr-needs-no-second-confirmation"));
});
