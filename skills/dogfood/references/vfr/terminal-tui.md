# Terminal and TUI VFR

Use this reference for cursor jumps, redraw flicker, streaming output, focus/input loss, broken colors, unreadable layouts, spinners, and full-screen TUI transitions.

## Contract

The terminal path wraps the target command in localhost-only ttyd, then uses the same browser lifecycle as ordinary VFR:

```text
terminal-start -> render-check -> record -> interact -> record stop -> terminal-stop -> contact sheets -> agent image review
```

Read `workflow.md` first. Its ffmpeg preflight, absolute paths, artifact verification, self-inspection, session ownership, and stop-before-close rules all apply here.

## 1. Start the terminal helper

Resolve helper paths against the dogfood skill directory, then run:

```bash
python3 <dogfood-skill-dir>/scripts/vfr.py doctor
python3 <dogfood-skill-dir>/scripts/vfr.py init \
  .dogfood/runs/<timestamp>-terminal \
  --viewport 1600x1000
python3 <dogfood-skill-dir>/scripts/vfr.py terminal-start \
  <absolute-run> --cwd <project> -- <command-under-test>
```

`terminal-start` prints a localhost URL and PID. It binds ttyd to `127.0.0.1`, enables input, sets stable terminal colors/font/scrollback, and records cleanup metadata. Use the printed literal URL and absolute run path; shell variables do not persist across Pi tool calls.

Do not hand-build ttyd commands unless debugging the helper. Do not expose ttyd beyond localhost.

## 2. Verify rendering before the real flow

```json
{ "args": ["open", "<printed-url>"], "sessionMode": "fresh", "timeoutMs": 60000 }
{ "args": ["set", "viewport", "1600", "1000"] }
{ "args": ["screenshot", "<absolute-run>/frames/render-check.png"] }
```

Open `render-check.png` with `read` immediately. Stop the run if it shows duplicated panes, crushed spacing, missing colors, a reconnect screen, an empty terminal after unexpected command exit, or unreadable layout:

```bash
python3 <dogfood-skill-dir>/scripts/vfr.py terminal-stop <absolute-run>
```

Fix setup before attempting a long capture.

## 3. Record and interact

```json
{ "args": ["record", "start", "<absolute-run>/video.webm"] }
```

Verify the pending recording contract and absence of `recordingDependencyWarning` exactly as described in `workflow.md`.

`snapshot -i` should expose a textbox named `Terminal input` when input is available. Prefer human-paced typing for streaming and redraw checks:

```json
{
  "job": {
    "steps": [
      { "action": "snapshot" },
      {
        "action": "type",
        "selector": "@e1",
        "text": "<test input>",
        "delayMs": 20,
        "press": "Enter"
      }
    ]
  }
}
```

Add action markers before important input, interrupts, resizes, or mode changes. Avoid huge instant paste when the point is typing, cursor, or redraw behavior.

## 4. Capture terminal state

Screenshots are the source of truth for appearance. The xterm.js text buffer is optional correlated evidence and can contain secrets, prompts, paths, or account data.

Print the capture script:

```bash
python3 <dogfood-skill-dir>/scripts/vfr.py terminal-capture-js
```

Pass that output through native `agent_browser` `eval --stdin` and save it:

```json
{
  "args": ["eval", "--stdin"],
  "stdin": "<terminal-capture-js output>",
  "outputPath": "<absolute-run>/logs/terminal-state.final.json"
}
```

## 5. Stop, analyze, and inspect

Capture the final state while still visible, then stop recording before stopping ttyd:

```json
{ "args": ["screenshot", "<absolute-run>/frames/final.png"] }
{ "args": ["record", "stop"] }
```

Require fully verified video metadata. Close the run-owned browser now, before post-processing; leave a caller-owned authenticated session open:

```json
{ "args": ["close"] }
```

Then:

```bash
python3 <dogfood-skill-dir>/scripts/vfr.py terminal-stop <absolute-run>
python3 <dogfood-skill-dir>/scripts/vfr.py contact-sheet <absolute-run>
python3 <dogfood-skill-dir>/scripts/vfr.py validate <absolute-run>
```

Open, in order, with `read`:

1. `frames/render-check.png`
2. `frames/final.png`
3. every `reports/contact_ffmpeg_*.jpg`
4. focused anomaly frames when deep analysis was needed

Check cursor stability, duplicate/redrawn regions, intermediate readability, wrapping, colors, spinner behavior, focus/input retention, and whether the final state was visible long enough for a human.

## Gotchas

- Do not wrap Pi or rich TUIs in `script(1)`; a real capture produced duplicated/broken-looking sections.
- If the command exits before the final screenshot, ttyd may show a blank page. Review the video sheets before calling that a product defect.
- Cursor blink, intentional spinners, and full-screen redraws can look anomalous in frame diffs.
- Browser viewport and font size determine terminal dimensions; retain both in run metadata.
- Always run `terminal-stop`, including browser or recording failure paths.
- Redact screenshots, video frames, terminal-state JSON, and logs before sharing outside the local repo.
