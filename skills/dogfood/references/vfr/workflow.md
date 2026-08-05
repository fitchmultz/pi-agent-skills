---
name: dogfood-vfr-workflow
description: One safe Pi-native workflow for recording, verifying, and inspecting transient browser behavior.
---

# Dogfood Visual Flight Recorder Workflow

Use this reference for flicker, streaming, animation, loading, first-paint, resize, and other motion defects. The agent must inspect derived images itself. The user is not the review surface.

## Non-negotiable contract

1. Preflight ffmpeg before starting any recording.
2. Use native `agent_browser`, one focused flow, one absolute output path, and a run-owned managed session.
3. Treat `record start` as pending. Treat any recording dependency warning as a blocker.
4. Stop exactly once, then require verified artifact metadata before analysis or close.
5. Generate contact sheets and open them with `read`.
6. Stop recording before closing the browser on every path.

Do not add HAR, observer telemetry, trace, profiler, or live stream capture unless the suspected defect needs that signal.

## 1. Prepare a unique run

Resolve relative helper paths against the directory containing the dogfood `SKILL.md`. Do not invent `VFR_ROOT` or ask the user where the skill is installed.

Ensure the target project ignores `.dogfood/`, then run:

```bash
python3 <dogfood-skill-dir>/scripts/vfr.py doctor
python3 <dogfood-skill-dir>/scripts/vfr.py init \
  .dogfood/runs/<timestamp>-<slug> \
  --target-url <target-url> \
  --viewport 1440x1000
```

`doctor` exits nonzero when ffmpeg is unavailable. Stop there. Do not call `record start`, install software without permission, or hope `record stop` will work later.

`init` prints the absolute run path. Pi shell state does not persist between `bash` calls, so copy that literal absolute path into every later command and browser artifact path. Do not rely on `$RUN` surviving another tool call.

Use the app’s normal startup command with a PID or other deterministic cleanup handle. Keep the capture focused: 10–30 seconds and one user journey by default. Split longer scenarios into separately named recordings.

## 2. Orient before recording

Start a run-owned managed session and confirm the target is ready:

```json
{ "args": ["open", "<target-url>"], "sessionMode": "fresh" }
{ "args": ["set", "viewport", "1440", "1000"] }
{ "args": ["snapshot", "-i"] }
{ "args": ["screenshot", "<absolute-run>/frames/render-check.png"] }
```

Open `frames/render-check.png` with `read`. Fix the test setup before continuing if the page is blank, clipped, incorrectly sized, unauthenticated, or on the wrong tab.

For first-paint work, begin on `about:blank`, start recording, set the viewport again, then navigate to the target. For ordinary interaction work, orient on the target first so setup noise is not part of the evidence.

## 3. Start one recording

```json
{ "args": ["record", "start", "<absolute-run>/video.webm"] }
```

Before acting, inspect the result:

- `details.resultCategory` is `success`.
- `details.artifactVerification.pendingCount` is `1`.
- The video row has `recordingState: "openRecording"` and `willExistOnStop: true`.
- `details.recordingDependencyWarning` is absent.
- The reported absolute path is the intended run path.

Pending is correct at start. Missing ffmpeg is not. If a dependency warning appears despite preflight, do not execute the user flow. Attempt `record stop` once, then close only the run-owned session; follow exact `details.nextActions` if a prompt guard blocks cleanup. Report motion capture as blocked.

Add a marker immediately before the important action:

```bash
python3 <dogfood-skill-dir>/scripts/vfr.py action \
  <absolute-run> click "<control>" --note "<expected transition>"
```

Use native snapshots, refs, semantic actions, or jobs for the flow. Use human-visible cadence when testing typing or streaming. Take screenshots at meaningful states, not every step.

Do not call another `record start` while active. Do not use `record restart` to recover a failed stop; use a separate run for another segment.

## 4. Stop and prove the file

Capture the final visible state before stopping:

```json
{ "args": ["screenshot", "<absolute-run>/frames/final.png"] }
{ "args": ["record", "stop"] }
```

A usable stop result must have all of these:

- `details.resultCategory === "success"`
- `details.artifactVerification.verified === true`
- `missingCount === 0`
- `pendingCount === 0`
- `unverifiedCount === 0`
- a video artifact with `exists: true` at the expected absolute path

