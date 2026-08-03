import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "skills/diagram-creation/scripts/render_diagram.sh");
const toolsAvailable = ["d2", "rsvg-convert"].every((command) =>
  spawnSync("sh", ["-c", `command -v ${command}`]).status === 0,
);

function pngDimensions(file) {
  const bytes = readFileSync(file);
  assert.deepEqual([...bytes.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("renderer creates a 980px preview and overlapping native crops", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-review-test-"));
  try {
    const input = path.join(tmp, "flow.d2");
    const output = path.join(tmp, "flow");
    const review = path.join(tmp, "review");
    writeFileSync(input, "a -> b\n");

    const result = spawnSync(
      script,
      ["--crop-size", "100", "--crop-overlap", "20", "--review-dir", review, input, output],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    assert.equal(pngDimensions(path.join(review, "preview-980.png")).width, 980);
    const native = pngDimensions(`${output}.png`);
    const crops = readdirSync(review).filter((file) => file.startsWith("crop-")).sort();
    assert.ok(crops.length > 1);

    const rectangles = crops.map((file) => {
      const match = file.match(/^crop-r\d+-c\d+-x(\d+)-y(\d+)-(\d+)x(\d+)\.png$/);
      assert.ok(match, file);
      const [, x, y, width, height] = match.map(Number);
      assert.deepEqual(pngDimensions(path.join(review, file)), { width, height });
      assert.ok(width <= 100 && height <= 100);
      return { x, y, width, height };
    });
    assert.ok(rectangles.some(({ x, y }) => x === 0 && y === 0));
    assert.equal(Math.max(...rectangles.map(({ x, width }) => x + width)), native.width);
    assert.equal(Math.max(...rectangles.map(({ y, height }) => y + height)), native.height);
    const xs = [...new Set(rectangles.map(({ x }) => x))].sort((a, b) => a - b);
    const ys = [...new Set(rectangles.map(({ y }) => y))].sort((a, b) => a - b);
    assert.ok(xs.slice(1).every((x, index) => x - xs[index] < 100));
    assert.ok(ys.slice(1).every((y, index) => y - ys[index] < 100));
    assert.match(result.stdout, /Preview \(980px\):/);
    assert.match(result.stdout, /Native crops:/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
