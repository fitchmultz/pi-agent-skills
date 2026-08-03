#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "opencv-python-headless>=4.10",
#   "numpy>=2",
#   "pillow>=10",
# ]
# ///
"""Analyze a browser recording for transient visual anomalies.

Creates contact sheets, anomaly triptychs, diff heatmaps, anomalies.ndjson,
reports/manifest.json, and reports/review.md.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable


class HelpFormatter(argparse.ArgumentDefaultsHelpFormatter, argparse.RawDescriptionHelpFormatter):
    pass


cv2: Any = None
np: Any = None
Image: Any = None
ImageDraw: Any = None
ImageFont: Any = None


def load_dependencies() -> int:
    """Import heavy CV dependencies after argparse can handle --help."""
    global cv2, np, Image, ImageDraw, ImageFont
    try:
        import cv2 as cv2_module  # type: ignore
        import numpy as np_module  # type: ignore
    except Exception as exc:  # pragma: no cover
        print(f"error: OpenCV/numpy import failed: {exc}", file=sys.stderr)
        print("install with: uv pip install opencv-python-headless numpy pillow", file=sys.stderr)
        return 4
    try:
        from PIL import Image as Image_module, ImageDraw as ImageDraw_module, ImageFont as ImageFont_module  # type: ignore
    except Exception as exc:  # pragma: no cover
        print(f"error: Pillow import failed: {exc}", file=sys.stderr)
        print("install with: uv pip install pillow", file=sys.stderr)
        return 4
    cv2 = cv2_module
    np = np_module
    Image = Image_module
    ImageDraw = ImageDraw_module
    ImageFont = ImageFont_module
    return 0


@dataclass
class Sample:
    idx: int
    frame_no: int
    t: float
    mean: float
    stddev: float
    changed_ratio: float
    two_back_ratio: float
    frame: np.ndarray
    small_gray: np.ndarray


@dataclass
class Anomaly:
    id: str
    kind: str
    score: int
    time: float
    frame_no: int
    details: dict
    evidence: dict


@dataclass
class Action:
    t: float
    wall: int
    kind: str
    target: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create visual QA evidence from a browser/session video.",
        formatter_class=HelpFormatter,
        epilog=(
            "examples:\n"
            "  uv run scripts/analyze-video.py --video RUN/video.webm --out-dir RUN\n"
            "  uv run scripts/analyze-video.py --video RUN/video.webm --out-dir RUN --actions RUN/actions.ndjson --max-anomalies 12\n\n"
            "exit codes: 0 success, 2 input file missing, 3 video decode failure, 4 missing Python dependency"
        ),
    )
    parser.add_argument("--video", required=True, help="Input video path, usually RUN/video.webm")
    parser.add_argument("--out-dir", required=True, help="Run/output directory to populate")
    parser.add_argument("--sample-fps", type=float, default=6.0, help="FPS used for anomaly analysis")
    parser.add_argument("--contact-fps", type=float, default=1.0, help="FPS used for contact sheets")
    parser.add_argument("--max-anomalies", type=int, default=20, help="Maximum anomaly cards to write")
    parser.add_argument("--actions", help="Optional actions.ndjson path. Defaults to OUT_DIR/actions.ndjson when present")
    parser.add_argument("--analysis-width", type=int, default=320, help="Resize width for frame-diff analysis")
    parser.add_argument("--contact-width", type=int, default=360, help="Tile width for contact sheet frames")
    parser.add_argument("--tile-cols", type=int, default=5, help="Contact sheet columns")
    parser.add_argument("--tile-rows", type=int, default=6, help="Contact sheet rows")
    parser.add_argument("--blank-stddev", type=float, default=3.0, help="Stddev threshold for blank frame detection")
    parser.add_argument("--white-mean", type=float, default=245.0, help="Mean threshold for white blank frames")
    parser.add_argument("--black-mean", type=float, default=10.0, help="Mean threshold for black blank frames")
    parser.add_argument("--major-change", type=float, default=0.25, help="Changed-pixel ratio for major visual changes")
    parser.add_argument("--flicker-change", type=float, default=0.10, help="Adjacent changed-pixel ratio for flicker detection")
    parser.add_argument("--flicker-return", type=float, default=0.02, help="Two-back ratio for A-B-A flicker detection")
    return parser.parse_args()


def ensure_dirs(out: Path) -> None:
    for name in ["frames", "keyframes", "diffs", "reports"]:
        (out / name).mkdir(parents=True, exist_ok=True)


def timestamp(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def slug_time(seconds: float) -> str:
    return f"{int(seconds * 1000):09d}ms"


def resize_width(frame: np.ndarray, width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    if w == width:
        return frame
    scale = width / float(w)
    return cv2.resize(frame, (width, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)


def changed_ratio(a: np.ndarray, b: np.ndarray, threshold: int = 30) -> float:
    if a.shape != b.shape:
        b = cv2.resize(b, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA)
    diff = cv2.absdiff(a, b)
    return float((diff > threshold).sum()) / float(diff.size)


def read_samples(video: Path, sample_fps: float, analysis_width: int) -> tuple[list[Sample], dict]:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"could not open video: {video}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if frame_count else 0.0
    step = max(1, int(round(fps / sample_fps)))

    samples: list[Sample] = []
    prev: np.ndarray | None = None
    prev2: np.ndarray | None = None
    frame_no = 0
    sample_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_no % step == 0:
            small = resize_width(frame, analysis_width)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            mean = float(gray.mean())
            stddev = float(gray.std())
            cr = changed_ratio(gray, prev) if prev is not None else 0.0
            tbr = changed_ratio(gray, prev2) if prev2 is not None else 1.0
            samples.append(Sample(sample_idx, frame_no, frame_no / fps, mean, stddev, cr, tbr, frame.copy(), gray))
            prev2 = prev
            prev = gray
            sample_idx += 1
        frame_no += 1

    cap.release()
    meta = {"fps": fps, "frame_count": frame_count, "duration_seconds": duration, "sample_step_frames": step}
    return samples, meta


def score_sample(sample: Sample, kind: str) -> int:
    if kind in {"white_blank", "black_blank"}:
        return 90
    if kind == "flicker":
        return min(85, 55 + int(sample.changed_ratio * 100))
    if kind == "major_change":
        return min(70, 25 + int(sample.changed_ratio * 100))
    return 10


def is_blank_sample(sample: Sample, args: argparse.Namespace) -> bool:
    return sample.stddev < args.blank_stddev and (sample.mean > args.white_mean or sample.mean < args.black_mean)


def initial_blank_sample_ids(samples: list[Sample], args: argparse.Namespace) -> set[int]:
    """Return leading blank samples caused by recorder/browser warmup.

    A blank prefix at t=0 is almost always capture startup, especially when HAR
    starts before navigation. Later blank frames remain reportable.
    """
    ignored: set[int] = set()
    for sample in samples:
        if is_blank_sample(sample, args):
            ignored.add(sample.idx)
            continue
        if ignored:
            # Also ignore the first normal frame after startup blanking; its
            # black/blank -> app transition is capture warmup, not app jank.
            ignored.add(sample.idx)
        break
    return ignored


def detect_anomalies(samples: list[Sample], args: argparse.Namespace) -> list[tuple[Sample, str, dict]]:
    raw: list[tuple[Sample, str, dict]] = []
    ignored_initial_blanks = initial_blank_sample_ids(samples, args)
    for s in samples:
        if s.idx in ignored_initial_blanks:
            continue
        if s.stddev < args.blank_stddev and s.mean > args.white_mean:
            raw.append((s, "white_blank", {"mean": s.mean, "stddev": s.stddev}))
        elif s.stddev < args.blank_stddev and s.mean < args.black_mean:
            raw.append((s, "black_blank", {"mean": s.mean, "stddev": s.stddev}))
        elif s.idx >= 2 and s.changed_ratio > args.flicker_change and s.two_back_ratio < args.flicker_return:
            raw.append((s, "flicker", {"changed_ratio": s.changed_ratio, "two_back_ratio": s.two_back_ratio}))
        elif s.changed_ratio > args.major_change:
            raw.append((s, "major_change", {"changed_ratio": s.changed_ratio}))

    # Suppress dense duplicates: keep highest-score anomaly per ~0.75s window.
    raw.sort(key=lambda item: (score_sample(item[0], item[1]), item[0].changed_ratio), reverse=True)
    kept: list[tuple[Sample, str, dict]] = []
    for candidate in raw:
        s, kind, details = candidate
        if all(abs(s.t - k[0].t) > 0.75 for k in kept):
            kept.append(candidate)
    kept.sort(key=lambda item: item[0].t)
    return kept[: args.max_anomalies]


def write_image(path: Path, frame: np.ndarray) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), frame)
    return str(path)


def make_diff(prev: np.ndarray, cur: np.ndarray, out: Path) -> str:
    if prev.shape != cur.shape:
        prev = cv2.resize(prev, (cur.shape[1], cur.shape[0]), interpolation=cv2.INTER_AREA)
    diff = cv2.absdiff(prev, cur)
    heat = cv2.applyColorMap(cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY), cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(cur, 0.65, heat, 0.35, 0)
    return write_image(out, overlay)


def load_actions(path: Path | None) -> list[Action]:
    if path is None or not path.exists():
        return []
    raw: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row.get("wall"), int):
            raw.append(row)
    if not raw:
        return []
    sync = next((row for row in raw if row.get("kind") in {"start_recording", "sync"}), raw[0])
    sync_wall = int(sync["wall"])
    actions: list[Action] = []
    for row in raw:
        wall = int(row["wall"])
        actions.append(Action(
            t=max(0.0, (wall - sync_wall) / 1000.0),
            wall=wall,
            kind=str(row.get("kind") or "action"),
            target=str(row.get("target") or row.get("text") or ""),
        ))
    return actions


def nearest_action(actions: list[Action], t: float) -> dict | None:
    prior = [action for action in actions if action.t <= t]
    if not prior:
        return None
    action = max(prior, key=lambda item: item.t)
    return {"t": action.t, "kind": action.kind, "target": action.target, "seconds_before": t - action.t}


def write_anomaly_cards(out: Path, samples: list[Sample], detected: list[tuple[Sample, str, dict]], actions: list[Action]) -> list[Anomaly]:
    anomalies: list[Anomaly] = []
    by_idx = {s.idx: s for s in samples}
    for n, (sample, kind, details) in enumerate(detected, start=1):
        aid = f"VIS-{n:03d}"
        base = f"{aid}.{slug_time(sample.t)}"
        before = by_idx.get(sample.idx - 1, sample)
        after = by_idx.get(sample.idx + 1, sample)
        evidence = {
            "before": write_image(out / "keyframes" / f"{base}.before.jpg", before.frame),
            "during": write_image(out / "keyframes" / f"{base}.during.jpg", sample.frame),
            "after": write_image(out / "keyframes" / f"{base}.after.jpg", after.frame),
            "diff": make_diff(before.frame, sample.frame, out / "diffs" / f"{base}.diff.jpg"),
        }
        correlated_action = nearest_action(actions, sample.t)
        if correlated_action is not None:
            details = {**details, "nearest_action": correlated_action}
        anomalies.append(Anomaly(
            id=aid,
            kind=kind,
            score=score_sample(sample, kind),
            time=sample.t,
            frame_no=sample.frame_no,
            details=details,
            evidence=evidence,
        ))
    return anomalies


def frame_to_pil(frame: np.ndarray, width: int, label: str) -> Image.Image:
    resized = resize_width(frame, width)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("Menlo.ttc", 16)
    except Exception:
        font = ImageFont.load_default()
    pad = 4
    bbox = draw.textbbox((0, 0), label, font=font)
    draw.rectangle((0, 0, bbox[2] + pad * 2, bbox[3] + pad * 2), fill=(0, 0, 0))
    draw.text((pad, pad), label, fill=(255, 255, 255), font=font)
    return img


def make_contact_sheets(out: Path, samples: list[Sample], contact_fps: float, sample_fps: float, width: int, cols: int, rows: int) -> list[str]:
    every = max(1, int(round(sample_fps / contact_fps)))
    chosen = samples[::every]
    if not chosen:
        return []
    tiles_per_sheet = cols * rows
    paths: list[str] = []
    for sheet_idx in range(math.ceil(len(chosen) / tiles_per_sheet)):
        chunk = chosen[sheet_idx * tiles_per_sheet : (sheet_idx + 1) * tiles_per_sheet]
        imgs = [frame_to_pil(s.frame, width, timestamp(s.t)) for s in chunk]
        tile_w = max(img.width for img in imgs)
        tile_h = max(img.height for img in imgs)
        sheet = Image.new("RGB", (tile_w * cols, tile_h * rows), (24, 24, 24))
        for i, img in enumerate(imgs):
            x = (i % cols) * tile_w
            y = (i // cols) * tile_h
            sheet.paste(img, (x, y))
        path = out / "reports" / f"contact_{sheet_idx + 1:03d}.jpg"
        sheet.save(path, quality=88)
        paths.append(str(path))
    return paths


def write_ndjson(path: Path, rows: Iterable[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def rel(path: str, root: Path) -> str:
    try:
        return str(Path(path).resolve().relative_to(root.resolve()))
    except Exception:
        return path


def read_json_following_agent_browser_artifact(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if isinstance(data, dict):
        full_output = data.get("fullOutputPath")
        if not isinstance(full_output, str):
            nested = data.get("data")
            if isinstance(nested, dict):
                full_output = nested.get("fullOutputPath")
        if isinstance(full_output, str):
            nested_path = Path(full_output).expanduser()
            if nested_path.exists() and nested_path.resolve() != path.resolve():
                try:
                    nested_data = json.loads(nested_path.read_text(encoding="utf-8"))
                    if isinstance(nested_data, dict):
                        return nested_data
                except Exception:
                    pass
    return data if isinstance(data, dict) else None


def summarize_run_signals(out: Path) -> dict:
    console_paths = sorted((out / "logs").glob("console*.json"))
    error_paths = sorted((out / "logs").glob("errors*.txt"))
    console_summary = {"messages": 0, "errors": 0, "warnings": 0, "qa_events": {}, "found": False}
    if console_paths:
        try:
            data = read_json_following_agent_browser_artifact(console_paths[-1])
            messages = data.get("messages", []) if isinstance(data, dict) else []
            if isinstance(messages, list):
                console_summary["found"] = True
                console_summary["messages"] = len(messages)
                for message in messages:
                    if not isinstance(message, dict):
                        continue
                    mtype = str(message.get("type") or "")
                    text = str(message.get("text") or "")
                    if mtype == "error":
                        console_summary["errors"] += 1
                    if mtype == "warning":
                        console_summary["warnings"] += 1
                    if text.startswith("__QA_EVENT__"):
                        try:
                            event = json.loads(text[len("__QA_EVENT__") :])
                            kind = str(event.get("kind") or "unknown")
                            console_summary["qa_events"][kind] = console_summary["qa_events"].get(kind, 0) + 1
                        except Exception:
                            pass
        except Exception:
            pass

    page_errors_summary = {"found": bool(error_paths), "bytes": 0}
    if error_paths:
        try:
            page_errors_summary["bytes"] = error_paths[-1].stat().st_size
        except Exception:
            pass

    har_path = out / "network" / "network.har"
    har_summary = {"found": har_path.exists(), "entries": 0, "statuses": {}, "failed": 0}
    if har_path.exists():
        try:
            data = read_json_following_agent_browser_artifact(har_path)
            entries = data.get("log", {}).get("entries", []) if isinstance(data.get("log"), dict) else []
            if isinstance(entries, list):
                har_summary["entries"] = len(entries)
                for entry in entries:
                    if not isinstance(entry, dict):
                        continue
                    response = entry.get("response") if isinstance(entry.get("response"), dict) else {}
                    status = response.get("status")
                    key = str(status)
                    har_summary["statuses"][key] = har_summary["statuses"].get(key, 0) + 1
                    if isinstance(status, int) and status >= 400:
                        har_summary["failed"] += 1
        except Exception:
            pass

    warnings = []
    if not console_summary["found"]:
        warnings.append("console capture missing; save logs/console.final.json before analysis")
    elif not console_summary["qa_events"]:
        warnings.append("console capture found, but no __QA_EVENT__ telemetry was present")
    if not page_errors_summary["found"]:
        warnings.append("page error capture missing; save logs/errors.final.txt before analysis")
    if console_summary["errors"]:
        warnings.append(f"console contains {console_summary['errors']} error message(s)")
    if har_summary["found"] and har_summary["entries"] == 0:
        warnings.append("HAR has 0 entries; start HAR before navigation or before network-heavy actions")
    if har_summary["failed"]:
        warnings.append(f"HAR contains {har_summary['failed']} failed request(s)")

    return {"console": console_summary, "page_errors": page_errors_summary, "har": har_summary, "warnings": warnings}


def write_reports(out: Path, video: Path, meta: dict, contact_sheets: list[str], anomalies: list[Anomaly], signals: dict) -> None:
    rows = [asdict(a) for a in anomalies]
    write_ndjson(out / "anomalies.ndjson", rows)

    manifest = {
        "video": str(video),
        "summary": {
            "duration_seconds": meta.get("duration_seconds"),
            "fps": meta.get("fps"),
            "frame_count": meta.get("frame_count"),
            "initial_blank_samples_ignored": meta.get("initial_blank_samples_ignored", 0),
            "visual_anomalies": len(anomalies),
            "blank_frames": sum(1 for a in anomalies if "blank" in a.kind),
            "flickers": sum(1 for a in anomalies if a.kind == "flicker"),
            "major_changes": sum(1 for a in anomalies if a.kind == "major_change"),
        },
        "artifacts": {
            "contact_sheets": [rel(p, out) for p in contact_sheets],
            "anomalies": "anomalies.ndjson",
            "review": "reports/review.md",
        },
        "signals": signals,
        "top_findings": rows,
    }
    (out / "reports" / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    lines = [
        "# Visual Flight Recorder Review",
        "",
        f"Video: `{rel(str(video), out)}`",
        f"Duration: `{meta.get('duration_seconds', 0):.2f}s`",
        f"Sampled FPS: `{meta.get('sample_fps', 'unknown')}`",
        f"Initial blank samples ignored: `{meta.get('initial_blank_samples_ignored', 0)}`",
        "",
        "## Contact sheets",
        "",
    ]
    for p in contact_sheets:
        lines.append(f"- `{rel(p, out)}`")
    lines += ["", "## Signal summary", ""]
    console = signals.get("console", {}) if isinstance(signals, dict) else {}
    page_errors = signals.get("page_errors", {}) if isinstance(signals, dict) else {}
    har = signals.get("har", {}) if isinstance(signals, dict) else {}
    signal_warnings = signals.get("warnings", []) if isinstance(signals, dict) else []
    lines += [
        f"- Console messages: `{console.get('messages', 0)}`",
        f"- Console errors: `{console.get('errors', 0)}`",
        f"- Console warnings: `{console.get('warnings', 0)}`",
        f"- QA telemetry event kinds: `{len(console.get('qa_events', {}) or {})}`",
        f"- Page error capture: `{'present' if page_errors.get('found') else 'missing'}`",
        f"- HAR entries: `{har.get('entries', 0)}`",
        f"- HAR failed requests: `{har.get('failed', 0)}`",
        "",
    ]
    if signal_warnings:
        lines += ["### Signal warnings", ""]
        lines += [f"- {warning}" for warning in signal_warnings]
        lines.append("")
    lines += [
        "## False-positive guidance",
        "",
        "Expected theme changes, viewport resizes, intentional scrolls, and route transitions can produce large visual diffs. Treat them as findings only when they also show blanking, flicker, lost input/focus, broken layout, unreadable transient states, console errors, or failed requests. Startup blank frames are suppressed when they occur before the first normal frame.",
        "",
        "## Top visual anomalies",
        "",
    ]
    if not anomalies:
        lines.append("No high-confidence visual anomalies detected by the mechanical pass. Still inspect contact sheets for semantic UX issues.")
    for a in anomalies:
        ev = {k: rel(v, out) for k, v in a.evidence.items()}
        nearest = a.details.get("nearest_action")
        nearest_text = ""
        if isinstance(nearest, dict):
            nearest_text = f"Nearest action: `{nearest.get('kind')}` `{nearest.get('target')}` {float(nearest.get('seconds_before', 0)):.2f}s before\n"
        lines += [
            f"### {a.id}: {a.kind} at {timestamp(a.time)}",
            "",
            f"Score: `{a.score}`",
            f"Frame: `{a.frame_no}`",
            nearest_text,
            f"Details: `{json.dumps(a.details)}`",
            "",
            f"- Before: `{ev['before']}`",
            f"- During: `{ev['during']}`",
            f"- After: `{ev['after']}`",
            f"- Diff: `{ev['diff']}`",
            "",
            "Review note: first check whether the nearest action was an expected theme, resize, scroll, or route transition. Convert to a finding only if the frames or correlated signals show blanking, flicker, lost input/focus, broken layout, console errors, or failed requests.",
            "",
        ]
    (out / "reports" / "review.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    video = Path(args.video).expanduser().resolve()
    out = Path(args.out_dir).expanduser().resolve()
    if not video.exists():
        print(f"error: video not found: {video}", file=sys.stderr)
        return 2
    dependency_status = load_dependencies()
    if dependency_status:
        return dependency_status
    ensure_dirs(out)
    try:
        samples, meta = read_samples(video, args.sample_fps, args.analysis_width)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3
    meta["sample_fps"] = args.sample_fps
    meta["initial_blank_samples_ignored"] = len(initial_blank_sample_ids(samples, args))
    if not samples:
        print("error: no frames decoded", file=sys.stderr)
        return 3
    contacts = make_contact_sheets(out, samples, args.contact_fps, args.sample_fps, args.contact_width, args.tile_cols, args.tile_rows)
    actions_path = Path(args.actions).expanduser().resolve() if args.actions else out / "actions.ndjson"
    actions = load_actions(actions_path)
    detected = detect_anomalies(samples, args)
    anomalies = write_anomaly_cards(out, samples, detected, actions)
    signals = summarize_run_signals(out)
    write_reports(out, video, meta, contacts, anomalies, signals)
    print(json.dumps({
        "video": str(video),
        "out_dir": str(out),
        "samples": len(samples),
        "anomalies": len(anomalies),
        "review": str(out / "reports" / "review.md"),
        "manifest": str(out / "reports" / "manifest.json"),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
