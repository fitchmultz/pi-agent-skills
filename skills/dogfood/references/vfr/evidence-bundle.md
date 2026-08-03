# Evidence Bundle

Use this reference after a run when deciding what the model should inspect.

## Timeline normalization

Every signal should be reducible to the same clock:

- `wall`: epoch milliseconds from `Date.now()` or shell `date +%s%3N`
- `t`: browser `performance.now()` when emitted in-page
- `video_t`: seconds since `record start`

Create a sync record near recording start:

```json
{"kind":"sync","wall":1770000000000,"performance_now":1234.56,"video_t":0,"url":"https://app-under-test.local/"}
```

If exact sync is missing, use action order plus video contact sheets. Good enough is better than losing transient evidence.

## Manifest first

The review model should open `reports/manifest.json` or `reports/review.md` before raw artifacts.

Minimal manifest shape:

```json
{
  "run_id": "20260502T000000Z",
  "url": "https://app-under-test.local/",
  "video": "video.webm",
  "summary": {
    "duration_seconds": 90.2,
    "visual_anomalies": 4,
    "blank_frames": 1,
    "major_changes": 3,
    "flickers": 0
  },
  "artifacts": {
    "contact_sheets": ["reports/contact_001.jpg"],
    "anomalies": "anomalies.ndjson"
  },
  "top_findings": [
    {
      "id": "VIS-001",
      "score": 85,
      "kind": "blank_frame",
      "time": 21.019,
      "evidence": {
        "before": "keyframes/VIS-001.before.jpg",
        "during": "keyframes/VIS-001.during.jpg",
        "after": "keyframes/VIS-001.after.jpg",
        "diff": "diffs/VIS-001.diff.jpg"
      }
    }
  ]
}
```

## Review order

1. Read `reports/validation.md`; fix strict validation failures before trusting the run.
2. Read `reports/review.md`.
3. Inspect low-fps contact sheets for whole-run gestalt.
4. Inspect the highest-score anomaly triptychs: before/during/after.
5. Inspect diff heatmaps for changed regions.
6. Check console/errors/HAR/trace windows around the same timestamps.
7. Re-run a focused repro only for issues that still look plausible.

## Evidence card template

```markdown
## VIS-001: Main content flashes blank after submit
Severity: High
Time: 21.019s
Scenario: Submit a long form or message
Action: Clicked the primary submit action after entering long content

Evidence:
- Before: keyframes/VIS-001.before.jpg
- During: keyframes/VIS-001.during.jpg
- After: keyframes/VIS-001.after.jpg
- Diff: diffs/VIS-001.diff.jpg
- Clip: clips/VIS-001.mp4

Correlated signals:
- RAF gap: 168 ms
- Long Animation Frame: 142 ms
- Layout shift: 0.23
- Console: Cannot read property 'id' of undefined

Expected:
- Existing content and the active input stay visible while the app processes the submission.

Actual:
- Main content briefly rendered blank for about 200 ms.

Repro:
1. Load the app under test.
2. Navigate to the primary interactive flow.
3. Enter long content.
4. Click the primary submit action.
5. Watch the main content area between 20.9s and 21.2s.
```

## Signal scoring

Initial score formula:

```text
+40 blank/white/black frame
+30 console error within +/- 1s
+25 RAF gap > 100ms or Long Animation Frame > 100ms
+20 long task > 100ms
+20 layout shift > 0.1
+15 failed or slow network request within +/- 2s
+15 OCR sees Error/undefined/NaN/null
+10 user action within previous 1s
-15 inside known allowed animation window
```

Use project-specific invariants and masks to reduce false positives, but do not auto-dismiss route changes, scrolls, or animations until the contact sheet confirms they are expected.
