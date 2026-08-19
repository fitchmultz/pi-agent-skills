# Evidence Bundle

Use this reference after capture to decide what the agent must inspect and cite.

## Minimal bundle

```text
.dogfood/runs/<timestamp>-<slug>/
  meta.txt
  actions.ndjson
  video.webm
  frames/render-check.png
  frames/final.png
  reports/contact_ffmpeg_*.jpg
  reports/validation.json
  reports/validation.md
```

Optional deep analysis adds:

```text
  anomalies.ndjson
  reports/manifest.json
  reports/review.md
  reports/contact_*.jpg
  keyframes/<finding>.before|during|after.jpg
  diffs/<finding>.diff.jpg
```

Console, page-error, HAR, trace, profile, and terminal-buffer files are correlated signals, not default requirements.

## Timeline

Use action order as the baseline. Add a sync marker near recording start when precise timing matters:

```json
{"kind":"sync","wall":1770000000000,"video_t":0,"url":"https://app-under-test.local/"}
```

`wall` is epoch milliseconds. `video_t` is seconds since recording start. Browser `performance.now()` is optional. Exact synchronization is useful but not worth losing the visual evidence.

## Agent review order

1. Read structural validation output. Fix fatal missing video, screenshot, or contact-sheet artifacts.
2. Open `frames/render-check.png` with `read`.
3. Open `frames/final.png` with `read`.
4. Open every contact sheet in chronological order with `read`; solid pink tail cells are unused helper padding.
5. When deep analysis exists, read `reports/review.md`, then open every top anomaly’s before/during/after frames.
6. Check optional console/network/performance signals only around suspicious transitions.
7. Reproduce plausible issues in a shorter focused recording.

A validation pass means the bundle can be reviewed. It does not prove visual inspection happened. The report must name the exact images the agent opened.

Do not ask the user to inspect evidence. If the image-capable tool cannot open an artifact, report that limitation and lower confidence.

## What to look for

- blank, black, or white intermediate frames
- A-B-A flicker
- layout or scroll jumps unrelated to the recorded action
- clipped, overlapped, or unreadable transient content
- input, focus, or cursor loss
- stale loading indicators or missing progress
- terminal duplicate regions or redraw residue
- errors that appear only between stable screenshots

Expected scrolling, navigation, resizing, animation, and theme changes are not findings unless they cause visible loss, unreadability, or broken interaction.

## Confidence

**High motion confidence** requires a verified completed video, screenshot anchors, action markers, contact sheets covering the run, and agent inspection of those images.

**Medium** means video exists but evidence is incomplete, poorly synchronized, too long, or only partly inspected.

**Low** means only steady-state screenshots exist or recording could not be verified.

## Finding evidence

For each transient finding include:

```markdown
### High: Main content flashes blank after submit
- Repro: exact user steps
- Expected: existing content remains visible while processing
- Actual: main content blanks briefly after submit
- Video: `.dogfood/runs/.../video.webm`
- Frames: before, during, and after image paths
- Contact sheet: exact sheet path
- Correlated signals: optional console/network/performance evidence
```

Before sharing outside the local repo, inspect and redact private data, URLs/query strings, tokens, emails, headers, terminal output, and account identifiers.
