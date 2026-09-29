#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import difflib
import hashlib
import json
import os
import pathlib
import shlex
import stat
import subprocess
import sys
import tempfile
from textwrap import dedent

VERSION = "0.3.1"

HELP_EPILOG = dedent(
    """
    Quick examples:
      python3 ./scripts/ssh-unix-ops.py doctor --host user@example-host
      python3 ./scripts/ssh-unix-ops.py read --host user@example-host --path /srv/app/app.conf
      python3 ./scripts/ssh-unix-ops.py upload --host user@example-host --local-path ./app.conf --remote-path /tmp/app.conf --verify-sha256
      cat new.conf | python3 ./scripts/ssh-unix-ops.py diff --host user@example-host --remote-path /srv/app/app.conf --stdin
      python3 ./scripts/ssh-unix-ops.py backup --host user@example-host --path /srv/app/app.conf

    Exit codes:
      0 success; 1 semantic difference (diff/tree-diff); 2 usage or safety refusal;
      3 local operational failure. SSH and remote-command failures propagate.
    """
).strip()

DEFAULT_SSH_OPTIONS = ["BatchMode=yes"]

REMOTE_COMMON = dedent(
    r'''
    import os
    import pathlib
    import stat
    import sys

    def fail(message, exit_code=2):
        print(f"error: {message}", file=sys.stderr)
        raise SystemExit(exit_code)

    def kind_from_mode(mode):
        if stat.S_ISREG(mode):
            return "regular file"
        if stat.S_ISDIR(mode):
            return "directory"
        if stat.S_ISLNK(mode):
            return "symlink"
        if stat.S_ISCHR(mode):
            return "character device"
        if stat.S_ISBLK(mode):
            return "block device"
        if stat.S_ISFIFO(mode):
            return "fifo"
        if stat.S_ISSOCK(mode):
            return "socket"
        return "special file"

    def lstat_or_none(path):
        try:
            return path.lstat()
        except FileNotFoundError:
            return None

    def ensure_existing_regular_file(path, *, action, follow_symlinks=False, flag='--follow-symlinks'):
        st = lstat_or_none(path)
        if st is None:
            fail(f"path does not exist: {path}")
        kind = kind_from_mode(st.st_mode)
        if kind == 'symlink':
            if not follow_symlinks:
                fail(f"refusing to {action} symlink path: {path}; pass {flag} to follow symlinks explicitly")
            try:
                target_st = path.stat()
            except FileNotFoundError:
                fail(f"broken symlink: {path}")
            target_kind = kind_from_mode(target_st.st_mode)
            if target_kind != 'regular file':
                fail(f"refusing to {action} symlink whose target is not a regular file: {path} ({target_kind})")
            return stat.S_IMODE(target_st.st_mode)
        if kind != 'regular file':
            fail(f"refusing to {action} non-regular path: {path} ({kind})")
        return stat.S_IMODE(st.st_mode)

    def ensure_mutable_regular_file_target(path, *, action, make_parents=False):
        if make_parents:
            path.parent.mkdir(parents=True, exist_ok=True)
        elif not path.parent.exists():
            fail(f"parent directory does not exist: {path.parent}")
        st = lstat_or_none(path)
        if st is None:
            return None
        kind = kind_from_mode(st.st_mode)
        if kind != 'regular file':
            fail(f"refusing to {action} non-regular target: {path} ({kind})")
        return stat.S_IMODE(st.st_mode)

    def parse_mode_arg(mode_arg):
        if mode_arg == '-':
            return None
        try:
            return int(mode_arg, 8)
        except ValueError:
            fail(f"invalid file mode: {mode_arg!r}; expected octal like 0644")
    '''
).strip() + "\n\n"

REMOTE_READ = REMOTE_COMMON + dedent(
    r'''
    path = pathlib.Path(sys.argv[1])
    encoding = sys.argv[2]
    start_line = int(sys.argv[3])
    max_lines = int(sys.argv[4])
    follow_symlinks = sys.argv[5] == '1'

    ensure_existing_regular_file(path, action='read', follow_symlinks=follow_symlinks)
    text = path.read_text(encoding=encoding, errors='replace')
    lines = text.splitlines(keepends=True)
    start_index = max(start_line - 1, 0)
    if max_lines < 0:
        selected = lines[start_index:]
    else:
        selected = lines[start_index:start_index + max_lines]
    sys.stdout.write(''.join(selected))
    '''
).strip() + "\n"

REMOTE_WRITE = REMOTE_COMMON + dedent(
    r'''
    import os
    import tempfile

    path = pathlib.Path(sys.argv[1])
    make_parents = sys.argv[2] == '1'
    mode_arg = sys.argv[3]
    data = sys.stdin.buffer.read()

    target_mode = parse_mode_arg(mode_arg)
    existing_mode = ensure_mutable_regular_file_target(path, action='overwrite', make_parents=make_parents)
    if target_mode is None:
        target_mode = existing_mode

    fd, tmp_name = tempfile.mkstemp(prefix=f'.{path.name}.', suffix='.tmp', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'wb') as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        if target_mode is not None:
            os.chmod(tmp_name, target_mode)
        os.replace(tmp_name, path)
        print(f'wrote {len(data)} bytes to {path}', file=sys.stderr)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
    '''
).strip() + "\n"

