import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const panel = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/review-panel.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

const firstWave = panel.slice(panel.indexOf("### First wave"), panel.indexOf("### Remediation wave"));
const remediationWave = panel.slice(panel.indexOf("### Remediation wave"), panel.indexOf("## Brief contents"));

test("the first wave uses the four configured panel seats", () => {
  assert.match(skill, /version: "1\.5\.1"/);
  assert.match(skill, /regular `reviewer` is never a panel member/i);
  assert.match(skill, /never substitutes for parent-run deslop/i);
  assert.match(skill, /Every PR's first substantive change gets one fresh-context async exact-head panel.+reviewer-ponytail/s);
  assert.match(skill, /Keep the checkout and HEAD fixed until every scheduled seat returns a real verdict/);
  assert.match(skill, /missing or disabled named seat is a stop-and-report condition/i);
  assert.match(panel, /Regular `reviewer` is never a panel member and never substitutes for deslop/);
  assert.match(panel, /Deslop runs in the parent only/);
  assert.match(panel, /does not add it to this panel/);

  const launchAgents = [...firstWave.matchAll(/agent:\s*"([^"]+)"/g)].map((m) => m[1]);
  const expectedAgents = ["reviewer-gpt", "reviewer-ponytail", "reviewer-claude", "reviewer-security"];
  assert.equal(launchAgents.length, expectedAgents.length);
  assert.deepEqual(new Set(launchAgents), new Set(expectedAgents));
  assert.ok(!launchAgents.includes("reviewer"));
  assert.match(firstWave, /context: "fresh"/);
  assert.match(firstWave, /async: true/);
});

test("remediation reruns ponytail, prior blockers, and sensitive security paths", () => {
  assert.match(panel, /`reviewer-ponytail` \| subagent, fresh \| every wave with a new head \|/);
  assert.match(panel, /seats that blocked the immediately preceding wave/i);
  assert.match(panel, /touching auth, secrets, injection, or data-exposure paths also reruns `reviewer-security`/i);
  assert.match(remediationWave, /agent: "reviewer-ponytail"/);
  assert.match(remediationWave, /Keep only when this seat blocked the previous wave/);
  assert.match(remediationWave, /Keep when this seat blocked, or when remediation touches auth, secrets, injection, or data exposure/);
  assert.match(panel, /mechanical rebase or merge that leaves reviewed content unchanged does not trigger re-review/i);
  assert.match(panel, /New substantive scope always resets to a full four-seat panel/i);
  assert.match(panel, /When the head is unchanged and the response is only a rebuttal, rerun the blocking seat/i);
  assert.match(skill, /full four-seat first wave completed.+every blocking finding.+cleared by its originating seat/s);
  assert.ok(![...remediationWave.matchAll(/agent:\s*"([^"]+)"/g)].map((match) => match[1]).includes("reviewer"));

  const staleHead = evals.evals.find(({ id }) => id === "edge-stale-head-evidence");
  assert.ok(staleHead);
  assert.match(staleHead.expected_output, /reruns reviewer-ponytail and reviewer-gpt/i);
  assert.match(staleHead.expected_output, /Does not rerun reviewer-claude or reviewer-security/i);

  for (const id of [
    "edge-sensitive-remediation-reruns-security",
    "edge-new-substantive-scope-full-panel",
    "edge-mechanical-rebase-does-not-repanel",
    "edge-combined-stack-starts-full-panel",
  ]) {
    assert.ok(evals.evals.some((entry) => entry.id === id), `missing ${id}`);
  }
});

test("blockers always, nits unless major effort", () => {
  assert.match(skill, /Fix every blocker\. Fix every nit/);
  assert.match(skill, /Never defer a blocker/);
  assert.match(skill, /When in doubt, include the nit/);
  assert.match(skill, /Defer a nit only if it would be a major level of effort/);
  assert.match(skill, /there is no follow-up PR chain/i);
  assert.match(skill, /File any major-effort nits per the Defer verdict, then deliver/);
  assert.match(skill, /beyond required blocker and nit fixes/);
  assert.match(skill, /\*\*Follow-ups\*\* — \[major-effort nits filed/);
  assert.match(panel, /every nit is fixed, rebutted, or filed as a major-effort follow-up/);
  assert.match(panel, /Do not rerun a non-blocking seat solely because it listed nits/);
  assert.doesNotMatch(skill, /Phase 6 chain/);
  assert.doesNotMatch(skill, /dominate this PR|own design\/direction/);
  assert.ok(evals.evals.some(({ id }) => id === "success-massive-follow-up-filed"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-nits-fixed-unless-massive"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-nits-block-merge"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-blockers-never-deferred"));
});

test("regular reviewer remains outside the panel and parent deslop", () => {
  const missingSeat = evals.evals.find(({ id }) => id === "edge-required-panel-seat-missing");
  assert.ok(missingSeat);
  assert.match(missingSeat.expected_output, /Stops and reports the missing reviewer-ponytail seat/);
  assert.match(missingSeat.expected_output, /Does not silently skip it, substitute regular reviewer/);

  const evalCase = evals.evals.find(({ id }) => id === "edge-regular-reviewer-not-panel-or-deslop-proxy");
  assert.ok(evalCase);
  assert.match(evalCase.prompt, /five Review agents/i);
  assert.match(evalCase.prompt, /deslop skill/i);
  assert.match(evalCase.expected_output, /Never adds regular reviewer/i);
  assert.match(evalCase.expected_output, /never uses it as a deslop proxy/i);
  assert.match(evalCase.expected_output, /Runs deslop in the parent/i);
  assert.match(evalCase.expected_output, /reviewer-gpt, reviewer-ponytail, reviewer-claude, and reviewer-security/i);
});
