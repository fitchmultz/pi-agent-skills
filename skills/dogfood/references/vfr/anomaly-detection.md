# Anomaly Detection

Use this reference when tuning visual analysis thresholds or building stream watchers.

## Core detectors

### Blank frame

A frame is suspicious if it is nearly all white or black:

```text
grayscale stddev < 3
and mean > 245  -> white blank
or  mean < 10   -> black blank
```

Raise severity if it occurs after initial load, after a click, during streaming, or between two normal frames.

### Major visual delta

Compare sampled frame `N` with frame `N-1` after resizing to a smaller analysis width.

```text
changed_ratio = pixels where abs(gray_N - gray_prev) > 30 / total pixels
major change default threshold = 25%
```

Major deltas are hints, not bugs. They become findings when unexpected for the scenario.

### Flicker / A-B-A pattern

A possible flicker exists when:

```text
diff(N, N-1) is high
and diff(N-1, N-2) is high
and diff(N, N-2) is low
```

Default:

```text
adjacent changed_ratio > 10%
two-back changed_ratio < 2%
```

This catches one-frame overlays, empty-state flashes, and popover jumps.

### Freeze / no-op after action

Requires action timestamps. Flag when a user action is followed by:

```text
visual delta < 1%
no DOM/a11y change
no network request
no console event
for > 800 ms
```

This catches dead buttons and missed clicks.

### Layout jump

Best signal is browser-side `layout-shift` or Long Animation Frame attribution. Visual fallback:

- large changed region mostly vertical/horizontal movement
- text blocks remain visually similar but move by many pixels
- repeated movement after content append

## Contact sheets

Use contact sheets for whole-run review:

- 1 fps for overview
- 2 fps for moderate interaction
- 6-15 fps for suspicious windows

Always burn timestamps into contact sheets so evidence can map back to video.

## High-value transient issues

Look for:

- white/black/blank flashes
- loading spinners that cover usable controls
- stale content flash before fresh content
- optimistic UI rollback flicker
- modal/popover wrong position for one frame
- layout jump after images/fonts/content load
- scroll jumps while content streams
- focus moving away from active input
- text cursor jumping while typing
- disabled controls that still react
- error toasts that disappear too fast to read

## False positives to dismiss

- deliberate route/page transitions
- skeleton loaders on initial load
- expected sidebar/panel animation inside the animated region
- theme switches requested by the user
- video compression artifacts in low-quality recordings
- cursor blink in a text input
- streaming text append in the expected output region

Use project masks for dynamic regions when repeat runs produce too many false positives.

## Useful local commands

Extract overview frames:

```bash
ffmpeg -hide_banner -y -i "$VIDEO" -vf "fps=1,scale=1280:-1" "$RUN/frames/frame_%06d.jpg"
```

Scene keyframes:

```bash
ffmpeg -hide_banner -y -i "$VIDEO" \
  -vf "select='gt(scene,0.12)',scale=1280:-1" \
  -fps_mode vfr "$RUN/keyframes/scene_%05d.jpg"
```

Suspicious-window frames:

```bash
ffmpeg -hide_banner -y -ss 00:00:18 -to 00:00:22 -i "$VIDEO" \
  -vf "fps=12,scale=1280:-1" "$RUN/frames/suspect_%06d.jpg"
```

OCR a candidate frame:

```bash
tesseract "$RUN/keyframes/VIS-001.during.jpg" stdout > "$RUN/ocr/VIS-001.txt" 2>/dev/null || true
```