REMOTE_REPLACE = REMOTE_COMMON + dedent(
    r'''
    import json
    import os
    import tempfile

    def find_all(haystack, needle):
        positions = []
        start = 0
        while True:
            idx = haystack.find(needle, start)
            if idx == -1:
                return positions
            positions.append(idx)
            start = idx + len(needle)

    path = pathlib.Path(sys.argv[1])
    spec = json.loads(sys.stdin.read())
    encoding = spec.get('encoding', 'utf-8')
    edits = spec.get('edits')
    if not isinstance(edits, list) or not edits:
        fail('spec must contain a non-empty edits array')

    target_mode = ensure_existing_regular_file(path, action='edit')
    original = path.read_text(encoding=encoding, errors='strict')
    planned = []
    for edit_index, edit in enumerate(edits):
        if not isinstance(edit, dict):
            fail(f'edit #{edit_index + 1} must be an object')
        if 'old' not in edit or 'new' not in edit:
            fail(f'edit #{edit_index + 1} must include old and new')
        old = edit['old']
        new = edit['new']
        if not isinstance(old, str) or not isinstance(new, str):
            fail(f'edit #{edit_index + 1} old/new must be strings')
        if old == '':
            fail(f'edit #{edit_index + 1} old must not be empty')
        expected_count = int(edit.get('expected_count', 1))
        matches = find_all(original, old)
        if len(matches) != expected_count:
            fail(f"edit #{edit_index + 1} expected {expected_count} match(es) for {old!r}, found {len(matches)}")
        for match_index, start in enumerate(matches):
            planned.append(
                {
                    'start': start,
                    'end': start + len(old),
                    'replacement': new,
                    'label': f'edit #{edit_index + 1} match #{match_index + 1}',
                }
            )

    planned.sort(key=lambda item: (item['start'], item['end']))
    for left, right in zip(planned, planned[1:]):
        if right['start'] < left['end']:
            fail(f"overlapping matches: {left['label']} overlaps {right['label']}")

    pieces = []
    cursor = 0
    for item in planned:
        pieces.append(original[cursor:item['start']])
        pieces.append(item['replacement'])
        cursor = item['end']
    pieces.append(original[cursor:])
    updated = ''.join(pieces)

    fd, tmp_name = tempfile.mkstemp(prefix=f'.{path.name}.', suffix='.tmp', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'w', encoding=encoding, newline='') as fh:
            fh.write(updated)
            fh.flush()
            os.fsync(fh.fileno())
        if target_mode is not None:
            os.chmod(tmp_name, target_mode)
        os.replace(tmp_name, path)
        print(f'applied {len(edits)} edit(s) / {len(planned)} replacement(s) to {path}', file=sys.stderr)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
    '''
).strip() + "\n"

REMOTE_SLURP = REMOTE_COMMON + dedent(
    r'''
    path = pathlib.Path(sys.argv[1])
    follow_symlinks = sys.argv[2] == '1'

    ensure_existing_regular_file(path, action='read', follow_symlinks=follow_symlinks)
    sys.stdout.buffer.write(path.read_bytes())
    '''
).strip() + "\n"

REMOTE_BACKUP = REMOTE_COMMON + dedent(
    r'''
    import shutil

    src = pathlib.Path(sys.argv[1])
    dest = pathlib.Path(sys.argv[2])
    follow_symlinks = sys.argv[3] == '1'

    ensure_existing_regular_file(src, action='back up', follow_symlinks=follow_symlinks)
    if dest == src:
        fail(f'destination must differ from source: {dest}')
    if lstat_or_none(dest) is not None:
        fail(f'destination already exists: {dest}')
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest, follow_symlinks=follow_symlinks)
    print(dest)
    '''
).strip() + "\n"

REMOTE_RESTORE = REMOTE_COMMON + dedent(
    r'''
    import os
    import shutil
    import tempfile

    dest = pathlib.Path(sys.argv[1])
    backup = pathlib.Path(sys.argv[2])
    make_parents = sys.argv[3] == '1'

    ensure_existing_regular_file(backup, action='restore from')
    target_mode = ensure_mutable_regular_file_target(dest, action='restore to', make_parents=make_parents)

    fd, tmp_name = tempfile.mkstemp(prefix=f'.{dest.name}.', suffix='.tmp', dir=str(dest.parent))
    os.close(fd)
    try:
        shutil.copy2(backup, tmp_name)
        if target_mode is not None:
            os.chmod(tmp_name, target_mode)
        os.replace(tmp_name, dest)
        print(dest)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
    '''
).strip() + "\n"

REMOTE_SHA256 = REMOTE_COMMON + dedent(
    r'''
    import hashlib

    path = pathlib.Path(sys.argv[1])
    follow_symlinks = sys.argv[2] == '1'

    ensure_existing_regular_file(path, action='hash', follow_symlinks=follow_symlinks)
    h = hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            h.update(chunk)
    print(h.hexdigest())
    '''
).strip() + "\n"

REMOTE_TREE_MANIFEST = dedent(
    r'''
    import hashlib
    import json
    import os
    import pathlib
    import stat
    import sys

    root = pathlib.Path(sys.argv[1])
    include_sha256 = sys.argv[2] == '1'
    entries = []

    def digest_file(path):
        h = hashlib.sha256()
        with path.open('rb') as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b''):
                h.update(chunk)
        return h.hexdigest()

    def emit(entry):
        entries.append(json.dumps(entry, ensure_ascii=False, sort_keys=True))

    def walk(path, rel):
        st = path.lstat()
        mode = format(stat.S_IMODE(st.st_mode), '04o')
        if stat.S_ISLNK(st.st_mode):
            emit({'mode': mode, 'path': rel, 'target': os.readlink(path), 'type': 'symlink'})
            return
        if stat.S_ISREG(st.st_mode):
            entry = {'mode': mode, 'path': rel, 'size': st.st_size, 'type': 'file'}
            if include_sha256:
                entry['sha256'] = digest_file(path)
            emit(entry)
            return
        if stat.S_ISDIR(st.st_mode):
            if rel != '.':
                emit({'mode': mode, 'path': rel, 'type': 'dir'})
            children = sorted(os.scandir(path), key=lambda item: item.name)
            for child in children:
                child_rel = child.name if rel == '.' else f'{rel}/{child.name}'
                walk(pathlib.Path(child.path), child_rel)
            return
        emit({'mode': mode, 'path': rel, 'type': 'other'})

    if not root.exists() and not root.is_symlink():
        print(f'error: path does not exist: {root}', file=sys.stderr)
        raise SystemExit(2)

    walk(root, '.')
    for line in entries:
        print(line)
    '''
).strip() + "\n"

DOCTOR_SCRIPT = dedent(
    r'''
    set -u
    printf 'user=%s\n' "${USER:-}"
    printf 'home=%s\n' "${HOME:-}"
    printf 'pwd=%s\n' "$PWD"
    printf 'login_shell=%s\n' "${SHELL:-}"
    printf 'uname=%s\n' "$(uname -srmo 2>/dev/null || uname -a)"
    if command -v bash >/dev/null 2>&1; then
        printf 'bash=%s\n' "$(command -v bash)"
    else
        printf 'bash=missing\n'
    fi
    if command -v python3 >/dev/null 2>&1; then
        printf 'python3=%s\n' "$(command -v python3)"
    else
        printf 'python3=missing\n'
    fi
    if command -v tar >/dev/null 2>&1; then
        printf 'tar=%s\n' "$(command -v tar)"
    else
        printf 'tar=missing\n'
    fi
    if command -v rsync >/dev/null 2>&1; then
        printf 'rsync=%s\n' "$(command -v rsync)"
    else
        printf 'rsync=missing\n'
    fi
    if command -v wslpath >/dev/null 2>&1; then
        printf 'wslpath=%s\n' "$(command -v wslpath)"
    else
        printf 'wslpath=missing\n'
    fi
    if mount | grep -q ' on /mnt/c '; then
        printf 'mnt_c_mount=%s\n' "$(mount | grep ' on /mnt/c ' | head -n 1)"
        printf 'mnt_c_fstype=%s\n' "$(stat -f -c %T /mnt/c 2>/dev/null || echo unknown)"
    fi
    '''
).strip() + "\n"


class FriendlyArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        self.print_usage(sys.stderr)
        self.exit(
            2,
            f"{self.prog}: error: {message}\nHint: run '{self.prog} --help' or '{self.prog} <subcommand> --help'.\n",
        )


def shell_join(parts: list[str]) -> str:
    return " ".join(shlex.quote(part) for part in parts)


def die(message: str, exit_code: int = 2) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(exit_code)


def kind_from_mode(mode: int) -> str:
    if stat.S_ISREG(mode):
        return "regular file"
    if stat.S_ISDIR(mode):
        return "directory"
    if stat.S_ISLNK(mode):
        return "symlink"
    if stat.S_ISCHR(mode):
        return "character device"
    if stat.S_ISBLK(mode):
        return "block device"
    if stat.S_ISFIFO(mode):
        return "fifo"
    if stat.S_ISSOCK(mode):
        return "socket"
    return "special file"


def lstat_local_or_none(path: pathlib.Path) -> os.stat_result | None:
    try:
        return path.lstat()
    except FileNotFoundError:
        return None


def merged_ssh_options(user_options: list[str]) -> list[str]:
    option_keys = {option.split("=", 1)[0].strip().lower() for option in user_options}
    merged = list(user_options)
    if "batchmode" not in option_keys:
        merged = DEFAULT_SSH_OPTIONS + merged
    return merged


def build_ssh_argv(host: str, remote_command: str, ssh_options: list[str]) -> list[str]:
    argv = ["ssh"]
    for option in merged_ssh_options(ssh_options):
        argv.extend(["-o", option])
    argv.extend([host, remote_command])
    return argv


def print_command(argv: list[str]) -> None:
    print("+ " + shell_join(argv), file=sys.stderr)


