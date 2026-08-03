---
name: dogfood
description: "Dogfood or exploratory-QA browser-visible products through real user flows: web apps, local URLs, visual bug hunts, jank/flicker/streaming, and terminal/TUI redraw via VFR. Do not use for backend/unit-test-only checks, code review, trivial visual tweaks, or fixing bugs unless asked."
compatibility: "Requires a live browser automation surface. Optional VFR scripts use Python 3; video analysis also requires OpenCV, numpy, and Pillow."
---

# Dogfood

## Goal

Explore a web app or browser-visible TUI like a real user, find meaningful issues, and produce reproducible evidence. This is serious exploratory QA, not code review or automated-test-only validation.

## Success criteria

- Main and high-risk flows in scope were exercised through the UI.
- Findings are user-impactful, severity-ranked, and reproducible.
- Every finding has steps, expected vs actual behavior, environment, and evidence paths under the project `.dogfood/` directory.
- Console, page errors, failed network requests, accessibility basics, responsive behavior, and important state changes were checked when relevant.
- The project `.gitignore` ignores `.dogfood/`, and stale irrelevant dogfood artifacts were pruned or explicitly kept with a reason.
- Untested areas and blockers are explicit.

## Inputs and defaults

Only the target URL/app is required. Use defaults unless the user overrides them.

| Parameter | Default |
|---|---|
| Target URL | required; discover local URL if asked to start the app |
| Session name | slugified target/domain |
| Output dir | project-root `./.dogfood/` |
| Scope | full app, with user-specified focus first |
| Auth | none unless credentials/profile/session are provided |

If auth is required but credentials/session are missing, stop and ask for that blocker only.

## Browser/tool rules

- Use the current harness's native browser tool first. In pi, use `agent_browser`; do not shell out for browser actions unless the user requested a shell workflow.
- In CLI-only contexts, use the installed `agent-browser` binary directly, never `npx agent-browser`.
- If command behavior matters, verify with version-matched help or `agent-browser skills get core`; do not guess stale flags.
- Use the current snapshot/ref model: open or navigate, snapshot (`snapshot -i` for controls), act on visible refs/selectors, then re-snapshot or screenshot after navigation, scrolling, rerender, or state changes.
- Save generated dogfood artifacts only under the target project's `.dogfood/` directory. Ensure `.dogfood/` is listed in the project `.gitignore` before generating artifacts; create/update `.gitignore` when safe, or report the blocker.
- When image artifacts exist, actually inspect representative screenshots, contact sheets, and anomaly frames with an image-capable tool before claiming visual quality. Deterministic gates are helpers, not proof, until calibrated against viewed frames.
- Do not use target app source code as evidence. Findings must come from browser-observed behavior.
- Do not cross irreversible purchase/order/delete/submit boundaries unless the user explicitly permits it.

## Workflow

1. **Initialize**
   - Clarify only missing target, auth, hard stop boundaries, or materially ambiguous scope.
   - Resolve the target project root with `git rev-parse --show-toplevel` when available, otherwise use the current working directory.
   - Ensure `<project-root>/.gitignore` contains `.dogfood/` before artifacts are created.
   - Create `.dogfood/` subdirs for screenshots, videos/logs, and report.
   - Prune only clearly stale, irrelevant prior dogfood artifacts inside `.dogfood/`; never delete evidence still referenced by an active report, issue, handoff, or user request.
   - Record target URL, viewport(s), browser/session, auth state, assumptions, and any artifact pruning.

2. **Start/authenticate**
   - Start the local app if requested, using the project's normal command and a cleanup-safe process handle.
   - Sign in only with provided credentials/profile/session.
   - Capture an initial snapshot and screenshot.

3. **Orient**
   - Identify top-level navigation, core user journeys, high-risk forms/actions, empty/loading/error states, settings/account areas, and responsive breakpoints.
   - Read `references/issue-taxonomy.md` only when severity/category calibration is needed.

4. **Explore like a user**
   - Exercise meaningful flows end-to-end before peripheral polish.
   - Check interactive controls, forms, navigation, search/filtering, persistence, auth boundaries, loading/error/empty states, keyboard/focus basics, and responsive layout.
   - Check console, page errors, and failed network requests periodically and after suspicious actions.
   - Prefer high-impact blockers and confusing UX over cosmetic nits.

5. **Document findings immediately**
   - Stop when a possible issue appears; retry once when safe to confirm reproducibility.
   - For interactive/timing issues, capture step screenshots and video when available.
   - For static visible issues, one annotated screenshot is enough.
   - Add severity, category, URL, viewport, auth state, repro steps, expected, actual, evidence path, and notes/likely area.

6. **Wrap up**
   - Reconcile report counts with issue blocks.
   - Summarize coverage, severity counts, top findings, blockers, untested areas, artifact directory, `.gitignore` status, and any pruned stale artifacts.
   - Close browser sessions and app processes started for the run unless intentionally handing them back.

## Visual Flight Recorder mode

Use VFR mode when the user asks for jank, flicker, streaming, animation, loading, terminal/TUI redraw issues, or other transient bugs, or when static screenshots cannot capture an observed issue.

VFR evidence is motion-first. Static screenshots are supporting evidence, not proof, for streaming, jank, flicker, animation, loading, or terminal/TUI redraw claims. If you only inspect final screenshots, state that confidence covers steady-state rendering only. Motion/streaming claims require actual inspection of captured frames (render-check/final screenshots, contact sheets, top anomaly cards when present) with an image-capable tool; deterministic gates alone are not proof.

Read `references/vfr/workflow.md` only when running VFR mode (helpers, init, capture, analyze, validate, review-note). Read `references/vfr/terminal-tui.md` before terminal/TUI capture. Prefer `vfr.py terminal-start` + `agent_browser` recording for terminals; a project-specific screenshot smoke is steady-state only unless a video/frame sequence was also captured.

## Available scripts

VFR helpers: `scripts/vfr.py`, `scripts/analyze-video.py`. Full usage is in `references/vfr/workflow.md` and `references/vfr/terminal-tui.md`.

## Report format

Use `templates/dogfood-report-template.md` for larger reports. Minimum report shape:

```md
# Dogfood Report

Target: URL/app
Scope: tested focus and important exclusions
Environment: browser/session, viewport(s), auth state

## Summary
- Critical: N
- High: N
- Medium: N
- Low: N

## Coverage
- Flow/state checked: evidence

## Findings
### Severity — Title
- Repro steps:
- Expected:
- Actual:
- Evidence:
- Notes / likely area:

## Untested / Blocked
- Area: reason

## Confidence
- Steady-state layout: high|medium|low — why
- Motion/streaming behavior: high|medium|low — video/frame evidence inspected, or only screenshots inspected
```

## Stop rules

Stop when main and high-risk flows in scope have been exercised, every finding has reproducible evidence, and blockers/untested areas are explicit. Continue only when an untested path could hide a high-impact issue in the requested scope.
