import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillDir = fileURLToPath(new URL("../skills/visual-design/", import.meta.url));
const skillPath = path.join(skillDir, "SKILL.md");
const skill = readFileSync(skillPath, "utf8");
const { evals } = JSON.parse(readFileSync(path.join(skillDir, "evals/evals.json"), "utf8"));
const triggers = JSON.parse(readFileSync(path.join(skillDir, "evals/trigger-evals.json"), "utf8"));

test("visual-design links its conditional references and stays concise", () => {
  const lines = skill.split("\n").length;
  assert.ok(lines < 500, `SKILL.md should stay below 500 lines (got ${lines})`);
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

test("visual-design markdown links and heading anchors resolve", () => {
  const markdown = readdirSync(skillDir, { recursive: true }).filter((file) => file.endsWith(".md"));
  const slugs = (file) => new Set(
    [...readFileSync(file, "utf8").matchAll(/^#{1,6} +(.+)$/gm)]
      .map(([, heading]) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replaceAll(" ", "-")),
  );
  let links = 0;
  for (const file of markdown) {
    const source = path.join(skillDir, file);
    for (const [, target] of readFileSync(source, "utf8").matchAll(/\]\((?!https?:)([^)\s]+)\)/g)) {
      const [relative, anchor] = target.split("#");
      const linked = relative ? path.resolve(path.dirname(source), relative) : source;
      assert.ok(existsSync(linked), `${file}: missing link target ${target}`);
      if (anchor) assert.ok(slugs(linked).has(anchor), `${file}: missing heading ${target}`);
      links += 1;
    }
  }
  assert.ok(links > 0, "no relative links found");
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
  assert.ok(Array.isArray(triggers) && triggers.length >= 8, "expected positive and negative routing triggers");
  const positives = triggers.filter((entry) => entry.should_trigger === true);
  const negatives = triggers.filter((entry) => entry.should_trigger === false);
  assert.ok(positives.length >= 4, "expected at least 4 positive routing triggers");
  assert.ok(negatives.length >= 4, "expected at least 4 negative routing triggers");
  for (const entry of triggers) {
    assert.equal(typeof entry.query, "string");
    assert.ok(entry.query.trim().length > 0, "trigger query must be non-empty");
    assert.equal(typeof entry.should_trigger, "boolean");
    assert.equal(typeof entry.reason, "string");
    assert.ok(entry.reason.trim().length > 0, "trigger reason must be non-empty");
  }
});
