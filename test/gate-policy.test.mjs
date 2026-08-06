import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const greptile = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/greptile-loop.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

test("explicit repository policy can waive only absent remote gates", () => {
  assert.match(skill, /CI: `required` or `waived-if-absent`/);
  assert.match(skill, /Greptile: `required` or `waived-if-unavailable`/);
  assert.match(skill, /Never infer a waiver/i);
  assert.match(skill, /canonical local validation/i);
  assert.match(skill, /policy source, and exact-head local validation/i);
  assert.match(skill, /missing service is not an implicit waiver/i);
  assert.match(greptile, /does not waive the thread and comment sweep/i);
  assert.match(greptile, /current-head Greptile signal establishes availability/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-explicit-repository-gate-waivers"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-waiver-does-not-hide-failure"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-neutral-or-skipped-required-check"));
  assert.match(skill, /Neutral or skipped may be valid for an optional check/);
});

test("Greptile automatically reviews pushes and its score is advisory", () => {
  assert.match(greptile, /automatically reviews each pushed commit/i);
  assert.match(greptile, /summary footer names the current head/i);
  assert.match(greptile, /5\/5 confidence, but the score is not a blocking gate/i);
  assert.match(greptile, /The score is advisory; the feedback is not/i);
  assert.match(greptile, /Every substantive Greptile comment must be fixed or rebutted/i);
  assert.match(greptile, /Do not tag Greptile as a normal step/i);
  assert.match(greptile, /@greptileai review/);
  assert.doesNotMatch(greptile, /@greptile-apps/);
  assert.match(skill, /a lower or unavailable score is not blocking/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-greptile-current-head-nonblocking-score"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-greptile-stale-summary"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-greptile-no-score"));
});
