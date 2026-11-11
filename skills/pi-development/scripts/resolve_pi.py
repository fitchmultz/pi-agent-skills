#!/usr/bin/env python3
"""Resolve the package root behind the active pi command, and compare that host with the skill's stamp."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, NoReturn, Optional, Tuple

PACKAGE_NAME = "@earendil-works/pi-coding-agent"
PACKAGE_RELATIVE = Path("@earendil-works") / "pi-coding-agent"
SKILL_FILE = Path(__file__).resolve().parent.parent / "SKILL.md"


def fail(message: str) -> NoReturn:
    print(f"resolve_pi.py: {message}", file=sys.stderr)
    raise SystemExit(1)


def command_path(value: Optional[str]) -> Path:
    if value:
        expanded = Path(value).expanduser()
        resolved = shutil.which(value) if len(expanded.parts) == 1 else str(expanded)
    else:
        resolved = shutil.which("pi")
    if not resolved:
        fail("pi is not on PATH; pass --pi PATH")
    path = Path(resolved).absolute()
    if not path.is_file():
        fail(f"pi executable does not exist: {path}")
    return path


def unwrap_shim(path: Path) -> Tuple[Path, str]:
    text = path.as_posix()
    if "/mise/shims/" in text:
        manager = "mise"
    elif "/.asdf/shims/" in text or "/asdf/shims/" in text:
        manager = "asdf"
    else:
        return path, "direct"

    executable = shutil.which(manager)
    if not executable:
        fail(f"{path} is a {manager} shim, but {manager} is not on PATH")
    try:
        result = subprocess.run(
            [executable, "which", "pi"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        detail = getattr(error, "stderr", "") or str(error)
        fail(f"cannot resolve {manager} shim {path}: {detail.strip()}")
    target = result.stdout.strip()
    if not target:
        fail(f"{manager} returned no target for {path}")
    return Path(target).expanduser().absolute(), manager


def package_at(path: Path) -> Optional[Dict[str, Any]]:
    manifest = path / "package.json"
    if not manifest.is_file() or not (path / "docs" / "extensions.md").is_file():
        return None
    try:
        package = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return (
        package
        if isinstance(package, dict)
        and package.get("name") == PACKAGE_NAME
        and isinstance(package.get("version"), str)
        else None
    )


def find_package(executable: Path) -> Tuple[Path, Dict[str, Any], str]:
    real = executable.resolve(strict=True)
    for candidate in real.parents:
        package = package_at(candidate)
        if package:
            return candidate.resolve(), package, "executable-ancestor"

    launcher_dir = executable.parent
    layouts = (
        ("npm-launcher-node_modules", launcher_dir / "node_modules" / PACKAGE_RELATIVE),
        ("npm-prefix-lib", launcher_dir.parent / "lib" / "node_modules" / PACKAGE_RELATIVE),
    )
    for resolution, candidate in layouts:
        package = package_at(candidate)
        if package:
            return candidate.resolve(), package, resolution

    fail(f"cannot find {PACKAGE_NAME} for launcher {executable}")


def read_stamp() -> Tuple[str, str]:
    """The official release and the fork commit that the skill was last checked against."""
    try:
        frontmatter = SKILL_FILE.read_text(encoding="utf-8").split("\n---\n", 1)[0]
    except OSError as error:
        fail(f"cannot read the skill stamp: {error}")
    values = []
    for key, shape in (("last-verified-pi", r"\d+\.\d+\.\d+"), ("fork-source", r"[0-9a-f]{40}")):
        match = re.search(rf'^  {key}: "({shape})"$', frontmatter, re.MULTILINE)
        if not match:
            fail(f'{SKILL_FILE} has no `  {key}: "<value>"` line in its frontmatter')
        values.append(match.group(1))
    return values[0], values[1]


def fork_release_commit(root: Path) -> Optional[str]:
    """The commit in the receipt that the fork installer writes beside a release's node_modules."""
    try:
        receipt = json.loads((root.parent.parent.parent / "fork-release.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    commit = receipt.get("commit") if isinstance(receipt, dict) else None
    return commit if isinstance(commit, str) else None


def release_number(version: str) -> Optional[Tuple[int, ...]]:
    match = re.match(r"(\d+)\.(\d+)\.(\d+)", version)
    return tuple(int(part) for part in match.groups()) if match else None


def compare_with_stamp(root: Path, version: str, fork_commit: Optional[str]) -> Dict[str, Any]:
    """The stamp beside the installed host, and what to read or do when they differ."""
    stamp_version, stamp_commit = read_stamp()
    changelog = root / "CHANGELOG.md"
    host_wins = f"The installed host wins over the skill: read {{sections}} of {changelog} before you copy an API from the skill."
    installed, stamped = release_number(version), release_number(stamp_version)
    if installed and stamped and installed < stamped:
        match = False
        note = (
            f"The installed version {version} is older than the stamp {stamp_version}. Do not build for it. "
            "Update the host first: `pi update` on official Pi, `pi update --fork` on the fork."
        )
    elif fork_commit:
        match = fork_commit == stamp_commit
        note = (
            "The installed fork commit equals the stamp."
            if match
            else f"The installed fork commit {fork_commit} differs from the stamp {stamp_commit}. "
            + host_wins.format(sections="the [Unreleased] section and the newer version sections")
            + " If the installed commit is older than the stamp, update the host first: `pi update --fork`."
        )
    else:
        match = version == stamp_version
        note = (
            f"The installed version equals the stamp {stamp_version}. No fork release receipt was found, "
            "so no fork commit was compared."
            if match
            else f"The installed version {version} differs from the stamp {stamp_version}. "
            + host_wins.format(sections=f"the version sections that are newer than {stamp_version}")
        )
    return {
        "forkCommit": fork_commit,
        "stampPiVersion": stamp_version,
        "stampForkCommit": stamp_commit,
        "stampMatch": match,
        "stampNote": note,
        "changelog": None if match else str(changelog),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pi", help="pi command or executable path (default: active PATH entry)")
    parser.add_argument("--json", action="store_true", help="print resolution details as JSON")
    args = parser.parse_args()

    invoked = None
    try:
        override = os.environ.get("PI_PACKAGE_DIR") if not args.pi else None
        if override:
            candidate = Path(override).expanduser().resolve()
            package = package_at(candidate)
            if not package:
                fail(f"PI_PACKAGE_DIR does not contain a verified {PACKAGE_NAME}: {candidate}")
            root, package, package_resolution = candidate, package, "PI_PACKAGE_DIR"
            real = None
            launcher_resolution = "skipped-PI_PACKAGE_DIR"
        else:
            invoked = command_path(args.pi)
            executable, launcher_resolution = unwrap_shim(invoked)
            root, package, package_resolution = find_package(executable)
            real = executable.resolve(strict=True)
    except OSError as error:
        fail(str(error))

    if args.json:
        print(
            json.dumps(
                {
                    "piBin": str(invoked) if invoked else None,
                    "piExecutable": str(real) if real else None,
                    "packageResolution": package_resolution,
                    "packageRoot": str(root),
                    "packageVersion": package.get("version"),
                    "launcherResolution": launcher_resolution,
                    **compare_with_stamp(root, package["version"], fork_release_commit(root)),
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(root)


if __name__ == "__main__":
    main()
