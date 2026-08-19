import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(root, "skills/propose-then-ship-pi/scripts");
const script = path.join(scripts, "test_pr_signals.sh");
const target = path.join(scripts, "pr_signals.sh");

test("PR signal polling exit paths", () => {
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: { ...process.env, BASH_ENV: "/dev/null" },
    timeout: 60_000,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("the script budget can settle before its outer timeout", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pr-signals-"));
  const gh = path.join(dir, "gh");
  writeFileSync(gh, `#!/usr/bin/env bash
printf '%s' '{"number":1,"url":"https://example.test/pr/1","state":"OPEN","isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","headRefOid":"deadbeef","statusCheckRollup":[{"__typename":"CheckRun","name":"ci","status":"IN_PROGRESS","conclusion":""}]}'
`);
  chmodSync(gh, 0o755);

  try {
    const result = spawnSync(target, ["1"], {
      encoding: "utf8",
      env: {
        ...process.env,
        BASH_ENV: "/dev/null",
        GH_BIN: gh,
        MAX_WAIT_SECONDS: "1",
        POLL_INTERVAL_SECONDS: "1",
      },
      timeout: 5_000,
    });
    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /timed out on deadbeef/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
