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
const proposeEvals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

test("unchanged full-suite evidence is shared instead of rerun", () => {
  assert.match(skill, /shared evidence ledger/i);
  assert.match(skill, /HEAD\^\{tree\}/);
  assert.match(skill, /Do not rerun a still-valid full suite/i);
  assert.match(skill, /Do not reuse an entry produced on a dirty checkout/i);
  assert.match(skill, /dependencies, toolchain, configuration, generated artifacts/i);
  assert.match(skill, /Findings, verdicts, and sign-off are review history, not reusable validation evidence/i);
  assert.match(skill, /Manual observations.+current-only.+must not be reused/i);
  assert.match(propose, /current inspectable evidence/i);
  assert.match(propose, /ledger reuse never replaces a reviewer pass required in that wave/i);
  assert.match(propose, /seats that blocked the previous wave/i);
  assert.doesNotMatch(propose, /passing tests need fresh output/i);
  assert.match(panel, /Ledger reuse never replaces the reviewer's own fresh analysis/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-reuse-full-suite-on-unchanged-tree"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-change-invalidates-reused-evidence"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-dirty-tree-not-reusable"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-environment-invalidates-reused-evidence"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-review-verdict-is-not-reusable"));
  const staleReview = proposeEvals.evals.find(({ id }) => id === "edge-stale-head-evidence");
  assert.match(staleReview.expected_output, /reviewer-ponytail/i);
  assert.match(staleReview.expected_output, /reviewer-gpt/i);
  assert.doesNotMatch(staleReview.expected_output, /every required reviewer/i);
});

test("blockers always, nits unless a massive undertaking", () => {
  assert.match(skill, /Never defer a blocker/);
  assert.match(skill, /remaining nits were fixed or rebutted, unless they are a massive undertaking/);
  assert.match(skill, /Do not claim complete while blockers or ordinary nits remain/);
  assert.ok(evals.evals.some(({ id }) => id === "edge-nits-executed-unless-massive"));
});