def print_json(payload: dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def parse_key_value_lines(text: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or "=" not in line:
            continue
        key, value = line.split("=", 1)
        parsed[key] = value
    return parsed


def classify_remote_platform(facts: dict[str, str]) -> dict[str, object]:
    uname = facts.get("uname", "").lower()
    has_wsl_markers = facts.get("wslpath", "missing") != "missing" or "mnt_c_mount" in facts
    notes: list[str] = []
    if "darwin" in uname:
        family = "macos"
        notes.append("macOS remote: avoid Linux-only commands; use POSIX/bsd-compatible flags unless probed.")
    elif "linux" in uname:
        family = "wsl2" if has_wsl_markers or "microsoft" in uname else "linux"
        if family == "wsl2":
            notes.append("WSL2 remote: prefer Linux-native paths such as /home/... over /mnt/c for active work.")
    elif any(name in uname for name in ("freebsd", "openbsd", "netbsd")):
        family = "bsd"
        notes.append("BSD remote: avoid GNU/Linux-only flags unless probed.")
    else:
        family = "unknown"
        notes.append("Unknown remote OS family: probe command flags before assuming Linux or macOS behavior.")

    return {
        "family": family,
        "isUnixLike": family in {"linux", "macos", "wsl2", "bsd"},
        "isWsl": family == "wsl2",
        "notes": notes,
    }


def emit_completed_process(completed: subprocess.CompletedProcess, *, text: bool) -> None:
    if text:
        if completed.stdout:
            sys.stdout.write(completed.stdout)
        if completed.stderr:
            sys.stderr.write(completed.stderr)
        stderr_for_hints = completed.stderr.encode("utf-8", errors="replace") if completed.stderr else b""
    else:
        if completed.stdout:
            sys.stdout.buffer.write(completed.stdout)
        if completed.stderr:
            sys.stderr.buffer.write(completed.stderr)
        stderr_for_hints = completed.stderr or b""
    if completed.returncode == 255 and stderr_for_hints:
        maybe_explain_ssh_failure(stderr_for_hints)


def run_ssh_capture(
    host: str,
    remote_command: str,
    ssh_options: list[str],
    *,
    stdin_bytes: bytes | None = None,
    verbose: bool = False,
    text: bool = False,
) -> subprocess.CompletedProcess:
    argv = build_ssh_argv(host, remote_command, ssh_options)
    if verbose:
        print_command(argv)
    try:
        input_payload = stdin_bytes.decode("utf-8") if text and isinstance(stdin_bytes, bytes) else stdin_bytes
        return subprocess.run(argv, input=input_payload, capture_output=True, text=text)
    except FileNotFoundError as exc:
        die(f"required local command not found: {exc.filename or 'ssh'}", exit_code=3)
        raise AssertionError("unreachable")


def maybe_explain_ssh_failure(stderr_bytes: bytes) -> None:
    stderr = stderr_bytes.decode("utf-8", errors="replace").lower()
    hints = []
    if "host key verification failed" in stderr:
        hints.append("SSH host-key verification failed. Confirm the host fingerprint or update known_hosts explicitly.")
    if "permission denied" in stderr:
        hints.append("SSH authentication failed. Check the username, SSH key selection, agent state, and remote authorized_keys.")
    if "could not resolve hostname" in stderr:
        hints.append("SSH could not resolve the hostname. Check DNS, the host/IP value, or your SSH config aliases.")
    if "connection refused" in stderr:
        hints.append("The host is reachable but refusing SSH connections. Confirm sshd is running and listening on the expected port.")
    if "operation timed out" in stderr or "connection timed out" in stderr or "no route to host" in stderr:
        hints.append("SSH could not reach the host. Check network routing, VPN/LAN reachability, firewall rules, and the target IP.")
    if "host key verification failed" in stderr or "authenticity of host" in stderr:
        hints.append("Noninteractive mode is enabled by default via BatchMode=yes, so trust prompts fail fast instead of hanging.")
    for hint in hints:
        print(f"hint: {hint}", file=sys.stderr)


def run_ssh(
    host: str,
    remote_command: str,
    ssh_options: list[str],
    *,
    stdin_bytes: bytes | None = None,
    verbose: bool = False,
) -> int:
    completed = run_ssh_capture(
        host,
        remote_command,
        ssh_options,
        stdin_bytes=stdin_bytes,
        verbose=verbose,
        text=False,
    )
    emit_completed_process(completed, text=False)
    return completed.returncode


def remote_bash_stdin_command(extra_args: list[str] | None = None) -> str:
    parts = ["bash", "-seu", "-o", "pipefail"]
    if extra_args:
        parts.append("--")
        parts.extend(extra_args)
    return shell_join(parts)


def parse_mode_string(mode: str | None) -> str | None:
    if mode is None:
        return None
    try:
        int(mode, 8)
    except ValueError:
        die(f"invalid file mode: {mode!r}; expected octal like 0644")
    return mode


def ensure_local_existing_regular_file(
    path: pathlib.Path,
    *,
    action: str,
    follow_symlinks: bool = False,
    flag: str = "--follow-symlinks",
) -> None:
    st = lstat_local_or_none(path)
    if st is None:
        die(f"local path does not exist: {path}")
    kind = kind_from_mode(st.st_mode)
    if kind == "symlink":
        if not follow_symlinks:
            die(f"refusing to {action} local symlink path: {path}; pass {flag} to follow symlinks explicitly")
        try:
            target_st = path.stat()
        except FileNotFoundError:
            die(f"local symlink is broken: {path}")
        target_kind = kind_from_mode(target_st.st_mode)
        if target_kind != "regular file":
            die(f"refusing to {action} local symlink whose target is not a regular file: {path} ({target_kind})")
        return
    if kind != "regular file":
        die(f"refusing to {action} local non-regular path: {path} ({kind})")


def ensure_local_mutable_regular_file_target(
    path: pathlib.Path,
    *,
    action: str,
    make_parents: bool,
) -> int | None:
    if make_parents:
        path.parent.mkdir(parents=True, exist_ok=True)
    elif not path.parent.exists():
        die(f"parent directory does not exist: {path.parent}")

    st = lstat_local_or_none(path)
    if st is None:
        return None
    kind = kind_from_mode(st.st_mode)
    if kind != "regular file":
        die(f"refusing to {action} local non-regular target: {path} ({kind})")
    return stat.S_IMODE(st.st_mode)


def atomic_write_local(path: pathlib.Path, data: bytes, *, make_parents: bool, mode: str | None) -> None:
    target_mode = parse_mode_string(mode)
    existing_mode = ensure_local_mutable_regular_file_target(path, action="overwrite", make_parents=make_parents)
    resolved_mode = int(target_mode, 8) if target_mode is not None else existing_mode

    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        if resolved_mode is not None:
            os.chmod(tmp_name, resolved_mode)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass


def require_exactly_one_source(options: list[tuple[str, bool]]) -> None:
    chosen = [name for name, enabled in options if enabled]
    if len(chosen) != 1:
        die("choose exactly one of " + ", ".join(name for name, _ in options))


def read_local_bytes(path: pathlib.Path, *, follow_symlinks: bool = False) -> bytes:
    ensure_local_existing_regular_file(path, action="read", follow_symlinks=follow_symlinks)
    try:
        return path.read_bytes()
    except OSError as exc:
        die(f"failed to read local file {path}: {exc}", exit_code=3)
        raise AssertionError("unreachable")


def read_local_text(path: pathlib.Path, *, encoding: str, follow_symlinks: bool = False) -> str:
    ensure_local_existing_regular_file(path, action="read", follow_symlinks=follow_symlinks)
    try:
        return path.read_text(encoding=encoding, errors="replace")
    except OSError as exc:
        die(f"failed to read local text file {path}: {exc}", exit_code=3)
        raise AssertionError("unreachable")


def sha256_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def sha256_path_local(path: pathlib.Path, *, follow_symlinks: bool = False) -> str:
    ensure_local_existing_regular_file(path, action="hash", follow_symlinks=follow_symlinks)
    try:
        h = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError as exc:
        die(f"failed to hash local file {path}: {exc}", exit_code=3)
        raise AssertionError("unreachable")


def remote_sha256(
    host: str,
    remote_path: str,
    ssh_options: list[str],
    *,
    follow_symlinks: bool = False,
    verbose: bool = False,
) -> str:
    remote_command = shell_join(["python3", "-c", REMOTE_SHA256, remote_path, "1" if follow_symlinks else "0"])
    completed = run_ssh_capture(host, remote_command, ssh_options, verbose=verbose, text=True)
    if completed.returncode != 0:
        emit_completed_process(completed, text=True)
        raise SystemExit(completed.returncode)
    return completed.stdout.strip()


def local_manifest_lines(root: pathlib.Path, *, include_sha256: bool) -> list[str]:
    if not root.exists() and not root.is_symlink():
        die(f"path does not exist: {root}")

    entries: list[str] = []

    def emit(entry: dict[str, object]) -> None:
        entries.append(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")

    def walk(path: pathlib.Path, rel: str) -> None:
        st = path.lstat()
        mode = format(stat.S_IMODE(st.st_mode), "04o")
        if stat.S_ISLNK(st.st_mode):
            emit({"mode": mode, "path": rel, "target": os.readlink(path), "type": "symlink"})
            return
        if stat.S_ISREG(st.st_mode):
            entry: dict[str, object] = {"mode": mode, "path": rel, "size": st.st_size, "type": "file"}
            if include_sha256:
                entry["sha256"] = sha256_path_local(path, follow_symlinks=False)
            emit(entry)
            return
        if stat.S_ISDIR(st.st_mode):
            if rel != ".":
                emit({"mode": mode, "path": rel, "type": "dir"})
            children = sorted(path.iterdir(), key=lambda item: item.name)
            for child in children:
                child_rel = child.name if rel == "." else f"{rel}/{child.name}"
                walk(child, child_rel)
            return
        emit({"mode": mode, "path": rel, "type": "other"})

    walk(root, ".")
    return entries


def remote_manifest_lines(
    host: str,
    remote_path: str,
    ssh_options: list[str],
    *,
    include_sha256: bool,
    verbose: bool = False,
) -> list[str]:
    remote_command = shell_join(["python3", "-c", REMOTE_TREE_MANIFEST, remote_path, "1" if include_sha256 else "0"])
    completed = run_ssh_capture(host, remote_command, ssh_options, verbose=verbose, text=True)
    if completed.returncode != 0:
        emit_completed_process(completed, text=True)
        raise SystemExit(completed.returncode)
    return completed.stdout.splitlines(keepends=True)


def stream_pipe(
    producer_argv: list[str],
    consumer_argv: list[str],
    *,
    verbose: bool = False,
    producer_env: dict[str, str] | None = None,
    consumer_env: dict[str, str] | None = None,
) -> int:
    if verbose:
        print_command(producer_argv)
        print_command(consumer_argv)
    try:
        with subprocess.Popen(producer_argv, stdout=subprocess.PIPE, env=producer_env) as producer:
            assert producer.stdout is not None
            with subprocess.Popen(consumer_argv, stdin=producer.stdout, env=consumer_env) as consumer:
                producer.stdout.close()
                consumer_rc = consumer.wait()
            producer_rc = producer.wait()
    except FileNotFoundError as exc:
        die(f"required local command not found: {exc.filename}", exit_code=3)
        raise AssertionError("unreachable")
    if consumer_rc != 0:
        return consumer_rc
    return producer_rc


def command_exec(args: argparse.Namespace) -> int:
    if args.command is not None:
        body = args.command.encode("utf-8")
    else:
        body = sys.stdin.buffer.read()
    if not body.strip():
        die("exec requires --command or a script on stdin")

    script = b""
    extra_args: list[str] = []
    if args.cwd:
        script += b'cd -- "$1"\nshift\n'
        extra_args.append(args.cwd)
    script += body
    if not script.endswith(b"\n"):
        script += b"\n"

    if args.shell == "bash":
        remote_command = remote_bash_stdin_command(extra_args)
    else:
        parts = ["sh", "-seu"]
        if extra_args:
            parts.append("--")
            parts.extend(extra_args)
        remote_command = shell_join(parts)
    return run_ssh(args.host, remote_command, args.ssh_option, stdin_bytes=script, verbose=args.verbose)


def command_doctor(args: argparse.Namespace) -> int:
    remote_command = shell_join(["sh", "-seu"])
    completed = run_ssh_capture(
        args.host,
        remote_command,
        args.ssh_option,
        stdin_bytes=DOCTOR_SCRIPT.encode("utf-8"),
        verbose=args.verbose,
        text=True,
    )
    if completed.returncode != 0:
        emit_completed_process(completed, text=True)
        return completed.returncode
    facts = parse_key_value_lines(completed.stdout)
    platform = classify_remote_platform(facts)
    if args.json:
        print_json(
            {
                "command": "doctor",
                "host": args.host,
                "facts": facts,
                "noninteractive": True,
                "platform": platform,
                "sshOptions": merged_ssh_options(args.ssh_option),
                "version": VERSION,
            }
        )
    else:
        sys.stdout.write(completed.stdout)
        print(f"ssh_unix_ops_platform={platform['family']}")
        print(f"ssh_unix_ops_unix_like={str(platform['isUnixLike']).lower()}")
        for note in platform["notes"]:
            print(f"ssh_unix_ops_note={note}")
    return 0


def command_read(args: argparse.Namespace) -> int:
    remote_command = shell_join(
        [
            "python3",
            "-c",
            REMOTE_READ,
            args.path,
            args.encoding,
            str(args.start_line),
            str(args.max_lines),
            "1" if args.follow_symlinks else "0",
        ]
    )
    return run_ssh(args.host, remote_command, args.ssh_option, verbose=args.verbose)


def command_write(args: argparse.Namespace) -> int:
    parse_mode_string(args.mode)
    data = sys.stdin.buffer.read()
    remote_command = shell_join(
        ["python3", "-c", REMOTE_WRITE, args.path, "1" if args.make_parents else "0", args.mode or "-"]
    )
    completed = run_ssh_capture(args.host, remote_command, args.ssh_option, stdin_bytes=data, verbose=args.verbose)
    if completed.returncode != 0:
        emit_completed_process(completed, text=False)
        return completed.returncode

    remote_hash: str | None = None
    if args.verify_sha256:
        local_hash = sha256_bytes(data)
        remote_hash = remote_sha256(args.host, args.path, args.ssh_option, verbose=args.verbose)
        if local_hash != remote_hash:
            print(f"sha256 mismatch after write: local={local_hash} remote={remote_hash}", file=sys.stderr)
            return 3

    if args.json:
        print_json(
            {
                "bytesWritten": len(data),
                "command": "write",
                "host": args.host,
                "path": args.path,
                "sha256": remote_hash,
                "status": "ok",
                "verified": args.verify_sha256,
                "version": VERSION,
            }
        )
    else:
        emit_completed_process(completed, text=False)
        if remote_hash is not None:
            print(f"sha256={remote_hash}", file=sys.stderr)
    return 0


def command_replace(args: argparse.Namespace) -> int:
    spec_bytes = sys.stdin.buffer.read()
    if not spec_bytes.strip():
        die("replace requires a JSON spec on stdin")
    try:
        spec = json.loads(spec_bytes)
    except json.JSONDecodeError as exc:
        die(f"replace spec is not valid JSON: {exc.msg} at line {exc.lineno} column {exc.colno}")
    edits = spec.get("edits")
    if not isinstance(edits, list) or not edits:
        die("replace spec must contain a non-empty edits array")

    remote_command = shell_join(["python3", "-c", REMOTE_REPLACE, args.path])
    completed = run_ssh_capture(args.host, remote_command, args.ssh_option, stdin_bytes=spec_bytes, verbose=args.verbose, text=True)
    if completed.returncode != 0:
        emit_completed_process(completed, text=True)
        return completed.returncode
    if args.json:
        print_json(
            {
                "command": "replace",
                "editsRequested": len(edits),
                "host": args.host,
                "path": args.path,
                "status": "ok",
                "version": VERSION,
            }
        )
    else:
        emit_completed_process(completed, text=True)
    return 0


def command_upload(args: argparse.Namespace) -> int:
    parse_mode_string(args.mode)
    local_path = pathlib.Path(args.local_path)
    data = read_local_bytes(local_path, follow_symlinks=args.follow_symlinks)
    remote_command = shell_join(
        [
            "python3",
            "-c",
            REMOTE_WRITE,
            args.remote_path,
            "1" if args.make_parents else "0",
            args.mode or "-",
        ]
    )
    completed = run_ssh_capture(args.host, remote_command, args.ssh_option, stdin_bytes=data, verbose=args.verbose)
    if completed.returncode != 0:
        emit_completed_process(completed, text=False)
        return completed.returncode

    remote_hash: str | None = None
    if args.verify_sha256:
        local_hash = sha256_path_local(local_path, follow_symlinks=args.follow_symlinks)
        remote_hash = remote_sha256(args.host, args.remote_path, args.ssh_option, verbose=args.verbose)
        if local_hash != remote_hash:
            print(f"sha256 mismatch after upload: local={local_hash} remote={remote_hash}", file=sys.stderr)
            return 3

    if args.json:
        print_json(
            {
                "bytesUploaded": len(data),
                "command": "upload",
                "host": args.host,
                "localPath": str(local_path),
                "remotePath": args.remote_path,
                "sha256": remote_hash,
                "status": "ok",
                "verified": args.verify_sha256,
                "version": VERSION,
            }
        )
    else:
        emit_completed_process(completed, text=False)
        if remote_hash is not None:
            print(f"sha256={remote_hash}", file=sys.stderr)
    return 0


def command_download(args: argparse.Namespace) -> int:
    parse_mode_string(args.mode)
    remote_command = shell_join(["python3", "-c", REMOTE_SLURP, args.remote_path, "1" if args.follow_symlinks else "0"])
    completed = run_ssh_capture(args.host, remote_command, args.ssh_option, verbose=args.verbose)
    if completed.returncode != 0:
        emit_completed_process(completed, text=False)
        return completed.returncode

    local_path = pathlib.Path(args.local_path)
    atomic_write_local(local_path, completed.stdout, make_parents=args.make_parents, mode=args.mode)

    remote_hash: str | None = None
    if args.verify_sha256:
        local_hash = sha256_bytes(completed.stdout)
        remote_hash = remote_sha256(
            args.host,
            args.remote_path,
            args.ssh_option,
            follow_symlinks=args.follow_symlinks,
            verbose=args.verbose,
        )
        if local_hash != remote_hash:
            print(f"sha256 mismatch after download: local={local_hash} remote={remote_hash}", file=sys.stderr)
            return 3

    if args.json:
        print_json(
            {
                "bytesDownloaded": len(completed.stdout),
                "command": "download",
                "host": args.host,
                "localPath": str(local_path),
                "remotePath": args.remote_path,
                "sha256": remote_hash,
                "status": "ok",
                "verified": args.verify_sha256,
                "version": VERSION,
            }
        )
    else:
        print(f"downloaded {len(completed.stdout)} bytes to {local_path}", file=sys.stderr)
        if remote_hash is not None:
            print(f"sha256={remote_hash}", file=sys.stderr)
    return 0


def command_backup(args: argparse.Namespace) -> int:
    dest = args.dest or f"{args.path}.{dt.datetime.now(dt.UTC).strftime('%Y%m%dT%H%M%SZ')}.bak"
    remote_command = shell_join(
        ["python3", "-c", REMOTE_BACKUP, args.path, dest, "1" if args.follow_symlinks else "0"]
    )
    completed = run_ssh_capture(args.host, remote_command, args.ssh_option, verbose=args.verbose, text=True)
    if completed.returncode != 0:
        emit_completed_process(completed, text=True)
        return completed.returncode
    backup_path = completed.stdout.strip()
    if args.json:
        print_json(
            {
                "backupPath": backup_path,
                "command": "backup",
                "followSymlinks": args.follow_symlinks,
                "host": args.host,
                "sourcePath": args.path,
                "status": "ok",
                "version": VERSION,
            }
        )
    else:
        sys.stdout.write(completed.stdout)
    return 0


def command_restore(args: argparse.Namespace) -> int:
    remote_command = shell_join(
        ["python3", "-c", REMOTE_RESTORE, args.path, args.from_backup, "1" if args.make_parents else "0"]
    )
    completed = run_ssh_capture(args.host, remote_command, args.ssh_option, verbose=args.verbose, text=True)
    if completed.returncode != 0:
        emit_completed_process(completed, text=True)
        return completed.returncode
    restored_path = completed.stdout.strip()
    if args.json:
        print_json(
            {
                "command": "restore",
                "fromBackup": args.from_backup,
                "host": args.host,
                "path": restored_path,
                "status": "ok",
                "version": VERSION,
            }
        )
    else:
        sys.stdout.write(completed.stdout)
    return 0


def command_diff(args: argparse.Namespace) -> int:
    require_exactly_one_source([("--local-path", args.local_path is not None), ("--stdin", args.stdin)])
    remote_command = shell_join(
        [
            "python3",
            "-c",
            REMOTE_READ,
            args.remote_path,
            args.encoding,
            "1",
            "-1",
            "1" if args.follow_symlinks else "0",
        ]
    )
    completed = run_ssh_capture(args.host, remote_command, args.ssh_option, verbose=args.verbose, text=True)
    if completed.returncode != 0:
        emit_completed_process(completed, text=True)
        return completed.returncode
    remote_text = completed.stdout

    if args.local_path is not None:
        local_label = args.local_path
        local_text = read_local_text(pathlib.Path(args.local_path), encoding=args.encoding, follow_symlinks=args.follow_symlinks)
    else:
        local_label = args.stdin_label
        local_text = sys.stdin.buffer.read().decode(args.encoding, errors="replace")

    remote_lines = remote_text.splitlines(keepends=True)
    local_lines = local_text.splitlines(keepends=True)
    if remote_lines == local_lines:
        return 0
    diff = difflib.unified_diff(remote_lines, local_lines, fromfile=args.remote_path, tofile=local_label, n=args.context)
    sys.stdout.writelines(diff)
    return 1


def command_sha256(args: argparse.Namespace) -> int:
    require_exactly_one_source([("--local-path", args.local_path is not None), ("--remote-path", args.remote_path is not None)])
    if args.local_path is not None:
        local_path = pathlib.Path(args.local_path)
        digest = sha256_path_local(local_path, follow_symlinks=args.follow_symlinks)
        if args.json:
            print_json(
                {
                    "command": "sha256",
                    "path": str(local_path),
                    "scope": "local",
                    "sha256": digest,
                    "version": VERSION,
                }
            )
        else:
            print(f"{digest}  {local_path}")
        return 0
    if not args.host:
        die("--host is required when using --remote-path")
    digest = remote_sha256(args.host, args.remote_path, args.ssh_option, follow_symlinks=args.follow_symlinks, verbose=args.verbose)
    if args.json:
        print_json(
            {
                "command": "sha256",
                "host": args.host,
                "path": args.remote_path,
                "scope": "remote",
                "sha256": digest,
                "version": VERSION,
            }
        )
    else:
        print(f"{digest}  {args.remote_path}")
    return 0


def command_upload_tree(args: argparse.Namespace) -> int:
    local_path = pathlib.Path(args.local_path)
    if not local_path.exists():
        die(f"local directory does not exist: {local_path}")
    if not local_path.is_dir():
        die(f"expected a local directory, got: {local_path}")
    producer = ["tar", "--no-xattrs", "-C", str(local_path), "-cf", "-", "."]
    producer_env = os.environ.copy()
    producer_env.setdefault("COPYFILE_DISABLE", "1")
    remote_script = 'set -euo pipefail; mkdir -p -- "$1"; tar --no-same-owner -C "$1" -xf -'
    consumer = build_ssh_argv(args.host, shell_join(["bash", "-c", remote_script, "bash", args.remote_path]), args.ssh_option)
    return stream_pipe(producer, consumer, verbose=args.verbose, producer_env=producer_env)


def command_download_tree(args: argparse.Namespace) -> int:
    local_path = pathlib.Path(args.local_path)
    if local_path.exists() and not local_path.is_dir():
        die(f"expected a local directory destination, got a file: {local_path}")
    local_path.mkdir(parents=True, exist_ok=True)
    remote_script = 'set -euo pipefail; test -d "$1"; tar -C "$1" -cf - .'
    producer = build_ssh_argv(args.host, shell_join(["bash", "-c", remote_script, "bash", args.remote_path]), args.ssh_option)
    consumer = ["tar", "--no-same-owner", "-C", str(local_path), "-xf", "-"]
    consumer_env = os.environ.copy()
    consumer_env.setdefault("COPYFILE_DISABLE", "1")
    return stream_pipe(producer, consumer, verbose=args.verbose, consumer_env=consumer_env)


def command_tree_diff(args: argparse.Namespace) -> int:
    remote_lines = remote_manifest_lines(
        args.host,
        args.remote_path,
        args.ssh_option,
        include_sha256=args.checksum,
        verbose=args.verbose,
    )
    local_lines = local_manifest_lines(pathlib.Path(args.local_path), include_sha256=args.checksum)
    if remote_lines == local_lines:
        return 0
    diff = difflib.unified_diff(
        remote_lines,
        local_lines,
        fromfile=args.remote_path,
        tofile=args.local_path,
        n=args.context,
    )
    sys.stdout.writelines(diff)
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = FriendlyArgumentParser(
        description="Safe SSH helper for remote Unix-like command execution, file transfer, backup, diffing, and exact edits.",
        epilog=HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--verbose", action="store_true", help="print resolved local ssh/tar commands to stderr")
    parser.add_argument("--version", action="version", version=f"%(prog)s {VERSION}")
    subparsers = parser.add_subparsers(dest="subcommand", required=True, metavar="command")

    def add_common(subparser: argparse.ArgumentParser) -> None:
        subparser.add_argument("--host", required=True, help="SSH target, e.g. user@example-host")
        subparser.add_argument(
            "--ssh-option",
            action="append",
            default=[],
            help="repeatable ssh -o option, e.g. ProxyJump=bastion or StrictHostKeyChecking=yes",
        )

    doctor = subparsers.add_parser(
        "doctor",
        help="probe the remote host and report shell/tool prerequisites",
        description="Check remote user, shell, OS, and availability of bash, python3, tar, rsync, and WSL-related tooling. SSH runs noninteractively by default via BatchMode=yes.",
    )
    add_common(doctor)
    doctor.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    doctor.set_defaults(func=command_doctor)

    exec_parser = subparsers.add_parser(
        "exec",
        help="run a remote script safely via stdin",
        description="Run commands on the remote host using bash -seu -o pipefail by default, avoiding fragile quoted ssh command strings. SSH runs noninteractively by default via BatchMode=yes.",
    )
    add_common(exec_parser)
    exec_parser.add_argument("--cwd", help="remote working directory to cd into before running the script")
    exec_parser.add_argument("--command", help="single command string to run instead of reading the script from stdin")
    exec_parser.add_argument(
        "--shell",
        choices=["bash", "sh"],
        default="bash",
        help="remote shell to force; bash is recommended because it enables pipefail; sh mode still keeps set -u",
    )
    exec_parser.set_defaults(func=command_exec)

    read_parser = subparsers.add_parser(
        "read",
        help="read a remote text file safely",
        description="Read a remote text file without hand-quoting its path, with optional line slicing. Symlinks and special files are refused unless --follow-symlinks is set.",
    )
    add_common(read_parser)
    read_parser.add_argument("--path", required=True, help="remote file path")
    read_parser.add_argument("--encoding", default="utf-8", help="text encoding to use on the remote host")
    read_parser.add_argument("--start-line", type=int, default=1, help="1-indexed starting line number")
    read_parser.add_argument("--max-lines", type=int, default=-1, help="maximum number of lines to print; -1 prints through EOF")
    read_parser.add_argument("--follow-symlinks", action="store_true", help="follow remote symlink sources explicitly")
    read_parser.set_defaults(func=command_read)

    write_parser = subparsers.add_parser(
        "write",
        help="atomically overwrite a remote file from stdin",
        description="Write stdin to a remote file via a temp file + rename workflow. Use this when you are replacing the full file content. Existing symlink and special-file targets are refused.",
    )
    add_common(write_parser)
    write_parser.add_argument("--path", required=True, help="remote file path")
    write_parser.add_argument("--make-parents", action="store_true", help="create parent directories when missing")
    write_parser.add_argument("--mode", help="octal file mode, e.g. 0644; default preserves existing mode when possible")
    write_parser.add_argument("--verify-sha256", action="store_true", help="hash local stdin bytes and remote file after write")
    write_parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    write_parser.set_defaults(func=command_write)

    replace_parser = subparsers.add_parser(
        "replace",
        help="apply exact text edits to an existing remote file",
        description="Apply exact-match text replacements against the original remote file. The command fails if match counts drift or edits overlap. Symlink and special-file targets are refused.",
    )
    add_common(replace_parser)
    replace_parser.add_argument("--path", required=True, help="remote file path")
    replace_parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    replace_parser.set_defaults(func=command_replace)

    upload_parser = subparsers.add_parser(
        "upload",
        help="upload one local file atomically to the remote host",
        description="Copy a local file to a remote destination using an atomic temp-file write on the remote side. Local symlink sources are refused unless --follow-symlinks is set; remote symlink targets are always refused.",
    )
    add_common(upload_parser)
    upload_parser.add_argument("--local-path", required=True, help="local file to upload")
    upload_parser.add_argument("--remote-path", required=True, help="destination path on the remote host")
    upload_parser.add_argument("--make-parents", action="store_true", help="create remote parent directories when missing")
    upload_parser.add_argument("--mode", help="remote octal file mode, e.g. 0644")
    upload_parser.add_argument("--verify-sha256", action="store_true", help="verify remote file checksum after upload")
    upload_parser.add_argument("--follow-symlinks", action="store_true", help="follow local symlink sources explicitly")
    upload_parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    upload_parser.set_defaults(func=command_upload)

    download_parser = subparsers.add_parser(
        "download",
        help="download one remote file atomically to the local machine",
        description="Copy a remote file to a local destination using an atomic temp-file write on the local side. Remote symlink sources are refused unless --follow-symlinks is set; local symlink targets are always refused.",
    )
    add_common(download_parser)
    download_parser.add_argument("--remote-path", required=True, help="source path on the remote host")
    download_parser.add_argument("--local-path", required=True, help="destination local path")
    download_parser.add_argument("--make-parents", action="store_true", help="create local parent directories when missing")
    download_parser.add_argument("--mode", help="local octal file mode, e.g. 0644")
    download_parser.add_argument("--verify-sha256", action="store_true", help="verify local bytes against remote checksum")
    download_parser.add_argument("--follow-symlinks", action="store_true", help="follow remote symlink sources explicitly")
    download_parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    download_parser.set_defaults(func=command_download)

    sha_parser = subparsers.add_parser(
        "sha256",
        help="compute sha256 for one local or remote file",
        description="Hash either a local file or a remote file. Symlink sources are refused unless --follow-symlinks is set.",
    )
    sha_parser.add_argument("--host", help="SSH target when hashing a remote file")
    sha_parser.add_argument(
        "--ssh-option",
        action="append",
        default=[],
        help="repeatable ssh -o option, e.g. ProxyJump=bastion or StrictHostKeyChecking=yes",
    )
    sha_parser.add_argument("--remote-path", help="remote file path")
    sha_parser.add_argument("--local-path", help="local file path")
    sha_parser.add_argument("--follow-symlinks", action="store_true", help="follow symlink sources explicitly")
    sha_parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    sha_parser.set_defaults(func=command_sha256)

    backup_parser = subparsers.add_parser(
        "backup",
        help="create a timestamped rollback copy of a remote file",
        description="Create a point-in-time rollback copy of a remote regular file before risky edits. Remote symlink sources are refused unless --follow-symlinks is set.",
    )
    add_common(backup_parser)
    backup_parser.add_argument("--path", required=True, help="remote regular file to back up")
    backup_parser.add_argument("--dest", help="explicit remote backup path; default is <path>.<timestamp>.bak")
    backup_parser.add_argument("--follow-symlinks", action="store_true", help="follow remote symlink sources explicitly")
    backup_parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    backup_parser.set_defaults(func=command_backup)

    restore_parser = subparsers.add_parser(
        "restore",
        help="restore a remote file from a backup copy",
        description="Roll a remote regular file back from a previously created backup copy. Existing symlink and special-file targets are refused.",
    )
    add_common(restore_parser)
    restore_parser.add_argument("--path", required=True, help="remote destination path to restore")
    restore_parser.add_argument("--from-backup", required=True, help="remote backup file path")
    restore_parser.add_argument("--make-parents", action="store_true", help="create parent directories when missing")
    restore_parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    restore_parser.set_defaults(func=command_restore)

    diff_parser = subparsers.add_parser(
        "diff",
        help="show a unified diff between remote text and local text/stdin",
        description="Preview a proposed text change by comparing a remote file against a local file or stdin. Exit code 1 means 'different', not failure. Symlink file sources are refused unless --follow-symlinks is set.",
    )
    add_common(diff_parser)
    diff_parser.add_argument("--remote-path", required=True, help="remote text file path")
    diff_parser.add_argument("--encoding", default="utf-8", help="text encoding for both sides")
    diff_parser.add_argument("--local-path", help="local text file to compare against")
    diff_parser.add_argument("--stdin", action="store_true", help="read comparison text from stdin")
    diff_parser.add_argument("--stdin-label", default="stdin", help="label to use for stdin content in unified diff output")
    diff_parser.add_argument("--context", type=int, default=3, help="context lines in unified diff output")
    diff_parser.add_argument("--follow-symlinks", action="store_true", help="follow local/remote symlink file sources explicitly")
    diff_parser.set_defaults(func=command_diff)

    upload_tree_parser = subparsers.add_parser(
        "upload-tree",
        help="stream a local directory tree into a remote directory",
        description="Transfer a local directory tree by piping tar over SSH. This merges into the destination; it is not an exact sync, is not atomic, and defaults to --no-same-owner on extraction.",
    )
    add_common(upload_tree_parser)
    upload_tree_parser.add_argument("--local-path", required=True, help="local directory whose contents will be streamed")
    upload_tree_parser.add_argument("--remote-path", required=True, help="remote destination directory")
    upload_tree_parser.set_defaults(func=command_upload_tree)

    download_tree_parser = subparsers.add_parser(
        "download-tree",
        help="stream a remote directory tree into a local directory",
        description="Transfer a remote directory tree by piping tar over SSH. This extracts into the local destination directory, is not atomic, and defaults to --no-same-owner on extraction.",
    )
    add_common(download_tree_parser)
    download_tree_parser.add_argument("--remote-path", required=True, help="remote source directory")
    download_tree_parser.add_argument("--local-path", required=True, help="local destination directory")
    download_tree_parser.set_defaults(func=command_download_tree)

    tree_diff_parser = subparsers.add_parser(
        "tree-diff",
        help="show a unified diff between remote and local file trees",
        description="Compare a remote file tree to a local file tree. Add --checksum to include file content hashes, not just metadata. Exit code 1 means 'different', not failure.",
    )
    add_common(tree_diff_parser)
    tree_diff_parser.add_argument("--remote-path", required=True, help="remote file or directory")
    tree_diff_parser.add_argument("--local-path", required=True, help="local file or directory")
    tree_diff_parser.add_argument("--checksum", action="store_true", help="include sha256 for file content comparison")
    tree_diff_parser.add_argument("--context", type=int, default=3, help="context lines in unified diff output")
    tree_diff_parser.set_defaults(func=command_tree_diff)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
