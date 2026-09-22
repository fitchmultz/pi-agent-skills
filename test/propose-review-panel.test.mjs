import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const panel = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/review-panel.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

test("local reviews follow requirements and useful roles without a fixed panel", () => {
  assert.match(skill, /Use local review when required or useful/i);
  assert.match(skill, /without requesting a fresh opt-in/i);
  assert.match(panel, /Complete every explicitly requested review/i);
  assert.match(panel, /there is no mandatory four-reviewer panel/i);
  assert.match(panel, /Claude is not automatically included whenever another reviewer runs/i);
  assert.match(skill, /never substitutes for parent-run deslop/i);
  assert.doesNotMatch(skill, /Default to no local reviewer subagents/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-explicit-user-opts-into-local-review"));
});

test("owner rebuttals preserve requested reviews and repository requirements", () => {
  for (const source of [skill, panel]) {
    assert.match(source, /If an explicitly required reviewer is unavailable, report that specific missing review and continue independent authorized work/i);
  }
  assert.match(skill, /Required review coverage is complete under `references\/review-panel\.md`/i);
  assert.doesNotMatch(skill, /required first wave|missing or disabled requested panel seat is a stop-and-report condition|an explicitly required local panel seat is unavailable/i);
  const missingReviewer = evals.evals.find(({ id }) => id === "edge-required-panel-seat-missing");
  assert.match(missingReviewer.prompt, /explicitly requires reviewer-ponytail/i);
  assert.match(missingReviewer.expected_output, /continue[s]? independent authorized work/i);
  assert.match(missingReviewer.expected_output, /Does not merge while the required review is incomplete/i);
  assert.match(panel, /The originating reviewer's agreement is not required/i);
  assert.match(skill, /originating reviewer agreement alone is not a gate/i);
  assert.match(skill, /Preserve explicitly requested reviews, required human approvals, repository protections/i);
  assert.match(panel, /An agent rebuttal does not fabricate a passing check or authorize bypassing repository protections/i);
});

test("re-review follows affected analysis and current evidence", () => {
  assert.match(panel, /Select the reviewers whose previous analysis was affected/i);
  assert.match(panel, /Re-review changes to security-sensitive behavior with the relevant security review/i);
  assert.match(panel, /A rebuttal or informational risk note alone does not require another review/i);
  assert.match(panel, /Reuse still-applicable review results after mechanical base synchronization/i);
  assert.match(panel, /Their review must independently assess the change/i);
  assert.match(skill, /current inspectable evidence/i);
  assert.doesNotMatch(skill, /passing tests need fresh output/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-stale-head-evidence"));
});
