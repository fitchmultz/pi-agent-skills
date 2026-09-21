import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const hostIndex = process.env.PI_HOST_INDEX ? pathToFileURL(process.env.PI_HOST_INDEX).href : import.meta.resolve("@earendil-works/pi-coding-agent");
const { DefaultResourceLoader, SettingsManager } = await import(hostIndex);
const root = fileURLToPath(new URL("..", import.meta.url));

test("native discovery finds all packed skills and retains their scripts and references", async (t) => {
  const packageDir = fileURLToPath(new URL("..", hostIndex));
  const host = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  if (process.env.PI_COMPAT_EXPECTED_PACKAGE_DIR) assert.equal(realpathSync(packageDir), realpathSync(process.env.PI_COMPAT_EXPECTED_PACKAGE_DIR));
  if (process.env.PI_COMPAT_EXPECTED_VERSION) assert.equal(host.version, process.env.PI_COMPAT_EXPECTED_VERSION);
  if (process.env.PI_HOST_INDEX) assert.equal(realpathSync(process.env.PI_HOST_INDEX), realpathSync(join(packageDir, "dist/index.js")));
  t.diagnostic(JSON.stringify({ host: process.env.PI_COMPAT_HOST ?? "local", version: host.version, packageDir }));
  const temp = mkdtempSync(join(tmpdir(), "pi-skills-discovery-"));
  const previousHome = process.env.HOME;
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const cwd = join(temp, "project");
  const agentDir = join(temp, "agent");
  mkdirSync(cwd);
  mkdirSync(agentDir);
  try {
    // Real consumer-shaped pack, no host devDependencies inside it.
    const [packed] = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temp], { cwd: root, encoding: "utf8" }));
    execFileSync("tar", ["-xzf", join(temp, packed.filename), "-C", temp]);
    const sourceFiles = (dir, prefix = "skills") => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
      ? sourceFiles(join(dir, entry.name), `${prefix}/${entry.name}`)
      : [`${prefix}/${entry.name}`]);
    const packedPaths = new Set(packed.files.map(({ path }) => path));
    for (const file of sourceFiles(join(root, "skills"))) assert.ok(packedPaths.has(file), `Missing packed asset: ${file}`);
    assert.ok(![...packedPaths].some((path) => path.startsWith("node_modules/")));
    process.env.HOME = temp;
    process.env.PI_CODING_AGENT_DIR = agentDir;
    const settingsManager = SettingsManager.inMemory({ packages: [join(temp, "package")] });
    const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noContextFiles: true });
    await loader.reload();
    const { skills, diagnostics } = loader.getSkills();
    assert.deepEqual(diagnostics, []);
    const expected = readdirSync(join(root, "skills")).sort();
    assert.deepEqual(skills.map(({ name }) => name).sort(), expected);
    for (const skill of skills) {
      assert.equal(realpathSync(skill.filePath), realpathSync(join(temp, "package", "skills", skill.name, "SKILL.md")));
      assert.ok(skill.description.length > 0);
      assert.equal(skill.sourceInfo.origin, "package");
    }
    assert.deepEqual(loader.getExtensions().errors, []);
    assert.equal(loader.getExtensions().extensions.length, 0, "This is a skills bundle, not a runtime extension");
    t.diagnostic(`${skills.length} packed skills discovered by Pi ${host.version}`);
  } finally {
    if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    rmSync(temp, { recursive: true, force: true });
  }
});
