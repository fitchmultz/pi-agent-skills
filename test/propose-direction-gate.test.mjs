import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));
const triggers = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/trigger-evals.json"), "utf8"));

test("a direction returned by ask_question resumes the same run", () => {
  assert.match(skill, /`ask_question` returns the answer into the same assistant turn/);
  assert.match(skill, /continue immediately through Phase 2 into Phase 3/);
  assert.match(skill, /Do not end the turn after this restatement/);
  assert.match(skill, /action trigger, not a reporting checkpoint/);
  assert.doesNotMatch(skill, /\*\*Stop\.\*\* Do not implement/);
  assert.ok(evals.evals.some(({ id }) => id === "success-ask-question-approval-resumes-same-turn"));
});

test("approval covers the user-aware outcome without per-action prompts", () => {
  assert.match(skill, /Final outcome.*groundwork is not an outcome/);
  assert.match(skill, /Acceptance criteria.*before the run may say Shipped/);
  assert.match(skill, /Repository scope.*named or unmistakably implicated/);
  assert.match(skill, /There is no numerical PR cap/);
  assert.match(skill, /Approval follows user-aware repository scope/);
  assert.match(skill, /Never ask again for another PR, merge, or ordinary deployment/);
  assert.match(skill, /Sharing an organization is not authority/);
  assert.match(skill, /Approval binds the outcome, not the proposed mechanics/);
  assert.match(skill, /Implementation uncertainty is not a blocker/);
  assert.match(skill, /Use `change_dir` for the parent session/);
  assert.match(skill, /Standing authorization: merge and ordinary repository-defined deployment/);
  assert.match(skill, /do not infer release authority from merge or deploy authority alone/);
  assert.match(skill, /omitting a normal delivery action from the proposal does not create another approval gate/);
  assert.match(skill, /Wait is not cancel/);
  assert.match(skill, /A failed implementation plan is not a stop rule/);

  for (const id of [
    "success-clear-task-skips-proposal-not-delivery",
    "success-existing-pr-gets-full-pipeline",
    "edge-approval-inherits-same-repo",
    "edge-disclosed-cross-repo-scope",
    "edge-clearly-implicated-cross-repo-scope",
    "edge-undisclosed-cross-repo-expansion",
    "edge-replan-within-approved-outcome",
    "edge-runner-up-choice-needs-no-second-approval",
    "edge-implementation-uncertainty-is-not-blocker",
    "edge-required-deploy-is-preauthorized",
    "edge-release-is-not-inferred-from-deploy",
    "edge-delivery-only-item-needs-no-empty-pr",
    "edge-proposal-rejection-cleans-worktree",
    "edge-pr-scoped-wait",
  ]) {
    assert.ok(evals.evals.some((entry) => entry.id === id), `missing eval ${id}`);
  }

  assert.equal(triggers.find(({ query }) => query.startsWith("Rename getCwd"))?.should_trigger, true);
  assert.equal(triggers.find(({ query }) => query.startsWith("This PR is failing"))?.should_trigger, true);
  assert.equal(triggers.find(({ query }) => query.startsWith("Fix the spelling"))?.should_trigger, false);
  assert.equal(triggers.find(({ query }) => query.includes("read-only with the full panel"))?.should_trigger, true);
});
