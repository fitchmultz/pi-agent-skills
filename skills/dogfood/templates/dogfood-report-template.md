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

## Artifact Hygiene

| Item | Status |
|------|--------|
| Artifact directory | `.dogfood/` |
| `.gitignore` includes `.dogfood/` | yes / no / blocked: {reason} |
| Prior artifacts pruned | none / {summary} |

## Confidence

| Claim | Level | Evidence / reason |
|-------|-------|-------------------|
| Steady-state layout | high / medium / low | {screenshots/rendered states inspected} |
| Motion / streaming behavior | high / medium / low / N/A | {video/frame sequence/contact sheet inspected, or only screenshots inspected} |

## Findings

<!-- Copy this block for each issue. Interactive/timing issues need video or step screenshots. Static visible issues can use one annotated screenshot and Repro Video: N/A. -->

### ISSUE-001: {Severity} — {Short title}

| Field | Value |
|-------|-------|
| Severity | critical / high / medium / low |
| Category | visual / functional / ux / content / performance / console / accessibility |
| URL | {page URL} |
| Viewport | {viewport} |
| Auth state | {auth state} |
| Evidence | {primary screenshot/log/video path} |
| Repro Video | {path, or N/A} |

**Expected**

{What should happen.}

**Actual**

{What happened.}

**Repro Steps**

1. Navigate to {URL}.
2. {Action}.
3. Observe {failure}.

**Notes / Likely Area**

{Optional notes, correlated console/network errors, or likely owning area.}

---

## Untested / Blocked

| Area | Reason |
|------|--------|
| {area} | {reason} |
