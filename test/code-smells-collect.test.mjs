import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const collector = fileURLToPath(new URL("../skills/code-smells/scripts/collect.py", import.meta.url));

function fixture(t, useGit = false) {
  const temporary = realpathSync(mkdtempSync(path.join(os.tmpdir(), "code-smells-")));
  const root = path.join(temporary, "project");
  mkdirSync(root);
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  function write(name, content) {
    const filename = path.join(root, name);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, content);
  }
  function git(...args) {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  if (useGit) git("init", "--quiet");
  function run(args = [], cwd = root, output = path.join(temporary, "evidence.json")) {
    const result = spawnSync("uv", ["run", "--script", collector, ...args, "--output", output], {
      cwd, encoding: "utf8",
    });
    assert.ifError(result.error);
    return { ...result, output };
  }
  function collect(args = [], cwd = root) {
    const result = run(args, cwd);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return JSON.parse(readFileSync(result.output, "utf8"));
  }
  return { temporary, root, write, git, run, collect };
}

test("Git inventory uses current bytes, retains ignored tracked files and explicit non-analysis statuses", (t) => {
  const f = fixture(t, true);
  f.write(".gitignore", "ignored/\n*.cache\n");
  f.write("src/current.py", "def old():\n    pass\n");
  f.write("src/deleted.py", "def removed():\n    pass\n");
  f.write("ignored/tracked.py", "def maintained():\n    return 1\n");
  f.git("add", "--force", ".");
  const current = "# Current working contents, not the index\n\ndef choose(value, fallback):\n    if value:\n        return value\n    return fallback\n\ndef tiny():\n    return 1\n";
  f.write("src/current.py", current);
  unlinkSync(path.join(f.root, "src/deleted.py"));
  f.write("ignored/skip.py", "def ignored():\n    pass\n");
  f.write("ignored.cache", "cached");
  f.write(".maintained/new.py", "def fresh():\n    return 2\n");
  f.write("odd\tname\n.py", "def unusual():\n    return 3\n");
  f.write("logic.hs", "identity x = x\n");
  f.write("binary.py", Buffer.from([0, 1, 2, 3]));
  f.write("undecodable.py", Buffer.from([0xff, 0xfe, 0xff]));
  writeFileSync(path.join(f.temporary, "external.py"), "def private_source():\n    pass\n");
  symlinkSync(path.join(f.temporary, "external.py"), path.join(f.root, "external.py"));
  symlinkSync(f.temporary, path.join(f.root, "external-directory"), "dir");
  symlinkSync("missing-target", path.join(f.root, "broken.py"));

  const evidence = f.collect();
  assert.equal(evidence.root, f.root);
  assert.deepEqual(evidence.scopes, ["."]);
  assert.equal(evidence.inventory, "git");
  const files = new Map(evidence.files.map((file) => [file.path, file]));
  assert.deepEqual([...files.keys()].sort(), [
    ".gitignore", ".maintained/new.py", "binary.py", "broken.py", "external-directory", "external.py",
    "ignored/tracked.py", "logic.hs", "odd\tname\n.py", "src/current.py", "src/deleted.py", "undecodable.py",
  ].sort());
  const source = files.get("src/current.py");
  assert.equal(source.sha256, createHash("sha256").update(current).digest("hex"));
  assert.equal(source.bytes, Buffer.byteLength(current));
  assert.equal(source.lines, 9);
  assert.equal(source.nloc, 6);
  assert.deepEqual(source.functions.map((fn) => ({
    name: fn.name, start: fn.start_line, end: fn.end_line, ccn: fn.cyclomatic_complexity,
    parameters: fn.parameters, parameterCount: fn.parameter_count, nloc: fn.nloc,
  })), [
    { name: "choose", start: 3, end: 6, ccn: 2, parameters: ["value", "fallback"], parameterCount: 2, nloc: 4 },
    { name: "tiny", start: 8, end: 9, ccn: 1, parameters: [], parameterCount: 0, nloc: 2 },
  ]);
  assert.equal(files.get("src/deleted.py").status, "deleted");
  assert.equal(files.get("ignored/tracked.py").status, "analyzed");
  assert.equal(files.get("logic.hs").status, "unsupported");
  assert.equal(files.get("logic.hs").parser, null);
  assert.equal(files.get("logic.hs").lines, 1);
  assert.equal(files.get("binary.py").status, "binary");
  assert.equal(files.get("undecodable.py").status, "decode_error");
  for (const name of ["external.py", "external-directory", "broken.py"]) {
    assert.equal(files.get(name).status, "symlink");
    assert.equal(files.get(name).sha256, null);
    assert.deepEqual(files.get(name).functions, []);
  }
  assert.ok(evidence.exclusions.some(({ path: name, reason }) => name === "ignored/skip.py" && reason === "git_ignored"));
  assert.ok(evidence.exclusions.some(({ path: name, reason }) => name === ".git" && reason === "git_metadata"));
  assert.equal(evidence.coverage.inventory_complete, true);
  assert.equal(evidence.coverage.functions, 5);
  assert.equal(evidence.coverage.statuses.analyzed, 4);
  assert.equal(readFileSync(path.join(f.root, "src/current.py"), "utf8"), current);
});

