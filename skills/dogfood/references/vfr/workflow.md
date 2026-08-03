---
name: dogfood-vfr-workflow
description: Reference workflow for dogfood realtime-ish visual evidence capture: video, browser telemetry, traces, network logs, and frame anomalies.
---

# Dogfood Visual Flight Recorder Workflow

Use this reference when static screenshots are not enough. The goal is to make a web-app run inspectable after the fact as a synchronized sensor stream: video, action timestamps, DOM/accessibility snapshots, console/errors, network/HAR, performance events, traces, and frame anomaly cards. Verify browser command details with the current harness or `agent-browser --help` / `agent-browser skills get core` before relying on examples.

A VFR completion claim must say whether confidence covers motion/streaming behavior or only steady-state rendering. Motion confidence requires video/frame evidence plus analyzer review/contact sheets, not only final screenshots.

## Core idea

Do not ask the model to watch a whole video. Make local tools watch continuously, then give the model compact evidence:

```text
human action -> visual anomaly -> telemetry correlation -> keyframes/contact sheet -> focused repro
```

## Minimal validation pass

Use this path when the user asks for a quick VFR check or when validating the VFR workflow itself:

1. Run `scripts/vfr.py doctor`, then `scripts/vfr.py init "$RUN" --target-url "$TARGET_URL" --viewport "1440x1000"`.
2. Start the app under test and open `about:blank`.
3. Set viewport, clear console/errors, then start recording and HAR before navigating to `$TARGET_URL`.
4. Add a `sync` marker and 3-5 action markers with `scripts/vfr.py`.
5. Capture at least one screenshot, final console, final errors, HAR, and video.
6. Run `uv run scripts/analyze-video.py`, then `scripts/vfr.py validate "$RUN" --strict`.
7. Read `reports/validation.md` and `reports/review.md`; actually view representative screenshots/contact sheets/anomaly frames with an image-capable tool.
8. Record what you inspected with `scripts/vfr.py review-note`.
9. Stop/close every browser/app process started for the run.

## Default workflow

### 1. Create a run folder

```bash
RUN=".dogfood/runs/$(date -u +%Y%m%dT%H%M%SZ)"
# Set VFR_ROOT to the dogfood skill directory that contains SKILL.md.
VFR_ROOT="${VFR_ROOT:?set VFR_ROOT to the dogfood skill directory}"
python3 "$VFR_ROOT/scripts/vfr.py" doctor
python3 "$VFR_ROOT/scripts/vfr.py" init "$RUN" \
  --target-url "${TARGET_URL:-}" \
  --session "vfr" \
  --viewport "1440x1000"
```

### 2. Start the app and browser

For local web apps, start the app under test in a logged background process. Use that project's normal dev command. Prefer `tmux` or a PID file so cleanup is deterministic. Replace `YOUR_DEV_COMMAND` and `TARGET_URL` in examples with the target project's values.

```bash
YOUR_DEV_COMMAND > "$RUN/logs/devserver.log" 2>&1 &
echo $! > "$RUN/devserver.pid"
export TARGET_URL="http://localhost:3000/"
```

Open the browser to `about:blank`, set a stable viewport, clear prior logs, then start capture **before navigating to the target** when request coverage matters. In pi, call the native `agent_browser` tool for these actions; in CLI-only contexts, use direct `agent-browser`. Use top-level `timeoutMs` for slow opens instead of switching to shell browser automation. Use top-level `outputPath` to save successful native-tool payloads such as snapshots, eval results, console dumps, or extracted text. Artifact-producing commands should print a visible artifact block with requested path, absolute path, existence, size, session, and CWD; if not, verify the file before trusting the path.

```bash
agent-browser --session vfr open "about:blank"
agent-browser --session vfr set viewport 1440 1000
agent-browser --session vfr console --clear || true
agent-browser --session vfr errors --clear || true
```

### 3. Start always-on capture before navigation

```bash
agent-browser --session vfr record start "$RUN/video.webm"
agent-browser --session vfr network har start
python3 "$VFR_ROOT/scripts/vfr.py" \
  sync "$RUN" --url "about:blank" --viewport "1440x1000"
python3 "$VFR_ROOT/scripts/vfr.py" \
  action "$RUN" navigate "$TARGET_URL"
agent-browser --session vfr open "$TARGET_URL"
agent-browser --session vfr snapshot > "$RUN/logs/a11y.initial.txt"
agent-browser --session vfr screenshot --annotate "$RUN/frames/initial.annotated.png"
test -f "$RUN/frames/initial.annotated.png"
```

