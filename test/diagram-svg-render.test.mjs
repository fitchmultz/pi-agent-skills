import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const renderer = path.join(root, "skills/diagram-creation/scripts/render_svg.sh");
const verifier = path.join(root, "skills/diagram-creation/scripts/verify_png.mjs");
const toolsAvailable = spawnSync("sh", ["-c", "command -v rsvg-convert"]).status === 0;

test("SVG renderer creates verified review images and rejects truncated PNGs", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-svg-render-test-"));
  try {
    const input = path.join(tmp, "flow.svg");
    const output = path.join(tmp, "flow.png");
    const review = path.join(tmp, "review");
    writeFileSync(input, '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#111827"/><text x="12" y="44" fill="white">flow</text></svg>');

    const rendered = spawnSync(renderer, ["--preview-width", "60", "--review-dir", review, input, output], { encoding: "utf8" });
    assert.equal(rendered.status, 0, `${rendered.stdout}\n${rendered.stderr}`);
    assert.ok(readFileSync(output).length > 8);
    assert.deepEqual(readdirSync(review).sort(), ["crop-r01-c01-x0-y0-240x160.png", "preview-60.png"]);

    const truncated = path.join(tmp, "truncated.png");
    writeFileSync(truncated, readFileSync(output));
    truncateSync(truncated, readFileSync(truncated).length - 16);
    const rejected = spawnSync(process.execPath, [verifier, truncated], { encoding: "utf8" });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /truncated PNG chunk data/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
