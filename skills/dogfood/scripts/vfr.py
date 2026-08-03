#!/usr/bin/env python3
"""Small helpers for Visual Flight Recorder runs.

The helpers are intentionally browser-tool agnostic. They make the fragile parts
of VFR deterministic: action logging, sync markers, and bundle validation.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import platform
import shutil
import signal
import socket
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


def command_review_note(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    item = Path(args.item).expanduser()
    row: dict[str, Any] = {
        "wall": wall_ms(),
        "item": args.item,
        "verdict": args.verdict,
    }
    if args.note:
        row["note"] = args.note
    if item.exists():
        row["exists"] = True
        row["size_bytes"] = item.stat().st_size if item.is_file() else 0
    append_ndjson(run / "reports" / "manual-review.ndjson", row)
    print(json.dumps(row, indent=2))
    return 0


def file_info(path: Path) -> dict[str, Any]:
    exists = path.exists()
    return {
        "path": str(path),
        "exists": exists,
        "size_bytes": path.stat().st_size if exists and path.is_file() else 0,
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


def check_import(module: str) -> bool:
    return importlib.util.find_spec(module) is not None


def import_check(module: str, label: str) -> tuple[bool, str]:
    ok = check_import(module)
    return ok, f"{label} import {'available' if ok else 'missing'}"


def command_doctor(args: argparse.Namespace) -> int:
    checks: list[dict[str, Any]] = []

    def add(name: str, ok: bool, detail: str = "", severity: str = "ok") -> None:
        checks.append({"name": name, "ok": ok, "severity": "ok" if ok else severity, "detail": detail})

    add("python", sys.version_info >= (3, 9), platform.python_version(), "error")
    add("uv", shutil.which("uv") is not None, command_available("uv"), "warning")
    add("ffmpeg", shutil.which("ffmpeg") is not None, command_available("ffmpeg"), "warning")
    add("agent-browser-cli", shutil.which("agent-browser") is not None, f"{command_available('agent-browser')} (pi native agent_browser tool is also acceptable)", "warning")
    add("ttyd", shutil.which("ttyd") is not None, f"{command_available('ttyd')} (optional; preferred for terminal/TUI VFR)", "warning")
    add("observer-js", (skill_root() / "assets" / "browser-observer.js").exists(), str(skill_root() / "assets" / "browser-observer.js"), "error")
    opencv_ok, opencv_detail = import_check("cv2", "cv2")
    numpy_ok, numpy_detail = import_check("numpy", "numpy")
    pillow_ok, pillow_detail = import_check("PIL", "Pillow")
    add("opencv", opencv_ok, opencv_detail, "warning")
    add("numpy", numpy_ok, numpy_detail, "warning")
    add("pillow", pillow_ok, pillow_detail, "warning")
    try:
        probe_root = Path(args.run_dir).expanduser() if args.run_dir else Path.cwd() / ".dogfood" / ".doctor"
        probe_root.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=probe_root, delete=True) as f:
            f.write(b"ok")
        add("run-dir-writable", True, str(probe_root))
    except Exception as exc:
        add("run-dir-writable", False, str(exc), "error")

    result = {
        "ok": not any(not check["ok"] and check["severity"] == "error" for check in checks),
        "warnings": [check for check in checks if not check["ok"] and check["severity"] == "warning"],
        "errors": [check for check in checks if not check["ok"] and check["severity"] == "error"],
        "checks": checks,
        "installHint": "uv run scripts/analyze-video.py --help downloads video-analysis deps from inline script metadata; use brew install ttyd for terminal/TUI VFR",
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("# VFR Doctor")
        print(f"\nStatus: `{'PASS' if result['ok'] else 'FAIL'}`\n")
        for check in checks:
            marker = "✓" if check["ok"] else ("!" if check["severity"] == "warning" else "✗")
            print(f"- {marker} {check['name']}: {check['detail']}")
        if result["warnings"]:
            print(f"\nDependency hint: {result['installHint']}")
    return 0 if result["ok"] else 2


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def command_init(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    for name in ["logs", "frames", "keyframes", "clips", "diffs", "ocr", "trace", "network", "profile", "reports"]:
        (run / name).mkdir(parents=True, exist_ok=True)
    config = {
        "run": str(run),
        "created_utc": utc_now(),
        "target_url": args.target_url,
        "session": args.session,
        "viewport": args.viewport,
        "skill_root": str(skill_root()),
    }
    (run / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    meta_lines = [
        f"run_id={run.name}",
        f"started_utc={config['created_utc']}",
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
    print(json.dumps({"run": str(run), "meta": str(run / "meta.txt"), "config": str(run / "config.json")}, indent=2))
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
            "Use agent_browser to open url, set viewport, start recording, then take an early render-check screenshot.",
            "If the render-check screenshot shows duplicated panes, crushed spacing, or missing colors, stop and restart before a long run.",
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


def severity_for_issue(message: str, fatal: bool = False) -> str:
    if fatal:
        return "fatal"
    if "HAR has 0 entries" in message or "no __QA_EVENT__" in message:
        return "warning"
    return "warning"


def motion_confidence(
    *,
    has_video: bool,
    action_count: int,
    screenshot_count: int,
    contact_sheet_count: int,
    manual_review_count: int,
    has_review: bool,
    terminal_mode: bool,
    has_render_check: bool,
    terminal_state_count: int,
) -> dict[str, str]:
    if not has_video:
        return {
            "level": "low",
            "reason": "no video artifact was available, so motion/streaming behavior was not proven",
        }
    if not has_review or contact_sheet_count == 0:
        return {
            "level": "medium",
            "reason": "video exists, but analyzer review/contact sheets were not available for systematic motion inspection",
        }
    if manual_review_count == 0:
        return {
            "level": "medium",
            "reason": "video and mechanical analysis exist, but no manual frame/contact-sheet review note was recorded",
        }
    if action_count == 0:
        return {
            "level": "medium",
            "reason": "video and analysis exist, but no sync/action markers were recorded",
        }
    if terminal_mode and not (has_render_check and terminal_state_count > 0):
        return {
            "level": "medium",
            "reason": "terminal video and analysis exist, but render-check screenshot or terminal buffer snapshots are missing",
        }
    if screenshot_count == 0:
        return {
            "level": "medium",
            "reason": "video and analysis exist, but no still screenshot anchors were saved",
        }
    return {
        "level": "high",
        "reason": "video, action markers, screenshots, analyzer review, and contact sheets were available for motion review",
    }


def command_validate(args: argparse.Namespace) -> int:
    run = run_path(args.run)
    reports = run / "reports"
    terminal = read_json(terminal_metadata_path(run), follow_agent_browser_artifact=False) if terminal_metadata_path(run).exists() else None
    terminal_mode = isinstance(terminal, dict) and terminal.get("mode") == "direct-ttyd"
    required = {
        "meta": run / "meta.txt",
        "actions": run / "actions.ndjson",
        "video": run / "video.webm",
        "review": reports / "review.md",
        "manifest": reports / "manifest.json",
    }
    if not terminal_mode:
        required["har"] = run / "network" / "network.har"
    files = {name: file_info(path) for name, path in required.items()}
    screenshots = sorted((run / "frames").glob("*.png")) + sorted((run / "frames").glob("*.jpg"))
    render_check = run / "frames" / "render-check.png"
    terminal_state_snapshots = sorted((run / "logs").glob("terminal-state*.json"))
    contact_sheets = sorted(reports.glob("contact_*.jpg"))
    manual_review_count = count_ndjson(reports / "manual-review.ndjson")
    console_candidates = sorted((run / "logs").glob("console*.json"))
    error_candidates = sorted((run / "logs").glob("errors*.txt"))
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
        elif name == "video" and info["size_bytes"] < 1024:
            message = "video exists but is suspiciously small"
            errors.append(message)
            issues.append({"severity": "fatal", "message": message})
    warning_messages: list[str] = []
    if not console_candidates and not terminal_mode:
        message = "missing console capture in logs/console*.json"
        errors.append(message)
        issues.append({"severity": "fatal", "message": message})
    if not error_candidates and not terminal_mode:
        message = "missing page error capture in logs/errors*.txt"
        errors.append(message)
        issues.append({"severity": "fatal", "message": message})
    action_count = count_ndjson(run / "actions.ndjson")
    if action_count == 0:
        warning_messages.append("actions.ndjson has no action markers")
    elif action_count < args.min_actions:
        warning_messages.append(f"actions.ndjson has only {action_count} marker(s); expected at least {args.min_actions}")
    if not screenshots:
        message = "no frame screenshots found in frames/"
        errors.append(message)
        issues.append({"severity": "fatal", "message": message})
    elif len(screenshots) < args.min_screenshots:
        warning_messages.append(f"only {len(screenshots)} frame screenshot(s); expected at least {args.min_screenshots}")
    if terminal_mode:
        if not render_check.exists():
            warning_messages.append("missing terminal render-check screenshot at frames/render-check.png")
        if not terminal_state_snapshots:
            warning_messages.append("missing terminal buffer snapshot in logs/terminal-state*.json")
    if not contact_sheets:
        warning_messages.append("no contact sheets found in reports/")
    if (screenshots or contact_sheets) and manual_review_count == 0:
        warning_messages.append("no manual visual review notes found in reports/manual-review.ndjson")
    if console["errors"]:
        warning_messages.append(f"console contains {console['errors']} error message(s)")
    if not terminal_mode and not console.get("qa_events"):
        warning_messages.append("no __QA_EVENT__ telemetry found in console capture")
    if not terminal_mode and har["exists"] and har["entries"] == 0:
        warning_messages.append("HAR has 0 entries; start HAR before navigation or before the network-heavy scenario")
    if not terminal_mode and har.get("failed"):
        warning_messages.append(f"HAR contains {len(har['failed'])} failed request sample(s)")
    for message in warning_messages:
        warnings.append(message)
        issues.append({"severity": severity_for_issue(message), "message": message})
    if args.strict and warnings:
        for message in warnings:
            if message not in errors:
                errors.append(f"strict validation warning: {message}")

    confidence = motion_confidence(
        has_video=files["video"]["exists"] and files["video"]["size_bytes"] >= 1024,
        action_count=action_count,
        screenshot_count=len(screenshots),
        contact_sheet_count=len(contact_sheets),
        manual_review_count=manual_review_count,
        has_review=files["review"]["exists"],
        terminal_mode=terminal_mode,
        has_render_check=render_check.exists(),
        terminal_state_count=len(terminal_state_snapshots),
    )

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
            "manual_reviews": manual_review_count,
            "terminal_state_snapshots": len(terminal_state_snapshots),
        },
        "confidence": confidence,
        "console": console,
        "har": har,
        "terminal": terminal if terminal_mode else None,
    }
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "validation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    lines = ["# VFR Bundle Validation", "", f"Run: `{run}`", f"Mode: `{'terminal' if terminal_mode else 'browser'}`", "", f"Status: `{'PASS' if result['ok'] else 'FAIL'}`", f"Strict: `{'yes' if args.strict else 'no'}`", ""]
    if issues:
        lines += ["## Issues", ""] + [f"- `{issue['severity']}` — {issue['message']}" for issue in issues] + [""]
    lines += [
        "## Counts",
        "",
        f"- Actions: `{result['counts']['actions']}`",
        f"- Screenshots: `{result['counts']['screenshots']}`",
        f"- Contact sheets: `{result['counts']['contact_sheets']}`",
        f"- Manual visual reviews: `{result['counts']['manual_reviews']}`",
        f"- Terminal buffer snapshots: `{result['counts']['terminal_state_snapshots']}`",
        f"- Console errors: `{console['errors']}`",
        f"- HAR entries: `{har['entries']}`",
        "",
        "## Motion Confidence",
        "",
        f"- Level: `{confidence['level']}`",
        f"- Reason: {confidence['reason']}",
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
            "  scripts/vfr.py terminal-start RUN --cwd . -- pi --model cursor/grok-4.5 \"/create-goal ...\"\n"
            "  # alternative model id: xai/grok-4.5\n"
            "  scripts/vfr.py sync RUN --url http://localhost:3000 --viewport 1440x1000\n"
            "  scripts/vfr.py action RUN click \"Submit\" --note \"start checkout\"\n"
            "  scripts/vfr.py review-note RUN RUN/reports/contact_001.jpg --verdict ok --note \"contact sheet inspected\"\n"
            "  scripts/vfr.py terminal-capture-js | agent-browser eval --stdin\n"
            "  scripts/vfr.py observer-js | agent-browser eval --stdin\n"
            "  scripts/vfr.py validate RUN --strict\n\n"
            "exit codes: 0 success, 2 validation/doctor failure or missing observer asset"
        ),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    doctor = sub.add_parser("doctor", help="Check local VFR dependencies and writable output paths")
    doctor.add_argument("--run-dir", help="Directory to probe for write access. Defaults to .dogfood/.doctor")
    doctor.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    doctor.set_defaults(func=command_doctor)

    init = sub.add_parser("init", help="Create a VFR run directory with standard subdirectories, config.json, and meta.txt")
    init.add_argument("run", help="VFR run directory")
    init.add_argument("--target-url", help="Target URL under test")
    init.add_argument("--session", help="Browser session label")
    init.add_argument("--viewport", help="Viewport label, e.g. 1440x1000")
    init.set_defaults(func=command_init)

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

    review_note = sub.add_parser("review-note", help="Record manual/agent visual inspection of an artifact")
    review_note.add_argument("run", help="VFR run directory")
    review_note.add_argument("item", help="Artifact path or label that was visually inspected")
    review_note.add_argument("--verdict", choices=["ok", "issue", "uncertain"], required=True, help="Review verdict")
    review_note.add_argument("--note", help="Short note describing what was inspected")
    review_note.set_defaults(func=command_review_note)

    validate = sub.add_parser("validate", help="Validate a VFR run bundle and summarize telemetry")
    validate.add_argument("run", help="VFR run directory")
    validate.add_argument("--strict", action="store_true", help="Treat warnings as validation failures")
    validate.add_argument("--min-actions", type=int, default=1, help="Warn when fewer action/sync markers exist")
    validate.add_argument("--min-screenshots", type=int, default=1, help="Warn when fewer frame screenshots exist")
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
