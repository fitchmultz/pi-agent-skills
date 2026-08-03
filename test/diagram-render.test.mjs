import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

function render(args, env = {}) {
  return spawnSync(script, args, { encoding: "utf8", env: { ...process.env, ...env } });
}

test("renderer creates a 980px preview and overlapping native crops", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-review-test-"));
  try {
    const input = path.join(tmp, "flow.d2");
    const output = path.join(tmp, "flow");
    const review = path.join(tmp, "review");
    writeFileSync(input, "a -> b\n");

    const result = render([
      "--zoom", "1.5", "--crop-size", "100", "--crop-overlap", "20",
      "--review-dir", review, input, output,
    ]);
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

test("renderer rejects unsafe destinations before replacing outputs", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-path-test-"));
  try {
    const input = path.join(tmp, "flow.d2");
    writeFileSync(input, "a -> b\n");

    const output = path.join(tmp, "stable", "flow");
    mkdirSync(path.dirname(output));
    writeFileSync(`${output}.svg`, "old svg");
    writeFileSync(`${output}.png`, "old png");
    const blockedParent = path.join(tmp, "blocked-parent");
    writeFileSync(blockedParent, "not a directory");
    const publicationFailure = render([
      "--review-dir", path.join(blockedParent, "review"), input, output,
    ]);
    assert.notEqual(publicationFailure.status, 0);
    assert.equal(readFileSync(`${output}.svg`, "utf8"), "old svg");
    assert.equal(readFileSync(`${output}.png`, "utf8"), "old png");

    const collision = path.join(tmp, "collision");
    const overlapFailure = render([
      "--review-dir", collision, input, path.join(collision, "flow"),
    ]);
    assert.notEqual(overlapFailure.status, 0);
    assert.match(overlapFailure.stderr, /must not equal, contain/);
    assert.equal(existsSync(path.join(collision, "flow.svg")), false);

    const poisonedOutput = path.join(tmp, "poisoned");
    const poisonedFailure = render([
      "--review-dir", path.join(`${poisonedOutput}.png`, "review"), input, poisonedOutput,
    ]);
    assert.notEqual(poisonedFailure.status, 0);
    assert.match(poisonedFailure.stderr, /sit beneath a final output path/);
    assert.equal(existsSync(`${poisonedOutput}.png`), false);

    const caseProbe = path.join(tmp, "CaseProbe");
    writeFileSync(caseProbe, "probe");
    if (existsSync(path.join(tmp, "caseprobe"))) {
      for (const [outputName, reviewName] of [
        ["Flow", "flow"],
        ["É", "é"],
        ["É", "e\u0301"],
      ]) {
        const caseOutput = path.join(tmp, outputName);
        const caseFailure = render(
          ["--review-dir", path.join(tmp, `${reviewName}.svg`, "review"), input, caseOutput],
          { LC_ALL: "C" },
        );
        assert.notEqual(caseFailure.status, 0);
        assert.match(caseFailure.stderr, /overlaps a final output path on this filesystem/);
        assert.equal(existsSync(`${caseOutput}.svg`), false);
        assert.equal(existsSync(path.join(tmp, `${reviewName}.svg`)), false);
      }
    }

    const directoryOutput = path.join(tmp, "directory-output");
    mkdirSync(`${directoryOutput}.svg`);
    const directoryFailure = render(["--no-review-images", input, directoryOutput]);
    assert.notEqual(directoryFailure.status, 0);
    assert.match(directoryFailure.stderr, /regular file or absent/);
    assert.equal(existsSync(path.join(`${directoryOutput}.svg`, "render.svg")), false);

    const symlinkTarget = path.join(tmp, "symlink-target");
    const symlinkOutput = path.join(tmp, "symlink-output");
    mkdirSync(symlinkTarget);
    symlinkSync(symlinkTarget, `${symlinkOutput}.svg`, "dir");
    const symlinkFailure = render(["--no-review-images", input, symlinkOutput]);
    assert.notEqual(symlinkFailure.status, 0);
    assert.match(symlinkFailure.stderr, /regular file or absent/);

    const noReviewOutput = path.join(tmp, "no-review");
    const noReview = render(["--no-review-images", input, noReviewOutput]);
    assert.equal(noReview.status, 0, `${noReview.stdout}\n${noReview.stderr}`);
    assert.equal(existsSync(`${noReviewOutput}.svg`), true);
    assert.equal(existsSync(`${noReviewOutput}.png`), true);
    assert.doesNotMatch(noReview.stdout, /Review directory:/);

    const leadingZero = render([
      "--crop-overlap", "08", "--no-review-images", input, path.join(tmp, "zero"),
    ]);
    assert.notEqual(leadingZero.status, 0);
    assert.match(leadingZero.stderr, /non-negative integer/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("allocation signals cannot strand temporary or review directories", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-allocation-test-"));
  try {
    const fakeBin = path.join(tmp, "bin");
    mkdirSync(fakeBin);
    const findParent = `find_renderer_parent() {
  pid=$PPID
  while [ "$pid" -gt 1 ]; do
    command=$(/bin/ps -o command= -p "$pid")
    case "$command" in
      *render_diagram.sh*) printf '%s\\n' "$pid"; return 0 ;;
    esac
    pid=$(/bin/ps -o ppid= -p "$pid" | /usr/bin/tr -d ' ')
  done
  return 1
}
`;
    const fakeMktemp = path.join(fakeBin, "mktemp");
    writeFileSync(fakeMktemp, `#!/bin/sh
${findParent}
allocated=$(/usr/bin/mktemp "$@") || exit $?
printf '%s\\n' "$allocated"
case "$*" in
  *diagram-review*|*diagram-render*|*.diagram-publish*|*.diagram-backup*)
    count=0
    [ ! -f "$ALLOC_COUNT_FILE" ] || count=$(cat "$ALLOC_COUNT_FILE")
    count=$((count + 1))
    printf '%s\\n' "$count" >"$ALLOC_COUNT_FILE"
    if [ "$count" = "$INTERRUPT_AT" ]; then
      : >"$ALLOC_INTERRUPT_MARKER"
      target=$(find_renderer_parent) || exit 90
      /bin/kill -TERM "$target"
      sleep 0.1
    fi
    ;;
esac
`);
    chmodSync(fakeMktemp, 0o755);

    for (const boundary of [1, 2, 3, 4]) {
      const scenario = path.join(tmp, `temp-boundary-${boundary}`);
      mkdirSync(scenario);
      const input = path.join(scenario, "flow.d2");
      const output = path.join(scenario, "flow");
      writeFileSync(input, "a -> b\n");
      const result = render(
        [input, output],
        {
          PATH: `${fakeBin}:${process.env.PATH}`,
          TMPDIR: scenario,
          INTERRUPT_AT: String(boundary),
          ALLOC_COUNT_FILE: path.join(scenario, "allocation-count"),
          ALLOC_INTERRUPT_MARKER: path.join(scenario, "interrupted"),
        },
      );
      assert.equal(result.status, 0, `boundary ${boundary}: ${result.stdout}\n${result.stderr}`);
      assert.equal(existsSync(path.join(scenario, "interrupted")), true);
      const review = result.stdout.match(/^Review directory: (.+)$/m)?.[1];
      assert.ok(review);
      rmSync(review, { recursive: true, force: true });
      assert.deepEqual(
        readdirSync(scenario).filter((file) => file.startsWith(".diagram-") || file.startsWith("diagram-render.")),
        [],
      );
    }

    const custom = path.join(tmp, "custom-review");
    mkdirSync(custom);
    const customInput = path.join(custom, "flow.d2");
    const customOutput = path.join(custom, "flow");
    const customReview = path.join(custom, "nested", "review");
    writeFileSync(customInput, "a -> b\n");
    const fakeMkdir = path.join(fakeBin, "mkdir");
    writeFileSync(fakeMkdir, `#!/bin/sh
${findParent}
/bin/mkdir "$@"
status=$?
if [ "$status" -eq 0 ] && [ "$#" -eq 1 ] && [ "$1" = "$ALLOC_REVIEW_DIR" ]; then
  : >"$ALLOC_INTERRUPT_MARKER"
  target=$(find_renderer_parent) || exit 90
  /bin/kill -TERM "$target"
  sleep 0.1
fi
exit "$status"
`);
    chmodSync(fakeMkdir, 0o755);
    const customResult = render(
      ["--review-dir", customReview, customInput, customOutput],
      {
        PATH: `${fakeBin}:${process.env.PATH}`,
        ALLOC_REVIEW_DIR: customReview,
        ALLOC_INTERRUPT_MARKER: path.join(custom, "interrupted"),
      },
    );
    assert.equal(customResult.status, 0, `${customResult.stdout}\n${customResult.stderr}`);
    assert.equal(existsSync(path.join(custom, "interrupted")), true);
    assert.equal(existsSync(customReview), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("transaction rollback survives interruption after every rename", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-interrupt-test-"));
  try {
    const fakeBin = path.join(tmp, "bin");
    mkdirSync(fakeBin);
    const fakeMv = path.join(fakeBin, "mv");
    writeFileSync(fakeMv, `#!/bin/sh
count=0
[ ! -f "$MV_COUNT_FILE" ] || count=$(cat "$MV_COUNT_FILE")
count=$((count + 1))
printf '%s\n' "$count" >"$MV_COUNT_FILE"
/bin/mv "$@"
status=$?
if [ "$status" -eq 0 ] && [ "$count" = "$INTERRUPT_AT" ] && [ ! -e "$MV_INTERRUPT_MARKER" ]; then
  : >"$MV_INTERRUPT_MARKER"
  kill -TERM "$PPID"
  sleep 0.1
fi
exit "$status"
`);
    chmodSync(fakeMv, 0o755);

    for (const boundary of [1, 2, 3, 4]) {
      const scenario = path.join(tmp, `boundary-${boundary}`);
      mkdirSync(scenario);
      const input = path.join(scenario, "flow.d2");
      const output = path.join(scenario, "flow");
      const review = path.join(scenario, "review");
      writeFileSync(input, "a -> b\n");
      writeFileSync(`${output}.svg`, `old svg ${boundary}`);
      writeFileSync(`${output}.png`, `old png ${boundary}`);
      const result = render(
        ["--review-dir", review, input, output],
        {
          PATH: `${fakeBin}:${process.env.PATH}`,
          INTERRUPT_AT: String(boundary),
          MV_COUNT_FILE: path.join(scenario, "mv-count"),
          MV_INTERRUPT_MARKER: path.join(scenario, "interrupted"),
        },
      );
      assert.notEqual(result.status, 0, `boundary ${boundary}`);
      assert.equal(readFileSync(`${output}.svg`, "utf8"), `old svg ${boundary}`);
      assert.equal(readFileSync(`${output}.png`, "utf8"), `old png ${boundary}`);
      assert.equal(existsSync(review), false);
      assert.deepEqual(readdirSync(scenario).filter((file) => file.startsWith(".diagram-")), []);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("final publication rolls both outputs back when the second rename fails", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-transaction-test-"));
  try {
    const input = path.join(tmp, "flow.d2");
    const output = path.join(tmp, "flow");
    const review = path.join(tmp, "review");
    writeFileSync(input, "a -> b\n");
    writeFileSync(`${output}.svg`, "old svg");
    writeFileSync(`${output}.png`, "old png");

    const fakeBin = path.join(tmp, "bin");
    mkdirSync(fakeBin);
    const fakeMv = path.join(fakeBin, "mv");
    writeFileSync(fakeMv, `#!/bin/sh
case "$1" in
  */.diagram-publish.*/render.png)
    [ "$2" != "$FAIL_DEST" ] || exit 73
    ;;
esac
exec /bin/mv "$@"
`);
    chmodSync(fakeMv, 0o755);

    const result = render(
      ["--review-dir", review, input, output],
      { PATH: `${fakeBin}:${process.env.PATH}`, FAIL_DEST: `${output}.png` },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /previous final outputs restored/);
    assert.equal(readFileSync(`${output}.svg`, "utf8"), "old svg");
    assert.equal(readFileSync(`${output}.png`, "utf8"), "old png");
    assert.equal(existsSync(review), false);
    assert.deepEqual(readdirSync(tmp).filter((file) => file.startsWith(".diagram-")), []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
