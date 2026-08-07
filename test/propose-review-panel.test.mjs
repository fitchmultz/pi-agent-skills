import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const panel = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/review-panel.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

test("regular reviewer is never panel guidance or a deslop proxy", () => {
  assert.match(skill, /version: "1\.3\.0"/);
  assert.match(skill, /regular `reviewer` is never a panel member/i);
  assert.match(skill, /never substitutes for parent-run deslop/i);
  assert.match(panel, /Regular `reviewer` is never a panel member and never substitutes for deslop/);
  assert.match(panel, /Deslop runs in the parent only/);
  assert.match(panel, /does not add it to this panel/);

  const launchAgents = [...panel.matchAll(/agent:\s*"([^"]+)"/g)].map((m) => m[1]);
  const expectedAgents = ["reviewer-gpt", "reviewer-security", "reviewer-claude"];
  assert.equal(launchAgents.length, expectedAgents.length);
  assert.deepEqual(new Set(launchAgents), new Set(expectedAgents));
  assert.ok(!launchAgents.includes("reviewer"));

  // reviewer-gpt is unconditional; security/claude stay conditional on documented triggers
  assert.match(panel, /\| `reviewer-gpt` \| subagent, fresh \| always \|/);
  assert.match(panel, /\| `reviewer-security` \| subagent, fresh \| on any trust boundary \|/);
  assert.match(panel, /\| `reviewer-claude` \| subagent, fresh \| on real blast radius \|/);
  assert.match(panel, /\/\/ conditional: include when the change touches a trust boundary\s*\n\s*\{ agent: "reviewer-security"/);
  assert.match(panel, /\/\/ conditional: include when the change carries real blast radius\s*\n\s*\{ agent: "reviewer-claude"/);
  assert.match(
    panel,
    /only `reviewer-gpt`, deslop, and the evidence gate are unconditional/,
  );

  const evalCase = evals.evals.find(({ id }) => id === "edge-regular-reviewer-not-panel-or-deslop-proxy");
  assert.ok(evalCase);
  assert.match(evalCase.prompt, /four Review agents/i);
  assert.match(evalCase.prompt, /deslop skill/i);
  assert.match(evalCase.expected_output, /Never adds regular reviewer/i);
  assert.match(evalCase.expected_output, /never uses it as a deslop proxy/i);
  assert.match(evalCase.expected_output, /Runs deslop in the parent/i);
  assert.match(evalCase.expected_output, /reviewer-gpt always/i);
  assert.match(evalCase.expected_output, /reviewer-security on trust boundaries/i);
  assert.match(evalCase.expected_output, /reviewer-claude on real blast radius/i);
});