test("default Git root and repeated scopes differ from an explicit subtree root", (t) => {
  const f = fixture(t, true);
  f.write("one/a.py", "def a():\n    pass\n");
  f.write("one/nested/b.py", "def b():\n    pass\n");
  f.write("two/c.py", "def c():\n    pass\n");
  const cwd = path.join(f.root, "one");
  const all = f.collect([], cwd);
  assert.equal(all.root, f.root);
  assert.equal(all.files.length, 3);

  const scoped = f.run(["--scope", "one/a.py", "--scope", "two"], cwd, path.join(f.temporary, "scoped.json"));
  assert.equal(scoped.status, 0, scoped.stderr);
  const selected = JSON.parse(readFileSync(scoped.output, "utf8"));
  assert.deepEqual(selected.scopes, ["one/a.py", "two"]);
  assert.deepEqual(selected.files.map(({ path: name }) => name), ["one/a.py", "two/c.py"]);

  const subtree = f.run(["--root", cwd], f.root, path.join(f.temporary, "subtree.json"));
  assert.equal(subtree.status, 0, subtree.stderr);
  const subEvidence = JSON.parse(readFileSync(subtree.output, "utf8"));
  assert.equal(subEvidence.root, cwd);
  assert.deepEqual(subEvidence.files.map(({ path: name }) => name), ["a.py", "nested/b.py"]);
});

test("a scope inside a tracked submodule retains its unexpanded repository boundary", (t) => {
  const f = fixture(t, true);
  f.write("packages/module/src/logic.py", "def maintained():\n    return 1\n");
  f.git("update-index", "--add", "--cacheinfo", `160000,${"1".repeat(40)},packages/module`);
  const evidence = f.collect(["--scope", "packages/module/src"]);
  assert.deepEqual(evidence.scopes, ["packages/module/src"]);
  assert.deepEqual(evidence.files.map(({ path: name, status }) => ({ path: name, status })), [
    { path: "packages/module", status: "submodule" },
  ]);
  assert.equal(evidence.coverage.inventory_complete, false);
  assert.equal(evidence.coverage.functions, 0, "The parent must expand the recorded repository separately");
});

test("non-Git traversal honors nested ignore rules, negation and hidden maintained sources", (t) => {
  const f = fixture(t);
  f.write(".gitignore", "ignored/\n*.tmp\nsrc/*.py\n!src/keep.py\n");
  f.write("src/.gitignore", "!local.py\n/nested-only/\n");
  f.write("src/keep.py", "def keep():\n    pass\n");
  f.write("src/local.py", "def local():\n    pass\n");
  f.write("src/excluded.py", "def excluded():\n    pass\n");
  f.write("src/nested-only/excluded.py", "def excluded():\n    pass\n");
  f.write("elsewhere/nested-only/kept.py", "def kept():\n    pass\n");
  f.write(".hidden/tool.py", "def hidden():\n    pass\n");
  f.write("ignored/.gitignore", "!secret.py\n");
  f.write("ignored/secret.py", "def ignored_parent():\n    pass\n");
  f.write("notes.tmp", "ignored");
  f.write("nested/.git/config", "never read metadata");
  f.write("nested/source.py", "def source():\n    pass\n");

  const evidence = f.collect();
  assert.equal(evidence.root, f.root);
  assert.equal(evidence.inventory, "filesystem");
  assert.deepEqual(evidence.files.map(({ path: name }) => name), [
    ".gitignore", ".hidden/tool.py", "elsewhere/nested-only/kept.py", "nested/source.py",
    "src/.gitignore", "src/keep.py", "src/local.py",
  ]);
  assert.ok(evidence.exclusions.some(({ path: name, reason }) => name === "nested/.git" && reason === "git_metadata"));
  assert.ok(evidence.exclusions.some(({ path: name }) => name === "ignored/"));
  assert.equal(evidence.coverage.functions, 5);
});

