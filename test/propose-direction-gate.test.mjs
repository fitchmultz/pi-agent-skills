import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(path.join(root, "skills/propose-then-ship-pi/SKILL.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(root, "skills/propose-then-ship-pi/evals/evals.json"), "utf8"));

test("a direction returned by ask_question resumes the same run", () => {
  assert.match(skill, /`ask_question` returns the answer into the same assistant turn/);
  assert.match(skill, /continue immediately through Phase 2 into Phase 3/);
  assert.match(skill, /Do not end the turn after this restatement/);
  assert.match(skill, /action trigger, not a reporting checkpoint/);
  assert.doesNotMatch(skill, /\*\*Stop\.\*\* Do not implement/);
  assert.ok(evals.evals.some(({ id }) => id === "success-ask-question-approval-resumes-same-turn"));
});
