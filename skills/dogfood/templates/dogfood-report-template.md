# Dogfood Report: {APP_NAME}

| Field | Value |
|-------|-------|
| Date | {DATE} |
| Target | {URL} |
| Session | {SESSION_NAME} |
| Scope | {SCOPE} |
| Environment | {BROWSER}, {VIEWPORTS}, auth: {AUTH_STATE} |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

## Coverage

| Flow / State | Evidence | Notes |
|--------------|----------|-------|
| {flow} | {screenshot/log/video path} | {notes} |

## Visual evidence inspected by the agent

| Artifact | What was checked |
|----------|------------------|
| {exact image path} | {layout, transition, flicker, loading, redraw, etc.} |

## Artifact hygiene

| Item | Status |
|------|--------|
| Artifact directory | `.dogfood/runs/{RUN}` |
| `.gitignore` includes `.dogfood/` | yes / no / blocked: {reason} |
| Existing evidence deleted | no / user-authorized: {summary} |
| Recording stopped and verified | yes / no / N/A: {reason} |
| Run-owned browser/app/terminal processes stopped | yes / no / N/A: {reason} |

## Confidence

| Claim | Level | Evidence / reason |
|-------|-------|-------------------|
| Steady-state layout | high / medium / low | {exact screenshots opened} |
| Motion / streaming behavior | high / medium / low / N/A | {verified video and exact contact sheets/frames opened, or limitation} |

## Findings

<!-- Copy this block for each issue. Static issues need one inspected screenshot. Transient issues need verified video plus inspected frame evidence. -->

### ISSUE-001: {Severity} — {Short title}

| Field | Value |
|-------|-------|
| Severity | critical / high / medium / low |
| Category | visual / functional / ux / content / performance / console / accessibility |
| URL | {page URL} |
| Viewport | {viewport} |
| Auth state | {auth state} |
| Evidence | {primary inspected screenshot/frame path} |
| Repro video | {verified path, or N/A} |

**Expected**

{What should happen.}

**Actual**

{What happened.}

**Repro Steps**

1. Navigate to {URL}.
2. {Action}.
3. Observe {failure}.

**Notes / Correlated Signals**

{Optional console/network/performance evidence or likely owning area.}

---

## Untested / Blocked

| Area | Reason |
|------|--------|
| {area} | {reason} |
