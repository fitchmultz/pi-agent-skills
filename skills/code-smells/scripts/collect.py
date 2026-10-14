#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["lizard>=1.24.1,<2", "pathspec>=1.0,<2"]
# ///
"""Collect current-file evidence, not smell judgments. No source is modified."""

import argparse
import codecs
from collections import Counter
from contextlib import redirect_stderr
import hashlib
from importlib.metadata import version
import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tokenize

import lizard
from lizard_languages import get_reader_for
from pathspec import GitIgnoreSpec


def git(directory, *args):
    return subprocess.run(
        ["git", "-C", str(directory), *args],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env={**os.environ, "LC_ALL": "C"},
    )


def git_root(directory):
    if not shutil.which("git"):
        return None
    result = git(directory, "rev-parse", "--show-toplevel")
    if result.returncode == 0:
        return Path(os.fsdecode(result.stdout.removesuffix(b"\n"))).resolve()
    if b"not a git repository" in result.stderr:
        return None
    raise ValueError(os.fsdecode(result.stderr).strip())


def within(path, parent):
    return path == parent or parent in path.parents


def selected(path, scopes):
    return any(within(path, scope) for scope in scopes)


def symlink_parent(path, root):
    return next((p for p in path.parents if within(p, root) and p.is_symlink()), None)


def git_inventory(root, scopes):
    paths = [f":(literal){p.relative_to(root).as_posix()}" for p in scopes if p != root]
    if root in scopes:
        paths = []

    def listing(*options, scoped=True):
        result = git(root, "ls-files", "-z", *options, "--", *(paths if scoped else []))
        if result.returncode:
            raise ValueError(os.fsdecode(result.stderr).strip())
        return [os.fsdecode(p) for p in result.stdout.split(b"\0") if p]

    files = {}
    # A pathspec inside a gitlink omits the gitlink itself. Retain that boundary
    # so a scoped scan cannot mistake an unexpanded submodule for an empty area.
    for entry in listing("--cached", "--stage", scoped=False):
        details, name = entry.split("\t", 1)
        origin = "submodule" if details.startswith("160000 ") else "tracked"
        path = root / name
        if selected(path, scopes) or (origin == "submodule" and any(within(scope, path) for scope in scopes)):
            files[name] = origin
    for name in listing("--others", "--exclude-standard"):
        files.setdefault(name.rstrip("/"), "untracked")
    exclusions = [
        {"path": name, "reason": "git_ignored"}
        for name in listing("--others", "--ignored", "--exclude-standard", "--directory")
    ]
    return files, exclusions, []


def filesystem_inventory(root, scopes):
    files, exclusions, errors = {}, [], []
    pending = [(root, [])]
    while pending:
        directory, inherited = pending.pop()
        rules = inherited
        ignore = directory / ".gitignore"
        if ignore.is_file() and not ignore.is_symlink():
            try:
                spec = GitIgnoreSpec.from_lines(ignore.read_text(encoding="utf-8-sig").splitlines())
                rules = [*inherited, (directory, spec)]
            except (OSError, UnicodeError, ValueError) as error:
                errors.append({"path": ignore.relative_to(root).as_posix(), "error": str(error)})
        try:
            entries = sorted(directory.iterdir())
        except OSError as error:
            errors.append({"path": directory.relative_to(root).as_posix(), "error": str(error)})
            continue
        for path in entries:
            if not (selected(path, scopes) or any(within(scope, path) for scope in scopes)):
                continue
            relative = path.relative_to(root).as_posix()
            if path.name == ".git":
                exclusions.append({"path": relative, "reason": "git_metadata"})
                continue
            try:
                is_directory = stat.S_ISDIR(path.lstat().st_mode)
            except OSError:
                files[relative] = "filesystem"  # The file record retains the read/stat error.
                continue
            ignored = False
            for base, spec in rules:
                match = spec.check_file(path.relative_to(base).as_posix() + ("/" if is_directory else ""))
                if match.include is not None:
                    ignored = match.include
            if ignored:
                exclusions.append({"path": relative + ("/" if is_directory else ""), "reason": "gitignore"})
            elif is_directory:
                pending.append((path, rules))
            else:
                files[relative] = "filesystem"

    return files, exclusions, errors


def decode_source(data, path):
    for bom, encoding in (
        (codecs.BOM_UTF32_LE, "utf-32"), (codecs.BOM_UTF32_BE, "utf-32"),
        (codecs.BOM_UTF16_LE, "utf-16"), (codecs.BOM_UTF16_BE, "utf-16"),
    ):
        if data.startswith(bom):
            return data.decode(encoding), encoding
    if b"\0" in data:
        return None, None
    encoding = tokenize.detect_encoding(io.BytesIO(data).readline)[0] if path.suffix == ".py" else "utf-8-sig"
    return data.decode(encoding), encoding


