import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = path.join(root, "skills");
const expectedSkills = [
  "ask-clarifying-questions",
  "bro",
  "deslop",
  "diagram-creation",
  "dogfood",
  "handoff",
  "pi-extension-development",
  "propose-then-ship-pi",
  "tdd",
  "thermo-nuclear-code-quality-review",
  "ux-review",
  "verification-before-completion",
];

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

test("package exposes the source-managed skills", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(manifest.pi.skills, ["./skills"]);
  assert.equal(manifest.private, true);
  assert.equal(manifest.version, "0.4.7");
  assert.equal(manifest.devDependencies["@earendil-works/pi-coding-agent"], "0.84.0");
  assert.deepEqual(readdirSync(skillsDir).sort(), expectedSkills);
});

test("bundled skills have valid source surfaces", () => {
  for (const skill of expectedSkills) {
    const dir = path.join(skillsDir, skill);
    const source = readFileSync(path.join(dir, "SKILL.md"), "utf8");
    assert.match(source, new RegExp(`^---\\nname: ${skill}\\n`));
    assert.match(source, /\ndescription: .+\n/);

    for (const file of filesUnder(dir)) {
      assert.notEqual(path.basename(file), ".DS_Store");
      if (file.endsWith(".json")) JSON.parse(readFileSync(file, "utf8"));
      if (/\.(?:py|sh)$/.test(file)) assert.notEqual(statSync(file).mode & 0o111, 0, `${file} must be executable`);
      if (/\.(?:js|json|md|mjs|py|sh|ya?ml)$/.test(file)) {
        const text = readFileSync(file, "utf8");
        assert.doesNotMatch(text, /\/Users\/mitchfultz/);
        assert.doesNotMatch(text, /~\/\.agents\/skills\//);
      }
    }
  }
});
