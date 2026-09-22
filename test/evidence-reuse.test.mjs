import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { evals } = JSON.parse(readFileSync(new URL("../skills/verification-before-completion/evals/evals.json", import.meta.url), "utf8"));

test("evidence validity, practical regression proof, and owner review scenarios remain in the behavioral corpus", () => {
  const ids = new Set(evals.map(({ id }) => id));
  assert.equal(ids.size, evals.length);
  for (const entry of evals) {
    assert.ok(entry.prompt.trim(), `missing prompt: ${entry.id}`);
    assert.ok(entry.expected_output.trim(), `missing expectation: ${entry.id}`);
  }
  for (const id of [
    "edge-reuse-full-suite-on-unchanged-tree",
    "edge-change-invalidates-reused-evidence",
    "edge-dirty-tree-not-reusable",
    "edge-environment-invalidates-reused-evidence",
    "edge-review-verdict-is-not-reusable",
    "success-default-does-not-start-review",
    "edge-regression-test-needs-ablation",
    "edge-authentic-red-green-is-ablation",
    "edge-security-risk-note-needs-verdict",
    "edge-informational-review-note-is-recorded",
  ]) assert.ok(ids.has(id), `missing eval: ${id}`);
});
