import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const greptile = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/greptile-loop.md"), "utf8");
const mergeGate = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/merge-gate.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

test("explicit repository policy can waive only absent CI", () => {
  assert.match(skill, /CI: `required` or `waived-if-absent`/);
  assert.match(skill, /Never infer a waiver/i);
  assert.match(skill, /canonical local validation/i);
  assert.match(skill, /policy source, and exact-head local validation/i);
  assert.match(skill, /Missing CI is not an implicit waiver/i);
  assert.ok(evals.evals.some(({ id }) => id === "edge-explicit-repository-gate-waivers"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-waiver-does-not-hide-failure"));
  assert.ok(evals.evals.some(({ id }) => id === "edge-neutral-or-skipped-required-check"));
  assert.match(skill, /Neutral or skipped may be valid for an optional check/);
});

test("Greptile is automatic feedback, never a merge gate", () => {
  assert.match(skill, /never a merge gate/i);
  assert.match(skill, /Never wait for it, poll it, trigger it/i);
  assert.match(skill, /Fix or rebut comments already present/i);
  assert.doesNotMatch(skill, /Greptile: `required`/);
  assert.doesNotMatch(skill, /summary footer identifies the current head/);
  assert.match(greptile, /reviews and comments automatically/i);
  assert.match(greptile, /proceed without waiting/i);
  assert.match(mergeGate, /never wait for acknowledgment or re-review/i);
  const unavailable = evals.evals.find(({ id }) => id === "edge-greptile-unavailable");
  const stale = evals.evals.find(({ id }) => id === "edge-greptile-stale-summary");
  assert.match(unavailable.expected_output, /does not affect readiness/i);
  assert.match(stale.expected_output, /does not wait/i);
});