test("collection retains all simple functions and files, including a large source file", (t) => {
  const f = fixture(t);
  const names = Array.from({ length: 1201 }, (_, i) => `small_${i}`);
  const functions = names.map((name) => `def ${name}():\n    return 1\n`).join("\n");
  const large = `# ${"large comment ".repeat(100000)}\n${functions}`;
  f.write("large.py", large);
  for (let i = 0; i < 151; i++) f.write(`src/file-${i}.py`, `def member_${i}():\n    pass\n`);
  const evidence = f.collect();
  assert.equal(evidence.files.length, 152);
  const source = evidence.files.find(({ path: name }) => name === "large.py");
  assert.equal(source.bytes, Buffer.byteLength(large));
  assert.equal(source.sha256, createHash("sha256").update(large).digest("hex"));
  assert.deepEqual(source.functions.map(({ name }) => name), names);
  assert.ok(source.functions.every(({ cyclomatic_complexity: ccn }) => ccn === 1));
  assert.equal(evidence.coverage.functions, 1352);
  assert.equal(evidence.coverage.statuses.analyzed, 152);
});

test("invalid scopes and unsafe evidence paths fail without replacing existing data", (t) => {
  const f = fixture(t, true);
  f.write("src/a.py", "def a():\n    pass\n");
  const cases = [
    { args: ["--scope", "missing"], error: /Scope does not exist/ },
    { args: ["--scope", "../outside"], error: /Scope is outside root/ },
    { args: ["--scope", ".git"], error: /Scope is Git metadata/ },
    { args: ["--root", "missing"], error: /Root is not a directory/ },
    { args: [], output: path.join(f.root, "new.json"), error: /outside the source scopes/ },
    { args: [], output: path.join(f.temporary, "missing", "new.json"), error: /Output parent does not exist/ },
  ];
  symlinkSync(f.temporary, path.join(f.root, "escape"), "dir");
  cases.push({ args: ["--scope", "escape/project/src/a.py"], error: /Scope traverses a symlink/ });
  const stable = path.join(f.temporary, "stable.json");
  writeFileSync(stable, "previous evidence");
  cases.push({ args: [], output: stable, error: /Output already exists/ });
  cases.push({ args: [], output: path.join(f.root, "src/a.py"), error: /Output already exists/ });
  symlinkSync(stable, path.join(f.temporary, "alias.json"));
  cases.push({ args: [], output: path.join(f.temporary, "alias.json"), error: /Output already exists/ });
  for (const [index, { args, output = path.join(f.temporary, `failed-${index}.json`), error }] of cases.entries()) {
    const result = f.run(args, f.root, output);
    assert.notEqual(result.status, 0, `${args}: ${result.stdout}`);
    assert.match(result.stderr, error);
    if (output !== stable && !output.endsWith("a.py") && !output.endsWith("alias.json")) {
      assert.equal(existsSync(output), false);
    }
  }
  assert.equal(readFileSync(stable, "utf8"), "previous evidence");
  assert.equal(readFileSync(path.join(f.root, "src/a.py"), "utf8"), "def a():\n    pass\n");

  const inside = path.join(f.root, "evidence.json");
  const scoped = f.run(["--scope", "src"], f.root, inside);
  assert.equal(scoped.status, 0, scoped.stderr);
  assert.deepEqual(JSON.parse(readFileSync(inside, "utf8")).files.map(({ path: name }) => name), ["src/a.py"]);
});

test("unreadable files are explicit coverage gaps while accessible siblings still receive metrics", {
  skip: process.getuid?.() === 0 || process.platform === "win32",
}, (t) => {
  const f = fixture(t);
  f.write("unreadable.py", "def inaccessible():\n    pass\n");
  f.write("good.py", "def accessible():\n    pass\n");
  f.write("private/child.py", "def hidden_by_permissions():\n    pass\n");
  const unreadable = path.join(f.root, "unreadable.py");
  const privateDirectory = path.join(f.root, "private");
  chmodSync(unreadable, 0);
  chmodSync(privateDirectory, 0);
  try {
    const evidence = f.collect();
    const failure = evidence.files.find(({ path: name }) => name === "unreadable.py");
    assert.equal(failure.status, "unreadable");
    assert.match(failure.error, /Permission denied/);
    assert.equal(failure.sha256, null);
    assert.equal(evidence.coverage.statuses.unreadable, 1);
    assert.equal(evidence.coverage.functions, 1);
    assert.equal(evidence.coverage.inventory_complete, false);
    assert.equal(evidence.inventory_errors.length, 1);
    assert.equal(evidence.inventory_errors[0].path, "private");
    assert.match(evidence.inventory_errors[0].error, /Permission denied/);
  } finally {
    chmodSync(unreadable, 0o600);
    chmodSync(privateDirectory, 0o700);
  }
});