In the native pi `agent_browser` tool, `record start`/`record restart` reports the video artifact as pending (`recordingState: "openRecording"`, `willExistOnStop: true`) until `record stop` writes the file. Treat that as healthy recording state, not a missing artifact.

Do not start `trace` and `profiler` together. They use overlapping browser tracing machinery and can produce huge files. Use one of these only for focused repros or when performance/jank is the main target:

```bash
# Focused timeline trace:
agent-browser --session vfr trace start "$RUN/trace/trace"

# OR focused performance profile, not both:
agent-browser --session vfr profiler start
```

Optional live stream for local CV watching:

```bash
agent-browser --session vfr stream enable
agent-browser --session vfr stream status --json > "$RUN/logs/stream.status.json"
```

`stream status --json` should be valid JSON with `data.wsUrl` and `data.frameFormat`. The stream protocol is WebSocket frames with base64 JPEG payloads. If a watcher is used, it should keep a short ring buffer and emit `anomalies.ndjson` instead of trying to involve the model frame-by-frame.

### 4. Inject passive browser telemetry

Use `assets/browser-observer.js` when supported by the browser tool or by Playwright/CDP. The default observer is privacy-safe: it strips URL query/hash, does not capture user agent, does not capture element text, and logs only slow resource timings. A project may opt into richer telemetry with `window.__VFR_OBSERVER_OPTIONS__` before injection. It logs `__QA_EVENT__{...}` lines to the console for:

- Long Animation Frames / long tasks / RAF gaps
- layout shifts
- paint/LCP/slow-resource/event timings
- focus changes without element text by default
- scroll changes
- DOM mutation bursts
- uncaught errors and unhandled promise rejections

When using Playwright, add it with `page.addInitScript`. When using agent-browser, inject through `eval --stdin` after each navigation if add-init-script is not available. The helper prints the observer script to stdout for easier native-tool use.

CLI form:

```bash
python3 "$VFR_ROOT/scripts/vfr.py" observer-js \
  | agent-browser --session vfr eval --stdin
```

Native `agent_browser` tool form:

```json
{
  "args": ["eval", "--stdin"],
  "stdin": "<contents of: python3 $VFR_ROOT/scripts/vfr.py observer-js>",
  "outputPath": ".dogfood/runs/RUN_ID/logs/observer-inject.json"
}
```

### 5. Execute human-paced scenarios

Record actions as you go. Prefer real user cadence:

- type character-by-character during repros
- pause 0.3-1.5s after actions
- scroll in chunks
- hover menus
- resize/switch tabs during long runs
- retry actions and interrupt loading/streaming

Append action markers to `$RUN/actions.ndjson` with the helper instead of hand-written JSON:

```bash
python3 "$VFR_ROOT/scripts/vfr.py" \
  action "$RUN" click "Send" --note "Submit long prompt"
agent-browser --session vfr find role button click --name "Send"
sleep 1
agent-browser --session vfr snapshot > "$RUN/logs/a11y.after-send.txt"
agent-browser --session vfr console --json > "$RUN/logs/console.after-send.json" || true
agent-browser --session vfr errors > "$RUN/logs/errors.after-send.txt" || true
```

In the native pi `agent_browser` tool, prefer constrained `job` `type` steps with `delayMs` and final `press` for human-paced typing flows. Direct `semanticAction.selector` is available for visible `@refs` when you already know the target:

```json
{
  "job": {
    "steps": [
      { "action": "snapshot" },
      { "action": "type", "selector": "@e1", "text": "long streaming prompt", "delayMs": 20, "press": "Enter" }
    ]
  }
}
```

```json
{ "semanticAction": { "action": "click", "selector": "@e7" } }
```

Use this generic scenario matrix unless the project supplies a better one:

- desktop primary path
- mobile/narrow viewport primary path
- dark and light theme
- reduced-motion setting when supported
- keyboard-only navigation and Escape dismissal
- long content / overflow / scrolling
- empty, loading, success, and error states
- slow/offline network for request-heavy apps
- rapid panel/menu toggles during animation or streaming

High-yield transient bug moves:

- start a run, navigate away, then return
- type while output streams
- scroll while content appends
- rapid toggle sidebars/panels
- resize during animation
- hit Escape during loading/modals
- slow network or offline mid-request
- dark/light/reduced-motion variants

