import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { evals } = JSON.parse(readFileSync(new URL("../skills/propose-then-ship-pi/evals/evals.json", import.meta.url), "utf8"));

test("direction, authority, and prerequisite scenarios remain available to behavioral evaluation", () => {
  const ids = new Set(evals.map(({ id }) => id));
  assert.equal(ids.size, evals.length);
  for (const entry of evals) {
    assert.ok(entry.prompt.trim(), `missing prompt: ${entry.id}`);
    assert.ok(entry.expected_output.trim(), `missing expectation: ${entry.id}`);
  }
  for (const id of [
    "success-stops-at-gate",
    "success-ask-question-approval-resumes-same-turn",
    "edge-wait-override",
    "edge-required-delivery-action-excluded",
    "edge-personal-pr-needs-no-second-confirmation",
    "edge-merge-triggered-publication-needs-preauthorization",
    "edge-question-dialog-unavailable",
    "edge-historical-authorization-is-not-portable",
    "edge-worktree-cwd-with-optional-extension",
  ]) assert.ok(ids.has(id), `missing eval: ${id}`);
});