def collect_file(root, name, origin):
    path = root / name
    record = {
        "path": name, "inventory": origin, "status": None,
        "sha256": None, "bytes": None, "lines": None, "parser": None,
        "nloc": None, "token_count": None, "functions": [],
    }
    try:
        ancestor = symlink_parent(path, root)
        if ancestor:
            record.update(status="symlink", error=f"Not followed: parent {ancestor.relative_to(root)}")
            return record
        mode = path.lstat().st_mode
        if stat.S_ISLNK(mode):
            record.update(status="symlink", target=os.readlink(path))
            return record
        if origin == "submodule" or stat.S_ISDIR(mode):
            record.update(status="submodule" if origin == "submodule" else "unexpanded_directory")
            return record
        if not stat.S_ISREG(mode):
            record["status"] = "special_file"
            return record
        # Refuse symlink replacements and avoid blocking on a raced FIFO.
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
        with os.fdopen(descriptor, "rb") as source:
            if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
                record["status"] = "special_file"
                return record
            data = source.read()
    except FileNotFoundError as error:
        record.update(status="deleted" if origin == "tracked" else "unreadable", error=str(error))
        return record
    except OSError as error:
        record.update(status="unreadable", error=str(error))
        return record

    record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    try:
        text, encoding = decode_source(data, path)
    except (UnicodeError, SyntaxError, LookupError) as error:
        record.update(status="decode_error", error=str(error))
        return record
    if text is None:
        record["status"] = "binary"
        return record
    record.update(encoding=encoding, lines=len(text.splitlines()))
    # Lizard's filename regex rejects newlines in otherwise supported filenames.
    parser_name = name.replace("\n", "_")
    reader = get_reader_for(parser_name)
    if reader is None:
        record["status"] = "unsupported"
        return record
    record["parser"] = reader.__name__
    diagnostics = io.StringIO()
    try:
        # The source API returns every function, unlike the warning-filtered CLI.
        with redirect_stderr(diagnostics):
            result = lizard.analyze_file.analyze_source_code(parser_name, text)
        record.update(
            status="analyzed", nloc=result.nloc, token_count=result.token_count,
            functions=[{
                "name": function.name,
                "long_name": function.long_name,
                "start_line": function.start_line,
                "end_line": function.end_line,
                "length": function.length,
                "nloc": function.nloc,
                "token_count": function.token_count,
                "cyclomatic_complexity": function.cyclomatic_complexity,
                "parameter_count": function.parameter_count,
                "parameters": function.parameters,
                "full_parameters": function.full_parameters,
            } for function in result.function_list],
        )
    except Exception as error:
        record.update(status="parser_error", error=f"{type(error).__name__}: {error}")
    # Lizard can swallow RecursionError and return partial metrics with stderr.
    if diagnostics.getvalue():
        record.update(status="parser_error", diagnostics=diagnostics.getvalue())
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, help="Project root (default: current Git root, otherwise cwd)")
    parser.add_argument("--scope", action="append", type=Path, help="File/directory relative to root; repeat for multiple scopes")
    parser.add_argument("--output", required=True, type=Path, help="New JSON evidence file outside the source scopes; parent must exist")
    args = parser.parse_args()
    try:
        root = args.root.resolve() if args.root else (git_root(Path.cwd()) or Path.cwd())
        if not root.is_dir():
            raise ValueError(f"Root is not a directory: {root}")
        scopes = sorted(set(Path(os.path.abspath(root / scope)) for scope in (args.scope or [root])))
        for scope in scopes:
            if not within(scope, root):
                raise ValueError(f"Scope is outside root: {scope}")
            if ".git" in scope.relative_to(root).parts:
                raise ValueError(f"Scope is Git metadata: {scope}")
            if symlink_parent(scope, root):
                raise ValueError(f"Scope traverses a symlink: {scope}")
            if not os.path.lexists(scope):
                raise ValueError(f"Scope does not exist: {scope}")
        if os.path.lexists(args.output):
            raise ValueError(f"Output already exists; choose a new evidence path: {args.output}")
        output = args.output.resolve()
        if selected(output, scopes):
            raise ValueError("Output must be outside the source scopes")
        if within(output, root) and ".git" in output.relative_to(root).parts:
            raise ValueError("Output must not be Git metadata")
        if not output.parent.is_dir():
            raise ValueError(f"Output parent does not exist: {output.parent}")
        using_git = git_root(root) is not None
        inventory, exclusions, errors = (git_inventory if using_git else filesystem_inventory)(root, scopes)
        if using_git and os.path.lexists(root / ".git"):
            exclusions.append({"path": ".git", "reason": "git_metadata"})
        files = [
            collect_file(root, name, origin) for name, origin in sorted(inventory.items())
            if ".git" not in Path(name).parts
        ]
        counts = dict(sorted(Counter(file["status"] for file in files).items()))
        artifact = {
            "schema_version": 1,
            "root": str(root),
            "scopes": [scope.relative_to(root).as_posix() for scope in scopes],
            "inventory": "git" if using_git else "filesystem",
            "tools": {"lizard": version("lizard"), "pathspec": version("pathspec")},
            "files": files, "exclusions": exclusions, "inventory_errors": errors,
            "coverage": {
                "inventory_complete": not errors and not any(
                    counts.get(status) for status in ("unexpanded_directory", "submodule")
                ),
                "files": len(files), "statuses": counts,
                "functions": sum(len(file["functions"]) for file in files),
                "limitations": [
                    "Lizard extracts lexical metrics; it does not validate syntax or prove semantic correctness.",
                    "Only recognized Lizard languages receive function metrics; other text remains inventoried.",
                    "Symlinks, Git submodules, and nested repository directories are not traversed.",
                    "Non-Git traversal uses nested .gitignore files, not Git global or info/exclude rules.",
                    "Non-BOM text must be UTF-8, except Python source with a declared encoding.",
                    "Files are read individually from the live working tree, not an atomic filesystem snapshot.",
                ],
            },
        }
        with output.open("x", encoding="utf-8") as destination:
            json.dump(artifact, destination, indent=2, ensure_ascii=True)
            destination.write("\n")
        print(output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"collect: {error}\n")


if __name__ == "__main__":
    main()