### 6. Stop capture and extract evidence

Stop only the optional trace/profile mode you started. Always stop HAR, video, and stream.

```bash
# If trace was started:
agent-browser --session vfr trace stop "$RUN/trace/trace.zip" || true

# If profiler was started instead:
agent-browser --session vfr profiler stop "$RUN/profile/profile.json" || true

agent-browser --session vfr network har stop "$RUN/network/network.har" || true
agent-browser --session vfr record stop || true
agent-browser --session vfr stream disable || true
agent-browser --session vfr console --json > "$RUN/logs/console.final.json" || true
agent-browser --session vfr errors > "$RUN/logs/errors.final.txt" || true
```

If `console --json` returns compacted output with a `fullOutputPath`, copy that JSON artifact into `$RUN/logs/console.final.json` before analysis. This makes `analyze-video.py` and `vfr.py validate` able to summarize console errors and `__QA_EVENT__` telemetry.

Then run the video analyzer and validate the evidence bundle. The analyzer automatically reads `$RUN/actions.ndjson` when present, annotates anomaly cards with the nearest prior action, and summarizes console/HAR signals when those files are present.

```bash
uv run "$VFR_ROOT/scripts/analyze-video.py" \
  --video "$RUN/video.webm" \
  --out-dir "$RUN" \
  --sample-fps 6 \
  --contact-fps 1 \
  --max-anomalies 20
python3 "$VFR_ROOT/scripts/vfr.py" \
  validate "$RUN" --strict
```

Read `$RUN/reports/validation.md` first, including its Motion Confidence section, then `$RUN/reports/review.md`, then inspect contact sheets and anomaly triptychs with an image-capable tool. Record at least one `review-note` after inspecting actual images; strict validation treats missing manual visual review notes as a failure because deterministic gates are not proof by themselves. Treat expected action-driven changes such as viewport resize, intentional scroll, route transition, or theme switch as false positives unless they expose blanking, flicker, layout loss, errors, or input disruption.

```bash
python3 "$VFR_ROOT/scripts/vfr.py" \
  review-note "$RUN" "$RUN/reports/contact_001.jpg" \
  --verdict ok \
  --note "Contact sheet inspected; no visible flicker, blanking, or layout loss in sampled frames."
```

## Native `agent_browser` tool examples

Use exact argument arrays and save any compacted `fullOutputPath` artifact back into the run folder. Do not include `--json`; the pi wrapper injects it. For pi-native runs, use shell only for the local helper scripts and app process management; use `agent_browser` for browser actions.

```json
{ "args": ["open", "about:blank"], "sessionMode": "fresh" }
{ "args": ["set", "viewport", "1440", "1000"] }
{ "args": ["record", "start", ".dogfood/runs/RUN_ID/video.webm"] }
{ "args": ["network", "har", "start"] }
{ "args": ["open", "http://localhost:3000/"] }
{ "args": ["snapshot", "-i"] }
{ "args": ["screenshot", ".dogfood/runs/RUN_ID/frames/state.png"] }
{ "args": ["console", "--json"] }
{ "args": ["errors"] }
{ "args": ["network", "har", "stop", ".dogfood/runs/RUN_ID/network/network.har"] }
{ "args": ["record", "stop"] }
{ "args": ["close"] }
```

For annotated screenshots in a pi batch call, put `--annotate` at the top level:

```json
{
  "args": ["--annotate", "batch"],
  "stdin": "[[\"screenshot\",\".dogfood/runs/RUN_ID/frames/annotated.png\"]]"
}
```

## Evidence bundle shape

Use this run layout:

```text
.dogfood/runs/<timestamp>/
  meta.txt
  config.json
  actions.ndjson
  anomalies.ndjson
  video.webm
  logs/console*.json|txt, errors*.txt, a11y*.txt, devserver.log
  network/network.har
  trace/trace.zip
  profile/profile.json
  frames/
  keyframes/
  diffs/
  clips/
  ocr/
  reports/contact_*.jpg, manifest.json, review.md, validation.md, validation.json
```

For detailed schema and review heuristics, read `evidence-bundle.md`.
For anomaly thresholds and CV ideas, read `anomaly-detection.md`.
For terminal/TUI capture with ttyd/xterm.js, read `terminal-tui.md`.

## Skill vs project split

Keep this skill generic:

