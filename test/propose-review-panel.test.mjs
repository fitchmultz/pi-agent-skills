import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skillDir = new URL("../skills/propose-then-ship-pi/", import.meta.url);
const skill = readFileSync(new URL("SKILL.md", skillDir), "utf8");
const panel = readFileSync(new URL("references/review-panel.md", skillDir), "utf8");
const { evals } = JSON.parse(readFileSync(new URL("evals/evals.json", skillDir), "utf8"));

test("shipping links its review reference and available role catalog", () => {
  assert.ok(skill.includes("references/review-panel.md"));
  const roles = [...panel.matchAll(/^\| `(reviewer-[^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(roles.sort(), ["reviewer-gpt", "reviewer-ponytail", "reviewer-claude", "reviewer-security"].sort());
});

test("required-review mirrors preserve independent work and merge requirements", () => {
  const missingReview = panel.split(/\n\n/).find((paragraph) => /required reviewer.*unavailable/i.test(paragraph));
  assert.match(missingReview, /report .*missing review.*continue independent authorized work/i);
  assert.match(missingReview, /do not silently substitute or skip/i);
  const validation = skill.split("## Phase 4:")[1].split("## Phase 5:")[0];
  assert.match(validation, /required review.*reported.*independent authorized work continues/i);
  assert.match(validation.split("### Exit gate")[1], /Requested\/standing reviews completed/i);
  assert.doesNotMatch(skill, /required first wave|missing or disabled requested panel seat is a stop-and-report condition|an explicitly required local panel seat is unavailable/i);
  const scenario = evals.find(({ id }) => id === "edge-explicit-required-reviewer-unavailable");
  assert.match(scenario.prompt, /explicitly requires reviewer-ponytail/i);
  assert.match(scenario.expected_output, /Continues independent authorized work/i);
  assert.match(scenario.expected_output, /does not claim required review coverage or merge readiness until the requirement is satisfied or the user changes it/i);
});

test("requested reviews, affected analysis, and owner rebuttals retain behavioral cases", () => {
  const ids = new Set(evals.map(({ id }) => id));
  for (const id of [
    "success-default-skips-local-review",
    "edge-explicit-user-opts-into-local-review",
    "edge-required-panel-seat-missing",
    "edge-explicit-required-reviewer-unavailable",
    "edge-regular-reviewer-not-panel-or-deslop-proxy",
    "edge-stale-head-evidence",
    "edge-sensitive-remediation-reruns-security",
    "edge-new-substantive-scope-full-panel",
    "edge-combined-stack-starts-full-panel",
    "edge-mechanical-rebase-does-not-repanel",
    "edge-mechanical-sync-carries-ux-verdict",
    "edge-security-risk-note-is-evidence-triaged",
    "edge-rebutted-security-finding-cleared-by-owner",
    "edge-security-residual-risk-rerun-terminates",
    "edge-reviewer-timeout-not-signoff",
  ]) assert.ok(ids.has(id), `missing eval: ${id}`);
});
