import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/verification-before-completion/SKILL.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/verification-before-completion/evals/evals.json"), "utf8"));

test("evidence reuse follows unchanged relevant inputs", () => {
  assert.match(skill, /Reuse inspectable evidence only while its relevant code, environment, and observed state remain unchanged/i);
  assert.match(skill, /HEAD\^\{tree\}/);
  assert.match(skill, /Do not rerun a still-valid full suite/i);
  assert.match(skill, /staged, unstaged, untracked, and ignored inputs are demonstrably unchanged/i);
  assert.match(skill, /dependencies, toolchain, configuration, generated artifacts/i);
  assert.doesNotMatch(skill, /Do not reuse an entry produced on a dirty checkout/i);
  assert.doesNotMatch(skill, /Manual observations.+current-only.+must not be reused/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-reuse-full-suite-on-unchanged-tree"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-change-invalidates-reused-evidence"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-environment-invalidates-reused-evidence"));
});

test("practical regression proof preserves required checks and reviews", () => {
  assert.match(skill, /expected failure against the broken implementation and the pass against the fix when practical/i);
  assert.match(skill, /missing old-code failure proof alone does not block completion/i);
  assert.match(skill, /Findings, verdicts, and sign-off are review history, not reusable validation evidence/i);
  assert.match(skill, /never use it to skip a reviewer pass required by the caller's explicit review policy/i);
  assert.match(skill, /This skill creates no such requirement/i);
  assert.match(skill, /Complete explicitly requested reviews and preserve actual repository merge requirements/i);
});
