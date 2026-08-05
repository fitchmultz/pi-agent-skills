#!/usr/bin/env python3
"""Small helpers for Visual Flight Recorder runs.

The helpers are intentionally browser-tool agnostic. They make the fragile parts
of VFR deterministic: action logging, sync markers, and bundle validation.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any


class HelpFormatter(argparse.ArgumentDefaultsHelpFormatter, argparse.RawDescriptionHelpFormatter):
    pass


def wall_ms() -> int:
    return int(time.time() * 1000)


def run_path(value: str) -> Path:
    return Path(value).expanduser().resolve()


def append_ndjson(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def command_action(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    row: dict[str, Any] = {
        "wall": wall_ms(),
        "kind": args.kind,
        "target": args.target,
    }
    if args.note:
        row["note"] = args.note
    append_ndjson(run / "actions.ndjson", row)
    print(json.dumps(row, indent=2))
    return 0


def command_sync(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    row: dict[str, Any] = {
        "wall": wall_ms(),
        "kind": "sync",
        "target": args.target,
        "video_t": args.video_t,
    }
    if args.url:
        row["url"] = args.url
    if args.viewport:
        row["viewport"] = args.viewport
    if args.performance_now is not None:
        row["performance_now"] = args.performance_now
    append_ndjson(run / "actions.ndjson", row)
    print(json.dumps(row, indent=2))
    return 0


def file_info(path: Path) -> dict[str, Any]:
    exists = path.exists()
    is_file = path.is_file()
    return {
        "path": str(path),
        "exists": exists,
        "is_file": is_file,
        "size_bytes": path.stat().st_size if is_file else 0,
    }


def read_json(path: Path, follow_agent_browser_artifact: bool = True) -> Any | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if follow_agent_browser_artifact and isinstance(data, dict):
        full_output = data.get("fullOutputPath")
        if not isinstance(full_output, str):
            nested = data.get("data")
            if isinstance(nested, dict):
                full_output = nested.get("fullOutputPath")
        if isinstance(full_output, str):
            nested_path = Path(full_output).expanduser()
            if nested_path.exists() and nested_path.resolve() != path.resolve():
                nested_data = read_json(nested_path, follow_agent_browser_artifact=False)
                if nested_data is not None:
                    return nested_data
    return data


def count_ndjson(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip())


def summarize_console(path: Path) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "exists": path.exists(),
        "messages": 0,
        "types": {},
        "qa_events": {},
        "errors": 0,
        "warnings": 0,
        "non_qa_preview": [],
    }
    data = read_json(path)
    if not isinstance(data, dict):
        return summary
    messages = data.get("messages")
    if not isinstance(messages, list):
        return summary
    summary["messages"] = len(messages)
    non_qa: list[dict[str, str]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        mtype = str(message.get("type") or "unknown")
        summary["types"][mtype] = summary["types"].get(mtype, 0) + 1
        text = str(message.get("text") or "")
        if mtype == "error":
            summary["errors"] += 1
        if mtype == "warning":
            summary["warnings"] += 1
        if text.startswith("__QA_EVENT__"):
            try:
                event = json.loads(text[len("__QA_EVENT__") :])
                kind = str(event.get("kind") or "unknown")
                summary["qa_events"][kind] = summary["qa_events"].get(kind, 0) + 1
            except Exception:
                pass
        elif mtype not in {"debug"} and len(non_qa) < 10:
            non_qa.append({"type": mtype, "text": text[:240]})
    summary["non_qa_preview"] = non_qa
    return summary


def summarize_har(path: Path) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "exists": path.exists(),
        "entries": 0,
        "statuses": {},
        "failed": [],
    }
    data = read_json(path)
    if not isinstance(data, dict):
        return summary
    entries = data.get("log", {}).get("entries", []) if isinstance(data.get("log"), dict) else []
    if not isinstance(entries, list):
        return summary
    summary["entries"] = len(entries)
    failed: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        response = entry.get("response") if isinstance(entry.get("response"), dict) else {}
        request = entry.get("request") if isinstance(entry.get("request"), dict) else {}
        status = response.get("status")
        key = str(status)
        summary["statuses"][key] = summary["statuses"].get(key, 0) + 1
        if isinstance(status, int) and status >= 400 and len(failed) < 20:
            failed.append({
                "status": status,
                "method": request.get("method"),
                "url": request.get("url"),
            })
    summary["failed"] = failed
    return summary


def skill_root() -> Path:
    return Path(__file__).resolve().parents[1]


def command_observer_js(args: argparse.Namespace) -> int:
    script = skill_root() / "assets" / "browser-observer.js"
    if not script.exists():
        print(f"error: observer script not found: {script}", file=sys.stderr)
        return 2
    sys.stdout.write(script.read_text(encoding="utf-8"))
    return 0


def command_available(command: str) -> str:
    path = shutil.which(command)
    return path or "missing"


def ffmpeg_status() -> tuple[bool, str]:
    path = shutil.which("ffmpeg")
    if not path:
        return False, "missing"
    try:
        result = subprocess.run([path, "-version"], capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"{path}: {exc}"
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or f"exit {result.returncode}"
        return False, f"{path}: {detail[:240]}"
    return True, path


def command_doctor(args: argparse.Namespace) -> int:
    checks: list[dict[str, Any]] = []

    def add(name: str, ok: bool, detail: str = "") -> None:
        checks.append({"name": name, "ok": ok, "detail": detail})

    add("python", sys.version_info >= (3, 9), platform.python_version())
    ffmpeg_ok, ffmpeg_detail = ffmpeg_status()
    add("ffmpeg", ffmpeg_ok, ffmpeg_detail)
    try:
        probe_root = Path(args.run_dir).expanduser() if args.run_dir else Path.cwd() / ".dogfood"
        probe_root.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=probe_root, delete=True) as f:
            f.write(b"ok")
        add("run-dir-writable", True, str(probe_root))
    except Exception as exc:
        add("run-dir-writable", False, str(exc))

    errors = [check for check in checks if not check["ok"]]
    result = {
        "ok": not errors,
        "errors": errors,
        "checks": checks,
        "installHint": "recording requires ffmpeg on the Pi process PATH; otherwise use inspected screenshots and report low motion confidence",
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("# VFR Doctor")
        print(f"\nStatus: `{'PASS' if result['ok'] else 'FAIL'}`\n")
        for check in checks:
            print(f"- {'✓' if check['ok'] else '✗'} {check['name']}: {check['detail']}")
        if result["errors"]:
            print(f"\nDependency hint: {result['installHint']}")
    return 0 if result["ok"] else 2


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def command_init(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    for name in ["logs", "frames", "reports"]:
        (run / name).mkdir(parents=True, exist_ok=True)
    meta_lines = [
        f"run_id={run.name}",
        f"started_utc={utc_now()}",
        f"repo={Path.cwd()}",
        f"target_url={args.target_url or ''}",
        f"session={args.session or ''}",
        f"viewport={args.viewport or ''}",
        f"skill_root={skill_root()}",
        f"python={platform.python_version()}",
        f"uv={command_available('uv')}",
        f"ffmpeg={command_available('ffmpeg')}",
        f"agent_browser={command_available('agent-browser')}",
        f"ttyd={command_available('ttyd')}",
    ]
    (run / "meta.txt").write_text("\n".join(meta_lines) + "\n", encoding="utf-8")
    print(json.dumps({"run": str(run), "meta": str(run / "meta.txt")}, indent=2))
    return 0


def command_contact_sheet(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    video = run / "video.webm"
    if not video.is_file():
        print(f"error: video not found: {video}", file=sys.stderr)
        return 2
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("error: ffmpeg not found on PATH", file=sys.stderr)
        return 2
    reports = run / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    for old in reports.glob("contact_ffmpeg_*.jpg"):
        old.unlink()
    output = reports / "contact_ffmpeg_%03d.jpg"
    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video),
            "-vf",
            "fps=2,scale=480:-1,tile=4x4:padding=4:margin=4:color=0xE879F9",
            "-vsync",
            "vfr",
            "-q:v",
            "3",
            str(output),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        print(result.stderr.strip() or "error: ffmpeg contact-sheet generation failed", file=sys.stderr)
        return 2
    sheets = sorted(reports.glob("contact_ffmpeg_*.jpg"))
    if not sheets:
        print("error: ffmpeg produced no contact sheets", file=sys.stderr)
        return 2
    print(json.dumps({
        "video": str(video),
        "contactSheets": [str(path) for path in sheets],
        "inspectWith": "read",
    }, indent=2))
    return 0


def available_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def ensure_port_available(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", port))
            return True
    except OSError:
        return False


def terminal_metadata_path(run: Path) -> Path:
    return run / "terminal.json"


def wait_for_port(port: int, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def command_terminal_start(args: argparse.Namespace) -> int:
    if shutil.which("ttyd") is None:
        print("error: ttyd not found; install with: brew install ttyd", file=sys.stderr)
        return 2
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        print("error: terminal-start requires a command after --", file=sys.stderr)
        return 2
    run = run_path(args.run)
    cwd = Path(args.cwd).expanduser().resolve()
    if not cwd.exists() or not cwd.is_dir():
        print(f"error: cwd is not a directory: {cwd}", file=sys.stderr)
        return 2
    (run / "logs").mkdir(parents=True, exist_ok=True)
    port = int(args.port or available_port())
    if not ensure_port_available(port):
        print(f"error: port is not available on 127.0.0.1: {port}", file=sys.stderr)
        return 2
    log_path = run / "logs" / "ttyd.log"
    url = f"http://127.0.0.1:{port}/"
    ttyd_args = [
        "ttyd",
        "-i", "127.0.0.1",
        "-p", str(port),
        "-W",
        "-m", str(args.max_clients),
        "-q",
        "-t", f"fontSize={args.font_size}",
        "-t", "cursorBlink=false",
        "-t", f"scrollback={args.scrollback}",
        "-t", f"theme={args.theme}",
        "-w", str(cwd),
        "env", "TERM=xterm-256color", "COLORTERM=truecolor",
        *command,
    ]
    pid = os.fork()
    if pid == 0:
        try:
            os.setsid()
            fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
            os.dup2(fd, 1)
            os.dup2(fd, 2)
            os.close(fd)
            os.execvp("ttyd", ttyd_args)
        except Exception as exc:  # pragma: no cover - child path
            print(f"terminal-start child failed: {exc}", file=sys.stderr)
            os._exit(127)
    ready = wait_for_port(port, args.ready_timeout)
    metadata = {
        "mode": "direct-ttyd",
        "started_utc": utc_now(),
        "pid": pid,
        "url": url,
        "port": port,
        "cwd": str(cwd),
        "command": command,
        "log": str(log_path),
        "fontSize": args.font_size,
        "scrollback": args.scrollback,
        "maxClients": args.max_clients,
        "term": "xterm-256color",
        "colorterm": "truecolor",
        "ready": ready,
        "readyTimeoutSeconds": args.ready_timeout,
        "renderCheckRequired": True,
        "notes": [
            "Use agent_browser to open the URL, set the viewport, then take and inspect frames/render-check.png before recording.",
            "If render-check shows duplicated panes, crushed spacing, missing colors, or a reconnect page, run terminal-stop and fix setup before capture.",
        ],
    }
    terminal_metadata_path(run).write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (run / "ttyd.pid").write_text(f"{pid}\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))
    if not ready:
        print(f"error: ttyd did not listen on {url} within {args.ready_timeout}s; see {log_path}", file=sys.stderr)
        return 2
    return 0


def command_terminal_stop(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    data = read_json(terminal_metadata_path(run), follow_agent_browser_artifact=False)
    pid = None
    if isinstance(data, dict) and isinstance(data.get("pid"), int):
        pid = int(data["pid"])
    elif (run / "ttyd.pid").exists():
        try:
            pid = int((run / "ttyd.pid").read_text(encoding="utf-8").strip())
        except ValueError:
            pid = None
    if not pid:
        print(f"error: no terminal pid found for {run}", file=sys.stderr)
        return 2
    stopped = False
    for sig, delay in [(signal.SIGTERM, 1.0), (signal.SIGKILL, 0.0)]:
        try:
            os.killpg(pid, sig)
        except ProcessLookupError:
            stopped = True
            break
        except PermissionError as exc:
            print(f"error: cannot stop terminal pid {pid}: {exc}", file=sys.stderr)
            return 2
        deadline = time.time() + delay
        while time.time() < deadline:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                stopped = True
                break
            time.sleep(0.1)
        if stopped:
            break
    result = {"run": str(run), "pid": pid, "stopped": stopped, "stopped_utc": utc_now()}
    if isinstance(data, dict):
        data.update(result)
        terminal_metadata_path(run).write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if stopped else 2


def command_terminal_capture_js(args: argparse.Namespace) -> int:
    script = skill_root() / "assets" / "terminal-capture.js"
    if not script.exists():
        print(f"error: terminal capture script not found: {script}", file=sys.stderr)
        return 2
    sys.stdout.write(script.read_text(encoding="utf-8"))
    return 0


def command_validate(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    reports = run / "reports"
    terminal = read_json(terminal_metadata_path(run), follow_agent_browser_artifact=False) if terminal_metadata_path(run).exists() else None
    terminal_mode = isinstance(terminal, dict) and terminal.get("mode") == "direct-ttyd"
    required = {
        "meta": run / "meta.txt",
        "video": run / "video.webm",
        "render-check": run / "frames" / "render-check.png",
        "final": run / "frames" / "final.png",
    }
    files = {name: file_info(path) for name, path in required.items()}
    screenshots = sorted((run / "frames").glob("*.png")) + sorted((run / "frames").glob("*.jpg"))
    terminal_state_snapshots = sorted((run / "logs").glob("terminal-state*.json"))
    contact_sheets = sorted(path for path in reports.glob("contact*.jpg") if path.is_file() and path.stat().st_size > 0)
    console_candidates = sorted((run / "logs").glob("console*.json"))
    console = summarize_console(console_candidates[-1]) if console_candidates else summarize_console(run / "logs" / "console.final.json")
    har = summarize_har(run / "network" / "network.har")

    warnings: list[str] = []
    errors: list[str] = []
    issues: list[dict[str, str]] = []
    for name, info in files.items():
        if not info["exists"]:
            message = f"missing required artifact: {name} ({info['path']})"
            errors.append(message)
            issues.append({"severity": "fatal", "message": message})
        elif not info["is_file"] or info["size_bytes"] == 0:
            message = f"required artifact is not a nonempty regular file: {name} ({info['path']})"
            errors.append(message)
            issues.append({"severity": "fatal", "message": message})
        elif name == "video" and info["size_bytes"] < 1024:
            message = "video exists but is suspiciously small"
            errors.append(message)
            issues.append({"severity": "fatal", "message": message})
    warning_messages: list[str] = []
    action_count = count_ndjson(run / "actions.ndjson")
    if action_count == 0:
        warning_messages.append("actions.ndjson has no action markers")
    if not contact_sheets:
        message = "no nonempty regular contact sheets found in reports/"
        errors.append(message)
        issues.append({"severity": "fatal", "message": message})
    if console["errors"]:
        warning_messages.append(f"console contains {console['errors']} error message(s)")
    if not terminal_mode and har["exists"] and har["entries"] == 0:
        warning_messages.append("HAR has 0 entries; start HAR before navigation or before the network-heavy scenario")
    if not terminal_mode and har.get("failed"):
        warning_messages.append(f"HAR contains {len(har['failed'])} failed request sample(s)")
    for message in warning_messages:
        warnings.append(message)
        issues.append({"severity": "warning", "message": message})
    readiness = {
        "status": "ready" if not errors else "incomplete",
        "reason": "required artifacts are ready for agent visual inspection" if not errors else "required visual artifacts are missing or invalid",
    }

    result = {
        "run": str(run),
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "issues": issues,
        "files": files,
        "counts": {
            "actions": action_count,
            "screenshots": len(screenshots),
            "contact_sheets": len(contact_sheets),
            "terminal_state_snapshots": len(terminal_state_snapshots),
        },
        "evidence_readiness": readiness,
        "console": console,
        "har": har,
        "terminal": terminal if terminal_mode else None,
    }
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "validation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    lines = ["# VFR Bundle Validation", "", f"Run: `{run}`", f"Mode: `{'terminal' if terminal_mode else 'browser'}`", "", f"Status: `{'PASS' if result['ok'] else 'FAIL'}`", ""]
    if issues:
        lines += ["## Issues", ""] + [f"- `{issue['severity']}` — {issue['message']}" for issue in issues] + [""]
    lines += [
        "## Counts",
        "",
        f"- Actions: `{result['counts']['actions']}`",
        f"- Screenshots: `{result['counts']['screenshots']}`",
        f"- Contact sheets: `{result['counts']['contact_sheets']}`",
        f"- Terminal buffer snapshots: `{result['counts']['terminal_state_snapshots']}`",
        f"- Console errors: `{console['errors']}`",
        f"- HAR entries: `{har['entries']}`",
        "",
        "## Evidence Readiness",
        "",
        f"- Status: `{readiness['status']}`",
        f"- Reason: {readiness['reason']}",
        "- Motion confidence remains unrated until the agent opens and inspects the images.",
        "",
    ]
    (reports / "validation.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 2


def parse_terminal_start_cli(argv: list[str]) -> argparse.Namespace:
    if "--" not in argv:
        raise SystemExit("error: terminal-start requires -- before the terminal command")
    separator = argv.index("--")
    left = argv[:separator]
    command = argv[separator + 1 :]
    parser = argparse.ArgumentParser(
        prog="vfr.py terminal-start",
        description="Launch a localhost ttyd terminal/TUI session with VFR-safe defaults",
        formatter_class=HelpFormatter,
    )
    parser.add_argument("run", help="VFR run directory")
    parser.add_argument("--cwd", default=".", help="Working directory for the terminal command")
    parser.add_argument("--port", type=int, help="Localhost port. Defaults to an available random port")
    parser.add_argument("--font-size", type=int, default=14, help="xterm.js font size")
    parser.add_argument("--scrollback", type=int, default=2000, help="xterm.js scrollback lines")
    parser.add_argument("--max-clients", type=int, default=3, help="ttyd max browser clients; >1 survives browser automation reconnects")
    parser.add_argument("--theme", default='{"background":"#050505","foreground":"#f8fafc"}', help="xterm.js JSON theme")
    parser.add_argument("--ready-timeout", type=float, default=5.0, help="Seconds to wait for ttyd to listen before failing")
    try:
        parsed = parser.parse_intermixed_args(left)
    except TypeError:
        parsed = parser.parse_args(left)
    parsed.command = command
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Helpers for Visual Flight Recorder evidence bundles.",
        formatter_class=HelpFormatter,
        epilog=(
            "examples:\n"
            "  scripts/vfr.py doctor\n"
            "  scripts/vfr.py init RUN --target-url http://localhost:3000 --viewport 1440x1000\n"
            "  scripts/vfr.py terminal-start RUN --cwd . -- pi --no-session \"check terminal redraw\"\n"
            "  scripts/vfr.py sync RUN --url http://localhost:3000 --viewport 1440x1000\n"
            "  scripts/vfr.py action RUN click \"Submit\" --note \"start checkout\"\n"
            "  scripts/vfr.py contact-sheet RUN\n"
            "  scripts/vfr.py validate RUN\n"
            "  scripts/vfr.py terminal-capture-js | agent-browser eval --stdin\n"
            "  scripts/vfr.py observer-js | agent-browser eval --stdin\n\n"
            "exit codes: 0 success, 2 validation/doctor failure or missing observer asset"
        ),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    doctor = sub.add_parser("doctor", help="Check local VFR dependencies and writable output paths")
    doctor.add_argument("--run-dir", help="Directory to probe for write access. Defaults to .dogfood")
    doctor.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    doctor.set_defaults(func=command_doctor)

    init = sub.add_parser("init", help="Create a VFR run directory with standard subdirectories and meta.txt")
    init.add_argument("run", help="VFR run directory")
    init.add_argument("--target-url", help="Target URL under test")
    init.add_argument("--session", help="Browser session label")
    init.add_argument("--viewport", help="Viewport label, e.g. 1440x1000")
    init.set_defaults(func=command_init)

    contact_sheet = sub.add_parser("contact-sheet", help="Create image-tool-readable contact sheets from RUN/video.webm with ffmpeg")
    contact_sheet.add_argument("run", help="VFR run directory")
    contact_sheet.set_defaults(func=command_contact_sheet)

    terminal_start = sub.add_parser("terminal-start", help="Launch a localhost ttyd terminal/TUI session with VFR-safe defaults")
    terminal_start.add_argument("run", help="VFR run directory")
    terminal_start.add_argument("--cwd", default=".", help="Working directory for the terminal command")
    terminal_start.add_argument("--port", type=int, help="Localhost port. Defaults to an available random port")
    terminal_start.add_argument("--font-size", type=int, default=14, help="xterm.js font size")
    terminal_start.add_argument("--scrollback", type=int, default=2000, help="xterm.js scrollback lines")
    terminal_start.add_argument("--max-clients", type=int, default=3, help="ttyd max browser clients; >1 survives browser automation reconnects")
    terminal_start.add_argument("--theme", default='{"background":"#050505","foreground":"#f8fafc"}', help="xterm.js JSON theme")
    terminal_start.add_argument("--ready-timeout", type=float, default=5.0, help="Seconds to wait for ttyd to listen before failing")
    terminal_start.add_argument("command", nargs=argparse.REMAINDER, help="Command to run after --")
    terminal_start.set_defaults(func=command_terminal_start)

    terminal_stop = sub.add_parser("terminal-stop", help="Stop a ttyd terminal session launched by terminal-start")
    terminal_stop.add_argument("run", help="VFR run directory")
    terminal_stop.set_defaults(func=command_terminal_stop)

    terminal_capture = sub.add_parser("terminal-capture-js", help="Print xterm.js terminal buffer capture JS for agent_browser eval --stdin")
    terminal_capture.set_defaults(func=command_terminal_capture_js)

    action = sub.add_parser("action", help="Append an action marker to RUN/actions.ndjson")
    action.add_argument("run", help="VFR run directory")
    action.add_argument("kind", help="Action kind, e.g. click, type, scroll, resize")
    action.add_argument("target", help="Human-readable target")
    action.add_argument("--note", help="Optional note")
    action.set_defaults(func=command_action)

    sync = sub.add_parser("sync", help="Append a recording sync marker to RUN/actions.ndjson")
    sync.add_argument("run", help="VFR run directory")
    sync.add_argument("--target", default="recording-start", help="Sync target label")
    sync.add_argument("--video-t", type=float, default=0.0, help="Video timestamp in seconds")
    sync.add_argument("--url", help="Current URL")
    sync.add_argument("--viewport", help="Current viewport label or JSON")
    sync.add_argument("--performance-now", type=float, help="Browser performance.now() if known")
    sync.set_defaults(func=command_sync)

    validate = sub.add_parser("validate", help="Validate a VFR run bundle and summarize telemetry")
    validate.add_argument("run", help="VFR run directory")
    validate.set_defaults(func=command_validate)

    observer = sub.add_parser("observer-js", help="Print browser-observer.js to stdout for agent_browser eval --stdin")
    observer.set_defaults(func=command_observer_js)

    return parser


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "terminal-start" and "--help" not in sys.argv and "-h" not in sys.argv:
        return command_terminal_start(parse_terminal_start_cli(sys.argv[2:]))
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
