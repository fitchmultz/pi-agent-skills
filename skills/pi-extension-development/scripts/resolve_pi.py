#!/usr/bin/env python3
"""Resolve the package root behind the active pi command."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, NoReturn, Optional, Tuple

PACKAGE_NAME = "@earendil-works/pi-coding-agent"
PACKAGE_RELATIVE = Path("@earendil-works") / "pi-coding-agent"


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
    override = os.environ.get("PI_PACKAGE_DIR")
    if override:
        candidate = Path(override).expanduser().resolve()
        package = package_at(candidate)
        if not package:
            fail(f"PI_PACKAGE_DIR does not contain a verified {PACKAGE_NAME}: {candidate}")
        return candidate, package, "PI_PACKAGE_DIR"

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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pi", help="pi command or executable path (default: active PATH entry)")
    parser.add_argument("--json", action="store_true", help="print resolution details as JSON")
    args = parser.parse_args()

    invoked = command_path(args.pi)
    try:
        if os.environ.get("PI_PACKAGE_DIR"):
            root, package, package_resolution = find_package(invoked)
            real = None
            launcher_resolution = "skipped-PI_PACKAGE_DIR"
        else:
            executable, launcher_resolution = unwrap_shim(invoked)
            root, package, package_resolution = find_package(executable)
            real = executable.resolve(strict=True)
    except OSError as error:
        fail(str(error))

    if args.json:
        print(
            json.dumps(
                {
                    "piBin": str(invoked),
                    "piExecutable": str(real) if real else None,
                    "packageResolution": package_resolution,
                    "packageRoot": str(root),
                    "packageVersion": package.get("version"),
                    "launcherResolution": launcher_resolution,
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(root)


if __name__ == "__main__":
    main()
