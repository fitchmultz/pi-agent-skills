import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

test("video analysis flags all-blank recordings while preserving startup suppression", () => {
  const result = spawnSync(python, ["-B", "-c", `
import runpy
import sys

analyzer = runpy.run_path(sys.argv[1])
sys.argv = ["analyze-video.py", "--video", "unused", "--out-dir", "unused"]
args = analyzer["parse_args"]()
Sample = analyzer["Sample"]

def samples(means):
    return [
        Sample(i, i * 30, float(i), mean, 0.0 if mean in (0, 255) else 20.0,
               0.0, 1.0, None, None)
        for i, mean in enumerate(means)
    ]

for mean, kind in [(255, "white_blank"), (0, "black_blank")]:
    blank = samples([mean] * 10)
    assert analyzer["initial_blank_sample_ids"](blank, args) == set(), kind
    assert [finding[1] for finding in analyzer["detect_anomalies"](blank, args)] == [kind] * 10

    startup = samples([mean, mean, 128, 128, mean])
    assert analyzer["initial_blank_sample_ids"](startup, args) == {0, 1, 2}
    findings = analyzer["detect_anomalies"](startup, args)
    assert [(sample.idx, detected) for sample, detected, _ in findings] == [(4, kind)]
`, path.join(root, "skills/dogfood/scripts/analyze-video.py")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

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

test("doctor rejects ffmpeg without -fps_mode support", { skip: process.platform === "win32" }, () => {
  const bin = mkdtempSync(path.join(tmpdir(), "dogfood-bin-"));
  const probe = mkdtempSync(path.join(tmpdir(), "dogfood-probe-"));
  const ffmpeg = path.join(bin, "ffmpeg");
  writeFileSync(ffmpeg, "#!/bin/sh\ncase \" $* \" in *\" -version \"*) echo 'ffmpeg version 4.4.2';; *) echo 'full help without fps mode';; esac\n");
  chmodSync(ffmpeg, 0o755);
  try {
    const result = run(["doctor", "--json", "--run-dir", probe], { ...process.env, PATH: bin });
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert(report.errors.some(({ name, detail }) => name === "ffmpeg" && detail.includes("-fps_mode")));
  } finally {
    rmSync(bin, { recursive: true, force: true });
    rmSync(probe, { recursive: true, force: true });
  }
});

test("failed contact-sheet retry preserves earlier images; validation needs no telemetry", { skip: process.platform === "win32" }, () => {
  const runDir = fixture();
  const bin = mkdtempSync(path.join(tmpdir(), "dogfood-bin-"));
  const expected = path.join(runDir, "reports/contact_ffmpeg_001.jpg");
  const fakeFfmpeg = path.join(bin, "ffmpeg");
  writeFileSync(fakeFfmpeg, `#!/bin/sh
case " $* " in *" -vsync "*) exit 9;; esac
case " $* " in *" -fps_mode vfr "*) ;; *) exit 10;; esac
for arg do output=$arg; done
if [ "\${MOCK_FFMPEG_FAIL:-}" = 1 ]; then
  printf partial > "\${output%/*}/contact_ffmpeg_001.jpg"
  echo 'decode error' >&2
  exit 1
fi
printf jpg > "\${output%/*}/contact_ffmpeg_001.jpg"
`);
  chmodSync(fakeFfmpeg, 0o755);
  try {
    const contact = run(["contact-sheet", runDir], { ...process.env, PATH: bin });
    assert.equal(contact.status, 0, contact.stderr);
    assert.deepEqual(JSON.parse(contact.stdout).contactSheets, [expected]);

    const failed = run(["contact-sheet", runDir], { ...process.env, PATH: bin, MOCK_FFMPEG_FAIL: "1" });
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /decode error/);
    assert.equal(readFileSync(expected, "utf8"), "jpg");

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
