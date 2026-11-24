import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillDir = fileURLToPath(new URL("../skills/visual-design/", import.meta.url));
const skill = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
const { evals } = JSON.parse(readFileSync(path.join(skillDir, "evals/evals.json"), "utf8"));
const triggers = JSON.parse(readFileSync(path.join(skillDir, "evals/trigger-evals.json"), "utf8"));

test("visual-design links its conditional references", () => {
  for (const file of [
    "references/art-direction-and-systems.md",
    "references/interactive-explanations.md",
    "references/delivery-and-packaging.md",
    "references/browser-qa-checklist.md",
  ]) {
    assert.ok(skill.includes(file), `missing entry-point link: ${file}`);
    assert.ok(existsSync(path.join(skillDir, file)), `missing resource: ${file}`);
  }
});

test("visual-design retains core behavioral and routing evaluation coverage", () => {
  const ids = new Set(evals.map(({ id }) => id));
  for (const id of [
    "interactive-brief-with-simulator-and-favicon",
    "daylight-web-app-adaptive-palette",
    "editorial-html-document-print-ready",
    "existing-design-system-respect",
    "browser-qa-catches-real-visual-defects",
  ]) {
    assert.ok(ids.has(id), `missing eval: ${id}`);
  }
  const positives = triggers.filter((entry) => entry.should_trigger === true);
  const negatives = triggers.filter((entry) => entry.should_trigger === false);
  assert.ok(positives.length >= 4, "expected at least 4 positive routing triggers");
  assert.ok(negatives.length >= 4, "expected at least 4 negative routing triggers");
});
