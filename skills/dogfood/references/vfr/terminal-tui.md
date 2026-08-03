# Terminal and TUI VFR

Use this reference when dogfooding terminal programs, TUIs, CLIs with animated output, or editor/agent terminal panes.

## Goal

Make terminal behavior inspectable like a browser UI:

```text
vfr.py terminal-start -> ttyd/xterm.js terminal -> agent_browser video/screenshots -> xterm.js buffer snapshots -> VFR analysis
```

This works well for cursor jumps, redraw flicker, loading spinners, streaming output, focus/input loss, broken colors, unreadable layouts, and TUI state transitions.

## Preferred method

Use the helpers. Do not hand-build long `ttyd` commands unless debugging the helper.

1. Create the VFR run:

```bash
VFR_ROOT="${VFR_ROOT:?set VFR_ROOT to the dogfood skill directory}"
RUN=".dogfood/runs/$(date -u +%Y%m%dT%H%M%SZ)"
python3 "$VFR_ROOT/scripts/vfr.py" doctor
python3 "$VFR_ROOT/scripts/vfr.py" init "$RUN" --session terminal-vfr --viewport "1600x1000"
```

2. Start the terminal/TUI:

```bash
python3 "$VFR_ROOT/scripts/vfr.py" terminal-start "$RUN" --cwd "$PROJECT" -- \
  pi --model cursor/grok-4.5 "/create-goal execute the daily refresh tasks thoroughly"
```

Alternative model id: `xai/grok-4.5`.

`terminal-start` prints JSON with the local `url`, `pid`, command, cwd, and log path. It launches localhost-only `ttyd` with the known-good defaults for Pi and rich TUIs: direct mode, `TERM=xterm-256color`, `COLORTERM=truecolor`, stable font size, cursor blink disabled, scrollback enabled, and `--max-clients 3` so browser automation retries do not strand the active page on a reconnect screen.

3. Open the printed URL with `agent_browser`, set the viewport, start recording, and take an early render-check screenshot at `RUN/frames/render-check.png`. Strict validation expects that exact file for terminal/TUI runs.

4. Capture at least one terminal buffer snapshot after the TUI has rendered with `terminal-capture-js` and save it as `RUN/logs/terminal-state.<label>.json`. Strict validation expects at least one such snapshot so visual screenshots can be correlated with text/cursor state.

5. If the render-check screenshot shows duplicated panes, crushed spacing, missing colors, or unreadable layout, stop immediately:

```bash
python3 "$VFR_ROOT/scripts/vfr.py" terminal-stop "$RUN"
```

If the target project changed during the bad run, discard those target-project changes before restarting.

## Browser capture flow

Use `agent_browser`, not shell browser commands. For slow TUI startup, set a larger top-level `timeoutMs` instead of falling back to shell browser automation:

```json
{ "args": ["open", "<url printed by terminal-start>"], "sessionMode": "fresh", "timeoutMs": 60000 }
{ "args": ["set", "viewport", "1600", "1000"] }
{ "args": ["record", "start", ".dogfood/runs/RUN_ID/video.webm"] }
{ "args": ["screenshot", ".dogfood/runs/RUN_ID/frames/render-check.png"] }
```

`record start`/`record restart` reports an open recording as a pending artifact (`status: "pending"`, `recordingState: "openRecording"`, `willExistOnStop: true`). That is expected; verify the video file after `record stop`.

Immediately add a sync marker after recording starts:

```bash
python3 "$VFR_ROOT/scripts/vfr.py" sync "$RUN" --target recording-start --video-t 0 --url "$TERMINAL_URL" --viewport "1600x1000"
```

If input is needed, `snapshot -i` should expose one textbox named `Terminal input`. Prefer human-paced `job` `type` steps with `delayMs` and a final `press` when testing typing, streaming, cursor, or redraw behavior:

```json
{
  "job": {
    "steps": [
      { "action": "snapshot" },
      {
        "action": "type",
        "selector": "@e1",
        "text": "Write six short lines about terminal streaming QA.",
        "delayMs": 20,
        "press": "Enter"
      }
    ]
  }
}
```

