import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "skills/dogfood/scripts/vfr.py");
const python = spawnSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" }).stdout.trim();

function run(args, env = process.env) {
  return spawnSync(python, [script, ...args], { encoding: "utf8", env });
}

function fixture() {
  const runDir = realpathSync(mkdtempSync(path.join(tmpdir(), "dogfood-vfr-")));
  mkdirSync(path.join(runDir, "frames"));
  mkdirSync(path.join(runDir, "reports"));
  writeFileSync(path.join(runDir, "meta.txt"), "target=test\n");
  writeFileSync(path.join(runDir, "video.webm"), Buffer.alloc(2048));
  writeFileSync(path.join(runDir, "frames/render-check.png"), "png");
  writeFileSync(path.join(runDir, "frames/final.png"), "png");
  writeFileSync(path.join(runDir, "actions.ndjson"), '{"kind":"click","target":"Save"}\n');
  return runDir;
}

test("doctor fails before recording when ffmpeg is unavailable", () => {
  const emptyPath = mkdtempSync(path.join(tmpdir(), "dogfood-path-"));
  const probe = mkdtempSync(path.join(tmpdir(), "dogfood-probe-"));
  try {
    const result = run(["doctor", "--json", "--run-dir", probe], { ...process.env, PATH: emptyPath });
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert(report.errors.some(({ name }) => name === "ffmpeg"));
  } finally {
    rmSync(emptyPath, { recursive: true, force: true });
    rmSync(probe, { recursive: true, force: true });
  }
});

test("doctor rejects an ffmpeg executable that cannot run", { skip: process.platform === "win32" }, () => {
  const bin = mkdtempSync(path.join(tmpdir(), "dogfood-bin-"));
  const probe = mkdtempSync(path.join(tmpdir(), "dogfood-probe-"));
  const ffmpeg = path.join(bin, "ffmpeg");
  writeFileSync(ffmpeg, "#!/bin/sh\nexit 127\n");
  chmodSync(ffmpeg, 0o755);
  try {
    const result = run(["doctor", "--json", "--run-dir", probe], { ...process.env, PATH: bin });
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert(report.errors.some(({ name, detail }) => name === "ffmpeg" && detail.includes("exit 127")));
  } finally {
    rmSync(bin, { recursive: true, force: true });
    rmSync(probe, { recursive: true, force: true });
  }
});

test("contact-sheet and structural validation need no telemetry ceremony", { skip: process.platform === "win32" }, () => {
  const runDir = fixture();
  const bin = mkdtempSync(path.join(tmpdir(), "dogfood-bin-"));
  const expected = path.join(runDir, "reports/contact_ffmpeg_001.jpg");
  const fakeFfmpeg = path.join(bin, "ffmpeg");
  writeFileSync(fakeFfmpeg, `#!/bin/sh\ncase " $* " in *" -fps_mode "*) exit 9;; esac\ncase " $* " in *" -vsync vfr "*) ;; *) exit 10;; esac\nprintf jpg > '${expected}'\n`);
  chmodSync(fakeFfmpeg, 0o755);
  try {
    const contact = run(["contact-sheet", runDir], { ...process.env, PATH: bin });
    assert.equal(contact.status, 0, contact.stderr);
    assert.deepEqual(JSON.parse(contact.stdout).contactSheets, [expected]);

    const valid = run(["validate", runDir]);
    assert.equal(valid.status, 0, valid.stderr);
    const report = JSON.parse(valid.stdout);
    assert.equal(report.ok, true);
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.contact_sheets, 1);
    assert.equal(report.evidence_readiness.status, "ready");
    assert.equal("confidence" in report, false);

    rmSync(expected);
    const invalid = run(["validate", runDir]);
    assert.equal(invalid.status, 2);
    assert(JSON.parse(invalid.stdout).errors.some((error) => error.includes("no nonempty regular contact sheets")));

    writeFileSync(expected, "");
    writeFileSync(path.join(runDir, "frames/render-check.png"), "");
    const empty = run(["validate", runDir]);
    assert.equal(empty.status, 2);
    const emptyReport = JSON.parse(empty.stdout);
    assert(emptyReport.errors.some((error) => error.includes("nonempty regular file: render-check")));
    assert(emptyReport.errors.some((error) => error.includes("no nonempty regular contact sheets")));
  } finally {
    rmSync(bin, { recursive: true, force: true });
    rmSync(runDir, { recursive: true, force: true });
  }
});
