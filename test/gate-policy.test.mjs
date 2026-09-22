import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const skillDir = new URL("../skills/propose-then-ship-pi/", import.meta.url);
const skill = readFileSync(new URL("SKILL.md", skillDir), "utf8");
const { evals } = JSON.parse(readFileSync(new URL("evals/evals.json", skillDir), "utf8"));

test("shipping links the CI, advisory-feedback, and merge mechanics", () => {
  for (const file of ["references/ci-watch.md", "references/greptile-loop.md", "references/merge-gate.md"]) {
    assert.ok(skill.includes(file), `unreachable reference: ${file}`);
    assert.ok(existsSync(new URL(file, skillDir)), `missing reference: ${file}`);
  }
});

test("absent-CI and advisory-Greptile cases remain in the behavioral corpus", () => {
  const ids = new Set(evals.map(({ id }) => id));
  for (const id of [
    "edge-explicit-repository-gate-waivers",
    "edge-waiver-does-not-hide-failure",
    "edge-greptile-unavailable",
    "edge-greptile-check-still-running",
    "edge-greptile-no-check-run",
    "edge-greptile-newest-comment-has-no-score",
    "edge-no-gate-weakening",
    "edge-long-ci-poll-uses-tools",
  ]) assert.ok(ids.has(id), `missing eval: ${id}`);
});
