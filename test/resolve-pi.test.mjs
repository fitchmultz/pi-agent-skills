import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "skills", "pi-extension-development", "scripts", "resolve_pi.py");
const overridePackage = realpathSync(path.join(root, "node_modules", "@earendil-works", "pi-coding-agent"));
const systemPath = ["/usr/local/bin", "/usr/bin", "/bin"].join(path.delimiter);

function resolvePi(args, env, pathValue) {
  const fullEnv = { ...process.env, ...env, PATH: pathValue };
  return spawnSync("python3", [script, "--json", ...args], { encoding: "utf8", env: fullEnv });
}

const skip = process.platform === "win32";

test("resolver honors PI_PACKAGE_DIR without pi on PATH", { skip }, () => {
  const result = resolvePi([], { PI_PACKAGE_DIR: overridePackage }, systemPath);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.packageResolution, "PI_PACKAGE_DIR");
  assert.equal(output.launcherResolution, "skipped-PI_PACKAGE_DIR");
  assert.equal(output.packageRoot, overridePackage);
  assert.equal(output.piBin, null);
  assert.equal(output.piExecutable, null);
  assert.equal(typeof output.packageVersion, "string");
});

test("resolver fails closed on an invalid PI_PACKAGE_DIR", { skip }, () => {
  const bogus = mkdtempSync(path.join(os.tmpdir(), "resolve-pi-"));
  try {
    const result = resolvePi([], { PI_PACKAGE_DIR: bogus }, systemPath);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PI_PACKAGE_DIR does not contain a verified/);
  } finally {
    rmSync(bogus, { recursive: true, force: true });
  }
});

test("resolver ignores PI_PACKAGE_DIR for an explicit --pi", { skip }, (t) => {
  const explicit = path.join(root, "node_modules", ".bin", "pi");
  const probe = spawnSync(explicit, ["--version"], { encoding: "utf8" });
  if (probe.error) return t.skip(`no pi executable at ${explicit}`);
  const result = resolvePi(["--pi", explicit], { PI_PACKAGE_DIR: overridePackage }, systemPath);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.piBin, explicit);
  assert.notEqual(output.packageResolution, "PI_PACKAGE_DIR");
});