- how to capture runs
- how to detect frame anomalies
- how to make evidence bundles
- how to review transient UI bugs

Keep app-specific content in the target repo:

- scenario list
- expected invariants
- masked/dynamic regions
- seed data/auth state
- known allowed animations

## Cleanup and privacy

Always stop captures and app/browser processes, even on failures. For shell-driven runs, use a `trap`; with the `agent_browser` tool, close the session and then verify no dev server or browser processes remain.

```bash
cleanup_vfr() {
  agent-browser --session vfr trace stop "$RUN/trace/trace.zip" >/dev/null 2>&1 || true
  agent-browser --session vfr profiler stop "$RUN/profile/profile.json" >/dev/null 2>&1 || true
  agent-browser --session vfr network har stop "$RUN/network/network.har" >/dev/null 2>&1 || true
  agent-browser --session vfr record stop >/dev/null 2>&1 || true
  agent-browser --session vfr stream disable >/dev/null 2>&1 || true
  agent-browser --session vfr close >/dev/null 2>&1 || true
  if [ -f "$RUN/devserver.pid" ]; then
    pid="$(cat "$RUN/devserver.pid")"
    kill -- "-$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup_vfr EXIT INT TERM
```

Before sharing a bundle outside the local repo, redact or omit secrets and personal data from screenshots, HAR, console logs, URLs, storage dumps, and copied text. Prefer HAR metadata-only unless request/response bodies are explicitly needed.

## Agent-browser artifact notes

- For annotated screenshots in batch mode, put `--annotate` in top-level args, not inside the batch step.
  - Good: `{ "args": ["--session", "vfr", "--annotate", "batch"], "stdin": "[[\"screenshot\",\"$RUN/frames/good.png\"]]" }`
  - Bad: `[["screenshot", "--annotate", "$RUN/frames/bad.png"]]`
- For CLI `--json` commands, visible output should be valid JSON. In pi, do not pass `--json`; inspect the native tool result and save any compacted `fullOutputPath`.
- Artifact output should name the requested path, absolute path, existence, size, status, session, and CWD. Verify important files with `test -f` before deleting or closing.

## Anti-patterns

- Do not rely on before/after screenshots for loading, streaming, animation, or resizing flows.
- Do not send a long raw video to the model and hope it catches issues.
- Do not start `trace` and `profiler` at the same time; use one focused capture mode.
- Do not leave profiler running for whole exploratory sessions; short runs can produce hundreds of MB.
- Do not record at robotic speed; human-visible jank needs human-paced input.
- Do not turn every frame into a finding. Rank anomalies and inspect top evidence first.
- Do not make pixel-perfect diffs the source of truth for dynamic apps; use diffs as hints.
- Do not leave recordings running without cleanup commands and PID files.
- Do not start HAR after the only network-heavy navigation and then treat an empty HAR as proof of no network issues.
- Do not hand-write action JSON when the helper script can create valid action/sync records.

## Redaction checklist before sharing

Before moving artifacts outside the local repo, inspect and redact when needed:

- screenshots/video frames with private user data
- URLs, query params, tokens, emails, and local usernames
- HAR request/response headers and bodies
- console logs with secrets, local paths, or account data
- storage dumps, copied text, and uploaded files

## Validation loop

1. Run `scripts/vfr.py validate "$RUN" --strict` and fix missing or weak artifacts.
2. Confirm the run folder has video, meta, actions, console/errors, HAR when browser-based, and at least one visual artifact.
3. Read the Motion Confidence section in `reports/validation.md`; downgrade claims when evidence is only steady-state.
4. Open `reports/contact_*.jpg` and inspect the whole run at a glance with an image-capable tool.
5. Open `reports/review.md` and inspect each high-score anomaly triptych with an image-capable tool.
6. Record inspected visual artifacts with `scripts/vfr.py review-note`; do not rely only on analyzer output.
7. Correlate any finding with console/errors/HAR/perf events or terminal buffer snapshots.
8. Reproduce real issues in a short focused run with video and trace.
9. Write findings with repro steps, evidence paths, and confidence level.

## Definition of done

A visual dogfood pass is done when:

- the run folder is self-contained and navigable
- transient visual states were reviewed via contact sheets/anomaly cards
- console/errors/network/perf signals were checked
- every reported issue has reproducible steps and linked evidence
- false-positive anomalies are either dismissed in `review.md` or converted into focused repros
