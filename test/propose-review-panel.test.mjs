import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const panel = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/review-panel.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

test("the four configured reviewers are always required", () => {
  assert.match(skill, /version: "1\.4\.0"/);
  assert.match(skill, /regular `reviewer` is never a panel member/i);
  assert.match(skill, /never a deslop proxy/i);
  assert.match(panel, /Regular `reviewer` is never a panel member and never substitutes for deslop/);
  assert.match(panel, /Deslop runs in the parent only/);
  assert.match(panel, /does not add it to this panel/);
  assert.match(panel, /All four reviewer subagents are unconditional/);

  const launchAgents = [...panel.matchAll(/agent:\s*"([^"]+)"/g)].map((m) => m[1]);
  const expectedAgents = ["reviewer-gpt", "reviewer-security", "reviewer-claude", "reviewer-ponytail"];
  assert.equal(launchAgents.length, expectedAgents.length);
  assert.deepEqual(new Set(launchAgents), new Set(expectedAgents));
  assert.ok(!launchAgents.includes("reviewer"));

  for (const agent of expectedAgents) {
    assert.match(panel, new RegExp("\\| `" + agent + "` \\| subagent, fresh \\| always \\|"));
  }
  assert.doesNotMatch(panel, /conditional: include/);
  assert.match(panel, /Once this skill is active or a PR review is requested, all four reviewers are required regardless of diff size/);
  assert.match(panel, /reviewers need not return zero nits or explicit LGTM wording/);
  assert.match(panel, /zero blocking findings remain/);
  assert.match(panel, /For an explicitly read-only review.*blockers remain reported because editing was forbidden/);

  const evalCase = evals.evals.find(({ id }) => id === "edge-regular-reviewer-not-panel-or-deslop-proxy");
  assert.ok(evalCase);
  assert.match(evalCase.prompt, /five Review agents/i);
  assert.match(evalCase.expected_output, /reviewer-gpt, reviewer-security, reviewer-claude, and reviewer-ponytail/);
  assert.match(evalCase.expected_output, /all always/i);
  assert.match(evalCase.expected_output, /Never adds regular reviewer/i);
  assert.match(evalCase.expected_output, /never uses it as a deslop proxy/i);
  assert.match(evalCase.expected_output, /Runs deslop in the parent/i);
});

test("related debt cannot be filed away or accepted", () => {
  assert.match(skill, /There is no agent-selected accepted-debt verdict/);
  assert.match(skill, /a Linear issue alone never satisfies it/i);
  assert.match(skill, /Search Linear first; if no issue already tracks it, create one/);
  assert.match(skill, /Slop, missing validation, and maintainability debt in code this run adds or changes must be fixed before that PR merges/);
  assert.match(skill, /Phase 6 is not a cleanup escape hatch/);
  assert.match(skill, /Autonomy includes completion and cleanup/);
  assert.match(skill, /never ask whether to continue an already approved implementation phase or clean up valid slop or debt/i);
  assert.match(skill, /A groundwork PR is an intermediate step, not completion/);
  assert.match(skill, /post-merge or post-deploy validation reveals an uncaught defect, regression, or polish gap/);
  assert.match(skill, /make the repair the highest-priority completion-chain item/);
  assert.match(skill, /`Shipped` requires no omissions/);
  assert.doesNotMatch(skill, /\*\*Skipped or deferred validation\*\*/);

  assert.ok(evals.evals.some(({ id }) => id === "edge-no-accepted-debt"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-unrelated-preexisting-filed"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-related-deferred-follow-up"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-autonomous-quality-cleanup"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-groundwork-pr-not-completion"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-chain-discovers-required-work"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-chain-gate-failure-keeps-independent-work-moving"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-no-unilateral-misjudged-skip"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-external-review-required"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-no-review-cycle-cap"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-base-churn-has-no-attempt-cap"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-poll-timeout-is-not-run-stop"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-reviewers-may-have-addressed-nits"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-post-merge-validation-failure-auto-repairs"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-shipped-forbids-validation-or-chain-debt"));
  assert.ok(evals.evals.some(({ id }) => id === "success-named-read-only-pr-review-uses-full-panel"));
});
