import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "skills", "pi-development", "scripts", "resolve_pi.py");
const overridePackage = realpathSync(path.join(root, "node_modules", "@earendil-works", "pi-coding-agent"));
const systemPath = ["/usr/local/bin", "/usr/bin", "/bin"].join(path.delimiter);
const skill = readFileSync(path.join(root, "skills", "pi-development", "SKILL.md"), "utf8");
const stamp = {
  official: /^  last-verified-pi: "(.+)"$/m.exec(skill)[1],
  fork: /^  fork-source: "(.+)"$/m.exec(skill)[1],
};

function resolvePi(args, env, pathValue) {
  const python = process.env.PYTHON ?? process.env.PATH
    ?.split(path.delimiter)
    .map((directory) => path.join(directory, process.platform === "win32" ? "python.exe" : "python3"))
    .find(existsSync);
  assert.ok(python, "python3 is required for resolve_pi.py tests");
  const fullEnv = { ...process.env, ...env, PATH: pathValue };
  return spawnSync(python, [script, "--json", ...args], { encoding: "utf8", env: fullEnv });
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
  assert.equal(output.stampPiVersion, stamp.official);
  assert.equal(output.stampForkCommit, stamp.fork);
  assert.equal(output.forkCommit, null, "an npm install has no fork release receipt");
});

// The layout that the fork installer writes: <release>/fork-release.json beside
// <release>/node_modules/@earendil-works/pi-coding-agent.
function installedHost(t, { version, forkCommit }) {
  const release = realpathSync(mkdtempSync(path.join(os.tmpdir(), "resolve-pi-release-")));
  t.after(() => rmSync(release, { recursive: true, force: true }));
  const packageRoot = path.join(release, "node_modules", "@earendil-works", "pi-coding-agent");
  mkdirSync(path.join(packageRoot, "docs"), { recursive: true });
  writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ name: "@earendil-works/pi-coding-agent", version }));
  writeFileSync(path.join(packageRoot, "docs", "extensions.md"), "# Extensions\n");
  writeFileSync(path.join(packageRoot, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n");
  if (forkCommit) writeFileSync(path.join(release, "fork-release.json"), JSON.stringify({ commit: forkCommit }));
  const result = resolvePi([], { PI_PACKAGE_DIR: packageRoot }, systemPath);
  assert.equal(result.status, 0, result.stderr);
  return { packageRoot, output: JSON.parse(result.stdout) };
}

test("resolver compares the installed host with the stamp and names its changelog when they differ", { skip }, (t) => {
  const same = installedHost(t, { version: stamp.official, forkCommit: stamp.fork }).output;
  assert.equal(same.forkCommit, stamp.fork);
  assert.equal(same.stampMatch, true);
  assert.equal(same.changelog, null);

  const other = "0123456789abcdef0123456789abcdef01234567";
  const moved = installedHost(t, { version: stamp.official, forkCommit: other });
  assert.equal(moved.output.forkCommit, other);
  assert.equal(moved.output.stampMatch, false);
  assert.equal(moved.output.changelog, path.join(moved.packageRoot, "CHANGELOG.md"));
  assert.ok(moved.output.stampNote.includes(moved.output.changelog), moved.output.stampNote);

  const newer = installedHost(t, { version: "999.0.0" });
  assert.equal(newer.output.forkCommit, null);
  assert.equal(newer.output.stampMatch, false);
  assert.equal(newer.output.changelog, path.join(newer.packageRoot, "CHANGELOG.md"));
});

test("resolver tells the user to update a host that is older than the stamp", { skip }, (t) => {
  const { output } = installedHost(t, { version: "0.0.1" });
  assert.equal(output.stampMatch, false);
  assert.match(output.stampNote, /older than the stamp .* `pi update`/);
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
