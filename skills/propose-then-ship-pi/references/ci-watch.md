# Bounded CI Watching

Read before waiting in Phase 4. `scripts/pr_signals.sh` is read-only and excludes Greptile. It polls all reported non-Greptile signals until one fails or all settle; do not silently replace that selection with GitHub's narrower branch-protection-only checks.

Resolve the script from this skill directory and set `GH_BIN` to the executable verified for the current account policy. Use bounded tool calls:

```typescript
bash({
  command: "GH_BIN=<gh> MAX_WAIT_SECONDS=285 <skill-dir>/scripts/pr_signals.sh <PR>",
  timeout: 300
})
```

The script budget bounds accumulated sleeps; the Bash timeout bounds subprocess wall time too. On exit 2 or tool timeout, continue useful work and resume tool-based monitoring. A timeout is incomplete evidence, not completion. Do not launch an agent solely to wait or collect check results; delegate substantive investigation when useful. Retain ownership until required results are available or a concrete blocker prevents progress.

## Interpret the result

| Exit | Meaning |
| --- | --- |
| `0` | Every reported non-Greptile check succeeded on an open PR |
| `1` | A check failed (reported immediately, even with other checks pending) |
| `2` | Budget expired with checks still running |
| `3` | Setup problem |
| `4` | Missing/unknown signals or PR not open |

Report the exit code and printed head when available; if the tool timed out first, do not invent either. Distinguish timeout from failed or missing checks. Only exit 4 caused by **zero checks** may use `waived-if-absent`, with canonical local validation on that exact head and the recorded waiver. Unknown/empty conclusions are not green; a closed PR is not an absence waiver. Investigate failures when observed rather than waiting for unrelated pending checks.

Run bundled `scripts/test_pr_signals.sh` after helper edits. Script success proves checks, not review, UX, merge, deployment, or cleanup.
