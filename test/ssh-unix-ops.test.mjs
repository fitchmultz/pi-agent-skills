import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillDir = fileURLToPath(new URL("../skills/ssh-unix-ops/", import.meta.url));

test("SSH helper file workflows and refusals work through a local transport substitute", {
  skip: process.platform === "win32",
}, async (t) => {
  const transportDir = mkdtempSync(join(tmpdir(), "ssh-unix-ops-transport-"));
  const workdir = mkdtempSync("/tmp/ssh-unix-ops-self-test-bundle-");
  try {
    // Execute the actual remote payload locally; no SSH daemon, credentials, or network.
    writeFileSync(join(transportDir, "ssh"), `#!/bin/sh
set -eu
test "$#" -eq 4
test "$1" = "-o"
test "$2" = "BatchMode=yes"
test "$3" = "fixture.invalid"
exec /bin/sh -c "$4"
`, { mode: 0o755 });
    const env = {
      ...process.env, PATH: `${transportDir}:${process.env.PATH}`,
      HOME: transportDir, PYTHONIOENCODING: "utf-8",
    };
    writeFileSync(join(transportDir, ".bash_profile"), "printf 'LOGIN_BANNER\\n'\n");
    await t.test("tree transfers are not corrupted by login-profile output", () => {
      const profile = spawnSync("bash", ["-lc", "true"], { env, encoding: "utf8" });
      assert.equal(profile.status, 0, profile.stderr);
      assert.match(profile.stdout, /LOGIN_BANNER/, "fixture must exercise an actual login profile");
      for (const [script, args] of [
        ["scripts/self-test.sh", ["--workdir", workdir]],
        ["tests/negative-tests.sh", []],
      ]) {
        const result = spawnSync("bash", [join(skillDir, script), "--host", "fixture.invalid", ...args], {
          env, encoding: "utf8", timeout: 90_000,
        });
        assert.equal(result.status, 0, `${script}\n${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
      }
    });
    await t.test("stdin diff honors the selected encoding rather than Python's locale", () => {
      const file = join(transportDir, "latin1.txt");
      const content = Buffer.from("café\n", "latin1");
      writeFileSync(file, content);
      const result = spawnSync("python3", [
        join(skillDir, "scripts/ssh-unix-ops.py"), "diff", "--host", "fixture.invalid",
        "--remote-path", file, "--stdin", "--encoding", "latin-1",
      ], {
        env, input: content, encoding: "utf8", timeout: 10_000,
      });
      assert.equal(result.status, 0, `${result.error ?? ""}\n${result.stderr}`);
      assert.equal(result.stdout, "");
    });
  } finally {
    rmSync(workdir, { recursive: true, force: true });
    rmSync(transportDir, { recursive: true, force: true });
  }
});
