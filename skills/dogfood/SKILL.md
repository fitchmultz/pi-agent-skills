---
name: dogfood
description: "Dogfood or exploratory-QA browser-visible products through real user flows: web apps, local URLs, visual bug hunts, jank/flicker/streaming, and terminal/TUI redraw via VFR. Do not use for backend/unit-test-only checks, code review, trivial visual tweaks, or fixing bugs unless asked."
compatibility: "Requires separately installed agent_browser tools and an image-capable read tool. Cloudflare work uses configured cloudflare_api_docs/search/execute. Motion capture needs Python 3.9+ and FFmpeg 5.1+ on Pi's PATH; terminal capture needs ttyd; optional deep analysis uses uv."
---

# Dogfood

## Goal

Explore a browser-visible product like a real user, find meaningful issues, and produce evidence the agent can inspect without asking the user to be its eyes.

## Success criteria

- Requested flows and high-risk paths within scope were exercised through the UI.
- Findings are user-impactful, severity-ranked, and reproducible.
- Every finding has steps, expected vs actual behavior, environment, and evidence paths.
- The agent opened representative screenshots itself with an image-capable tool before making visual claims.
- Motion claims are backed by a verified video plus agent-inspected contact sheets or focused frames, not final screenshots alone.
- Console, page errors, failed requests, accessibility basics, responsive behavior, and important state changes were checked when relevant.
- No recording, browser session, terminal helper, or app process started by the run was left active.
- Untested areas and blockers are explicit.

## Inputs and defaults

Only the target URL/app is required. Discover a local URL when the user asks to start the app. Focus on user-specified flows and high-risk paths within the requested scope. Use authenticated access covered by current or standing authorization; ask only when authentication actually requires the user's presence. Preserve caller-owned sessions.

Honor requested evidence paths. Otherwise use a unique project-root `.dogfood/` run when that directory is ignored or the task permits updating `.gitignore`. If artifacts are permitted but tracked-file edits are not, use a unique directory outside the checkout and report its path. Never delete or overwrite evidence from an earlier run unless explicitly authorized.

## Tool and safety rules

- Never use `agent_browser` for Cloudflare's control plane, dashboard, documentation, APIs, or product properties. Use `cloudflare_api_docs` for documentation, `cloudflare_api_search` for endpoint discovery, and `cloudflare_api_execute` for authorized authenticated operations. Keep exploratory QA read-only; use a mutating API operation only with explicit user authorization and when broader production-control policy permits it. If those tools are unavailable, or the request needs dashboard-only visual QA, report the Cloudflare work as unavailable instead of falling back to a browser.
- This guard does not apply when the target is customer code merely hosted by Cloudflare, including a customer app on its own domain or a `*.pages.dev` or `*.workers.dev` preview. Use the normal browser workflow directly against that app. Treat any flow that requires completing a Cloudflare Access, managed or bot challenge, or Turnstile interaction as a Cloudflare product property regardless of its domain. If the app redirects to one, stop and report that path as unavailable unless a caller-owned authenticated session opens directly to the app. An embedded Turnstile widget does not by itself block QA of the surrounding customer app, but do not interact with it; if it blocks the requested flow, report that path as unavailable unless a caller-owned authenticated session opens directly to the customer app after the challenge.
- Use the separately installed `agent_browser` tool for permitted browser actions. It is not a built-in Pi capability on either official Pi or forks. If unavailable, report that prerequisite; never shell out to `agent-browser` as a substitute.
- Use `open` → `snapshot -i` → visible refs or semantic actions → fresh snapshot after navigation, scrolling, or rerender.
- Use absolute paths at the evidence location selected above.
- Treat artifact paths as provisional until `details.artifactVerification` confirms them. Prefer exact `details.nextActions` payloads over guessed recovery commands.
- The agent is the visual reviewer. Open generated screenshots, contact sheets, and anomaly frames with `read`; do not ask the user to interpret them.
- Do not use target source code as evidence for a browser finding.
- Do not cross irreversible purchase, order, delete, post, or submit boundaries without applicable explicit permission. Honor existing standing authorization and explicit holds; a skill supplies neither new permission nor an exception.

## Session ownership

Use a fresh managed browser session for a capture run unless the user supplied an authenticated session that must be reused. Only close sessions created by this run. If reusing a caller-owned session, stop the recording and leave the session open.

Every recording start must have one successful recording stop before close. Never call `record start` again while a recording is active, and do not use `record restart` as recovery from a failed stop. A recording dependency warning is a blocker, not informational output.

## Workflow

1. **Initialize**
   - Resolve the project root with `git rev-parse --show-toplevel` when available.
   - Use a new run directory at the selected evidence location. Record target, viewport, browser/session, auth state, and scope.
   - Start the app only with its normal command and a cleanup-safe process handle.

2. **Orient**
   - Open the target, capture an initial screenshot, and inspect it.
   - Identify primary journeys, risky forms/actions, loading/error/empty states, settings/account areas, and responsive breakpoints.
   - Read `references/issue-taxonomy.md` only when severity calibration is unclear.

3. **Explore**
   - Exercise meaningful flows end to end before peripheral polish.
   - Check controls, forms, navigation, persistence, auth boundaries, keyboard/focus basics, responsive layout, and state transitions.
   - Check console, page errors, and failed requests after suspicious actions.

4. **Capture findings immediately**
   - Retry a possible issue once when safe.
   - One inspected screenshot is enough for a static issue.
   - Use Visual Flight Recorder mode for flicker, streaming, animation, loading, redraw, or other transient behavior.

5. **Report and clean up**
   - If writing a report file, use the user's requested path without relocating it under the screenshot/video run directory.
   - Reconcile finding counts, coverage, blockers, and untested areas.
   - Name the exact visual artifacts the agent opened.
   - Stop recording before closing a run-owned session. Stop app and terminal processes started by the run.

## Visual Flight Recorder mode

Use VFR when the user asks about jank, flicker, streaming, animation, loading, first paint, terminal/TUI redraw, or when a static screenshot cannot prove the behavior.

Before recording, read `references/vfr/workflow.md` and follow its single native lifecycle. The short contract is:

1. ffmpeg preflight succeeds before `record start`.
2. Record one focused flow to an absolute path in a run-owned session.
3. `record stop` returns success and fully verified artifact metadata.
4. Close the run-owned browser immediately after verified stop; leave caller-owned sessions open.
5. Generate contact sheets, then open every sheet and the render-check/final screenshots with `read`.
6. Run deep anomaly analysis only for suspected transient defects or when explicitly requested.

Read `references/vfr/terminal-tui.md` before terminal/TUI capture. The same verification and self-inspection contract applies.

If ffmpeg is unavailable, do not start recording. Continue with inspected screenshots only and state that motion confidence is low; do not imply that steady-state evidence proves flicker or streaming quality.

## Report format

Use `templates/dogfood-report-template.md` for larger passes. Use colons instead of em or en dashes as prose separators; preserve hyphens required by identifiers, paths, CLI flags, and Markdown structure. At minimum include target, scope, environment, coverage, findings, exact evidence paths, untested areas, and separate confidence for steady-state layout versus motion/streaming behavior.

## Stop rules

Stop when the requested QA scope is covered, each finding is reproducible, visual claims are backed by artifacts the agent actually opened, and blockers/untested areas are explicit. Continue for remaining requested coverage or evidence needed to substantiate a finding.