Use an exact `details.nextActions` payload when present. Do not parse a path from prose, start a replacement recording, or report success after a failed stop.

## 5. Close the capture surface

Once recording stop is verified, close the run-owned browser before any post-processing:

```json
{ "args": ["close"] }
```

If the run reused a caller-owned authenticated session, leave it open instead. Browser close retains explicit recordings and screenshots. If `details.promptGuard.reason` is `requested-artifacts-missing-before-close`, use its exact next actions, save the requested artifacts, and retry close.

Do this even when contact-sheet generation or analysis may fail. Stop the app process started by the run when browser interaction is finished. For terminal capture, also run `vfr.py terminal-stop` before post-processing.

## 6. Turn video into images

The default review helper needs only ffmpeg, which recording already requires:

```bash
python3 <dogfood-skill-dir>/scripts/vfr.py contact-sheet <absolute-run>
python3 <dogfood-skill-dir>/scripts/vfr.py validate <absolute-run>
```

`contact-sheet` samples at 2 FPS and emits one or more `reports/contact_ffmpeg_*.jpg` files. Open these with `read`, in order:

1. `frames/render-check.png`
2. `frames/final.png`
3. every `reports/contact_ffmpeg_*.jpg`

Inspect the whole sheet, not only the first tile. Solid pink cells at the end of the last sheet are unused helper padding, not video frames. Look for blank frames, A-B-A flicker, layout jumps, clipped or unreadable intermediate states, lost focus/input, broken loading states, and visual changes that do not match the recorded action.

Do not ask the user to inspect the images. If `read` cannot render them, report that tooling blocker and lower motion confidence.

### Deep anomaly analysis

Use the heavier analyzer only when contact sheets look suspicious, the user explicitly asks for exhaustive transient analysis, or the defect may be shorter than the default sampling interval:

```bash
uv run <dogfood-skill-dir>/scripts/analyze-video.py \
  --video <absolute-run>/video.webm \
  --out-dir <absolute-run> \
  --sample-fps 6 \
  --contact-fps 2 \
  --max-anomalies 20
```

Read `reports/review.md`, then open all analyzer contact sheets and the before/during/after images for every top anomaly. Treat mechanical scores as triage hints, not findings. Expected route changes, scrolls, viewport changes, and theme switches are not defects unless frames show blanking, flicker, layout loss, lost input, or unreadable state.

Extract individual timestamps with ffmpeg only after a sheet or anomaly points to a narrow window. Do not create dozens of arbitrary frames before reviewing the generated sheets.

## 7. Optional correlated signals

Add only what the suspected defect needs:

- Console/page errors: after a suspicious transition or at the end.
- Network requests or HAR: request failures, loading hangs, or response-driven flicker.
- Browser observer: focused performance correlation where ordinary browser diagnostics are insufficient.
- Trace or profiler: short performance repro, never both at once.
- Stream: only when a dedicated local watcher consumes it.

Missing optional signals do not invalidate a verified video and inspected visual evidence. Correlated errors can still raise finding severity.

## Failure recovery

| Signal | Action |
| --- | --- |
| `doctor` reports missing ffmpeg | Do not start recording. Use inspected screenshots and report low motion confidence. |
| Start reports the wrong path | Stop immediately; do not continue or restart over another run’s artifact. |
| Start says recording already active | Stop and verify the existing recording before doing anything else. |
| Stop fails | Do not start/restart. Follow exact next actions, preserve screenshots, and clean up the run-owned session. |
| Page becomes `about:blank` or wrong tab | Use `tab list`, select the intended tab, then `snapshot -i`; do not reuse old refs. |
| Recording is long or sheets are overwhelming | Redo one 10–30 second focused flow. |
| Contact-sheet or analyzer command fails | The browser should already be closed. Keep the verified video/screenshots, report the post-processing blocker, and do not claim motion confidence. |
| Contact sheet is inconclusive | Run deep anomaly analysis or extract only the suspected timestamp window. |

## Evidence claim

High motion confidence requires all of the following:

- verified completed video
- render-check and final screenshots
- action marker identifying the tested transition
- contact sheets covering the run
- exact image paths opened by the agent and named in the report

A structural validator pass means the bundle is reviewable. It does not prove anyone inspected the images.
