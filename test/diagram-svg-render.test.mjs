import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, truncateSync, writeFileSync } from "node:fs";
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
    truncateSync(truncated, readFileSync(truncated).length - 1);
    const rejected = spawnSync(process.execPath, [verifier, truncated], { encoding: "utf8" });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /truncated PNG chunk (?:data|header)/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("SVG review publication failure preserves the prior final PNG", { skip: !toolsAvailable }, () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "diagram-svg-publication-test-"));
  try {
    const input = path.join(tmp, "flow.svg");
    const output = path.join(tmp, "flow.png");
    const review = path.join(tmp, "review");
    const oldOutput = Buffer.from("old svg-native png\n");
    writeFileSync(input, '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#111827"/></svg>');
    writeFileSync(output, oldOutput);

    const fakeBin = path.join(tmp, "bin");
    mkdirSync(fakeBin);
    const fakeInstall = path.join(fakeBin, "install");
    writeFileSync(fakeInstall, `#!/usr/bin/env bash
set -euo pipefail
destination=\${!#}
if [[ "$destination" == "$TEST_FAIL_REVIEW_DIR/"* ]]; then
  : > "$TEST_INSTALL_FAILURE_MARKER"
  exit 91
fi
exec "$REAL_INSTALL" "$@"
`);
    chmodSync(fakeInstall, 0o755);

    const result = spawnSync("env", ["-u", "BASH_ENV", renderer, "--review-dir", review, input, output], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        REAL_INSTALL: spawnSync("sh", ["-c", "command -v install"], { encoding: "utf8" }).stdout.trim(),
        TEST_FAIL_REVIEW_DIR: review,
        TEST_INSTALL_FAILURE_MARKER: path.join(tmp, "install-failed"),
      },
    });
    assert.equal(result.status, 91, `${result.stdout}\n${result.stderr}`);
    assert.equal(existsSync(path.join(tmp, "install-failed")), true);
    assert.deepEqual(readFileSync(output), oldOutput);
    assert.equal(existsSync(review), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