For direct targets, `semanticAction.selector` can now fill/click/check visible `@refs` without locator guessing:

```json
{ "semanticAction": { "action": "fill", "selector": "@e1", "text": "prompt text" } }
```

Avoid huge instant paste when the point is to evaluate typing, streaming, cursor, or redraw behavior.

## Terminal buffer snapshots

Screenshots are the source of truth for visual layout, but xterm.js exposes a useful text buffer. Use this helper through `agent_browser eval --stdin` after important states and save the successful payload directly with top-level `outputPath`:

```bash
python3 "$VFR_ROOT/scripts/vfr.py" terminal-capture-js
```

```json
{
  "args": ["eval", "--stdin"],
  "stdin": "<terminal-capture-js output>",
  "outputPath": ".dogfood/runs/RUN_ID/logs/terminal-state.final.json"
}
```

The result includes `rows`, `cols`, cursor position, non-empty row count, and visible terminal text. Treat it as sensitive: it can include secrets, prompts, local paths, command output, and account data.

Use descriptive labels such as `terminal-state.rendered.json`, `terminal-state.streaming.json`, and `terminal-state.final.json`; this makes validation and later review easier.

## Stop and analyze

At the end of the run, capture a completion screenshot while the terminal is still visible when possible, then stop browser recording, then stop the terminal if it is still running:

```json
{ "args": ["screenshot", ".dogfood/runs/RUN_ID/frames/final.png"] }
{ "args": ["record", "stop"] }
```

```bash
python3 "$VFR_ROOT/scripts/vfr.py" terminal-stop "$RUN" || true
uv run "$VFR_ROOT/scripts/analyze-video.py" --video "$RUN/video.webm" --out-dir "$RUN"
python3 "$VFR_ROOT/scripts/vfr.py" validate "$RUN" --strict
```

For terminal/TUI runs, `validate --strict` fails on missing render-check screenshot, missing terminal-state snapshot, missing analyzer output/contact sheet, or missing action markers. That is intentional: without those artifacts, confidence should be reported as steady-state only or medium/low motion confidence.

Read in this order with an image-capable tool for image artifacts:

1. `frames/render-check.png`
2. `frames/final.png` or the best completion screenshot when present
3. `reports/validation.md`
4. `reports/review.md`
5. `reports/contact_*.jpg`
6. Focused anomaly triptychs in `keyframes/` and `diffs/`
7. `logs/terminal-state.*.json`

After viewing actual screenshots/contact sheets, record what you inspected:

```bash
python3 "$VFR_ROOT/scripts/vfr.py" \
  review-note "$RUN" "$RUN/reports/contact_001.jpg" \
  --verdict ok \
  --note "Inspected contact sheets and final screenshot; terminal output stayed readable during streaming."
```

## Gotchas

- Helper-first rule: use `terminal-start`, `terminal-stop`, and `terminal-capture-js`; avoid copying raw `ttyd` patterns.
- Do not wrap Pi or rich TUIs in `script(1)`; it caused duplicated/broken-looking Pi TUI sections during a real capture.
- Terminal dimensions depend on browser viewport and font size; keep the run metadata and render-check screenshot.
- If the command exits before the final screenshot, ttyd may show a blank terminal page. Do not treat that alone as a broken capture; verify the video/contact sheet contains the actual run.
- Normal cursor blink, progress spinners, and intentional full-screen redraws can look like visual anomalies.
- Do not expose `ttyd` beyond `127.0.0.1`. The helper binds locally and enables write mode only because input is required.
- Keep the helper's default `--max-clients 3` unless a test specifically needs single-client behavior; browser automation can transiently open or retry pages.
- Redact screenshots, videos, terminal-state JSON, and logs before sharing outside the local repo.

## Alternatives

- **VS Code/Electron integrated terminal:** use `agent_browser` Electron launch/attach only when the target is specifically an editor terminal workflow.
- **Plain tmux/script/asciinema:** use only when no browser is available. This is weaker for visual/TUI glitches and does not produce normal `agent_browser` artifacts.
