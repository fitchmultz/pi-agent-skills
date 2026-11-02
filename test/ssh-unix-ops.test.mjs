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
  const workdir = mkdtempSync(join(tmpdir(), "ssh-unix-ops-self-test-bundle-"));
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
    await t.test("bounded remote reads stream only the needed prefix while preserving splitlines semantics", () => {
      const probe = spawnSync("python3", [
        "-B",
        "-c",
        `
import contextlib, io, pathlib, runpy, sys, tempfile

source = sys.argv[1]
payload = runpy.run_path(source, run_name="audit_import")["REMOTE_READ"]

def ref_read(path, encoding, start_line, max_lines):
    lines = path.read_text(encoding=encoding, errors="replace").splitlines(keepends=True)
    start_index = max(start_line - 1, 0)
    selected = lines[start_index:] if max_lines < 0 else lines[start_index:start_index + max_lines]
    return "".join(selected)

with tempfile.TemporaryDirectory() as directory:
    root = pathlib.Path(directory)
    large = root / "large.log"
    block = (b"x" * 127 + b"\\n") * 8192
    with large.open("wb") as fh:
        for _ in range(8):
            fh.write(block)
    orig_open = pathlib.Path.open
    orig_read_text = pathlib.Path.read_text
    read_chars = 0
    read_text_calls = 0
    class CountedReader:
        def __init__(self, inner):
            self._inner = inner
        def read(self, size=-1):
            global read_chars
            chunk = self._inner.read(size)
            read_chars += len(chunk)
            return chunk
        def __enter__(self):
            self._inner.__enter__()
            return self
        def __exit__(self, *exc):
            return self._inner.__exit__(*exc)
    def counted_open(self, mode="r", *args, **kwargs):
        handle = orig_open(self, mode, *args, **kwargs)
        return CountedReader(handle) if self == large else handle
    def counted_read_text(self, *args, **kwargs):
        global read_text_calls
        if self == large:
            read_text_calls += 1
        return orig_read_text(self, *args, **kwargs)
    pathlib.Path.open = counted_open
    pathlib.Path.read_text = counted_read_text
    try:
        sys.argv = ["-c", str(large), "utf-8", "1", "20", "0"]
        with contextlib.redirect_stdout(io.StringIO()) as out:
            exec(compile(payload, "<REMOTE_READ>", "exec"), {})
        assert out.getvalue() == ("x" * 127 + "\\n") * 20
        assert read_text_calls == 0, f"expected 0 read_text calls, got {read_text_calls}"
        assert read_chars <= 16384, f"expected bounded read <= 16384 chars, got {read_chars}"

        read_chars = 0
        sys.argv = ["-c", str(large), "utf-8", "1", "0", "0"]
        with contextlib.redirect_stdout(io.StringIO()) as out:
            exec(compile(payload, "<REMOTE_READ>", "exec"), {})
        assert out.getvalue() == ""
        assert read_chars == 0, f"expected 0 chars read for max_lines=0, got {read_chars}"
    finally:
        pathlib.Path.open = orig_open
        pathlib.Path.read_text = orig_read_text

    sparse = root / "sparse.txt"
    sparse_payload = "z" * (512 * 1024)
    sparse.write_text(sparse_payload, encoding="utf-8")
    sys.argv = ["-c", str(sparse), "utf-8", "1", "10", "0"]
    with contextlib.redirect_stdout(io.StringIO()) as out:
        exec(compile(payload, "<REMOTE_READ>", "exec"), {})
    assert out.getvalue() == sparse_payload
    sys.argv = ["-c", str(sparse), "utf-8", "2", "10", "0"]
    with contextlib.redirect_stdout(io.StringIO()) as out:
        exec(compile(payload, "<REMOTE_READ>", "exec"), {})
    assert out.getvalue() == ""

    boundary_crlf = b"a" * 16383 + b"\\r\\nsecond\\nthird\\r4th"
    samples = [
        b"",
        b"unterminated",
        boundary_crlf,
        "a\\nb\\r\\nc\\rd\\ve\\ff\\x1cg\\x1dh\\x1ei\\u0085j\\u2028k\\u2029l".encode("utf-8"),
        "\\ufeffbom-first\\r\\nsecond\\nthird".encode("utf-8"),
        b"invalid\\xff\\xfeutf8\\r\\nnext\\nlast",
    ]
    for idx, sample in enumerate(samples):
        sample_path = root / f"sample-{idx}.bin"
        sample_path.write_bytes(sample)
        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            for start_line in (-2, 0, 1, 2, 4, 20):
                for max_lines in (-1, 0, 1, 2, 5, 20):
                    sys.argv = ["-c", str(sample_path), encoding, str(start_line), str(max_lines), "0"]
                    with contextlib.redirect_stdout(io.StringIO()) as out:
                        exec(compile(payload, "<REMOTE_READ>", "exec"), {})
                    expected = ref_read(sample_path, encoding, start_line, max_lines)
                    assert out.getvalue() == expected, (idx, encoding, start_line, max_lines)
`,
        join(skillDir, "scripts/ssh-unix-ops.py"),
      ], { env, encoding: "utf8", timeout: 20_000 });
      assert.equal(probe.status, 0, `${probe.error ?? ""}\n${probe.stdout}\n${probe.stderr}`);
    });
  } finally {
    rmSync(workdir, { recursive: true, force: true });
    rmSync(transportDir, { recursive: true, force: true });
  }
});
