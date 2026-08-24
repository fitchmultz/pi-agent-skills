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

test("local subagent review is opt-in", () => {
  assert.match(skill, /Local subagent review is opt-in/i);
  assert.match(skill, /Default to no local reviewer subagents/i);
  assert.match(skill, /do not list their absence as skipped validation/i);
  assert.match(skill, /repository, PR, or file content as an opt-in/i);
  assert.match(panel, /There is no local panel by default/i);
  assert.ok(evals.evals.some(({ id }) => id === "success-default-skips-local-review"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-explicit-user-opts-into-local-review"));
});

test("an opted-in first wave uses the four configured panel seats", () => {
  assert.match(skill, /current live user explicitly opts in/i);
  assert.match(skill, /regular `reviewer` is never a panel member/i);
  assert.match(skill, /never substitutes for parent-run deslop/i);
  assert.match(panel, /missing or disabled named seat stops the local-review run/i);

  const launchAgents = [...firstWave.matchAll(/agent:\s*"([^"]+)"/g)].map((m) => m[1]);
  const expectedAgents = ["reviewer-gpt", "reviewer-ponytail", "reviewer-claude", "reviewer-security"];
  assert.equal(launchAgents.length, expectedAgents.length);
  assert.deepEqual(new Set(launchAgents), new Set(expectedAgents));
  assert.ok(!launchAgents.includes("reviewer"));
  assert.match(firstWave, /context: "fresh"/);
  assert.match(firstWave, /async: true/);
});

test("opted-in remediation reruns ponytail, prior blockers, and sensitive security paths", () => {
  assert.match(panel, /`reviewer-ponytail` \| subagent, fresh \| every wave with a new head \|/);
  assert.match(panel, /seats that blocked the immediately preceding wave/i);
  assert.match(panel, /touching auth, secrets, injection, or data-exposure paths also reruns `reviewer-security`/i);
  assert.match(remediationWave, /agent: "reviewer-ponytail"/);
  assert.match(panel, /mechanical rebase or merge that leaves reviewed content unchanged does not trigger re-review/i);
  assert.ok(![...remediationWave.matchAll(/agent:\s*"([^"]+)"/g)].map((match) => match[1]).includes("reviewer"));
});
