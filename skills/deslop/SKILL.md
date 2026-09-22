---
name: deslop
description: "Remove AI-generated noise from changed branch/PR hunks while preserving behavior: redundant comments, scaffolding, casts, catches, wrappers, and test ceremony. Not feature work, bug triage, broad audits, generated-code cleanup, or repo-wide formatting."
---

# Deslop

Remove noise from the diff with minimal behavior-preserving edits. Keep unrelated user work, non-obvious invariants, security reasoning, and external contracts intact.

## Establish scope

1. Read `git status --short` and inspect uncommitted changes. Treat dirty files as user-owned until proven otherwise.
2. Use the user's comparison base; otherwise prefer `main`, then the repository integration branch. Ask only if choosing the base materially changes the diff.
3. Inspect `git diff <base>...HEAD` for committed changes since divergence, plus the worktree diff. Edit changed hunks only; read surrounding code to understand their behavior and style.

## What to cut

- Comments that repeat code or add off-style AI narration.
- Temporary debug logs, commented-out code, and scaffold leftovers.
- Defensive checks abnormal for a proven trusted internal path.
- Adapters, wrappers, nesting, names, or structure that add noise compared with neighboring code.

### Casts

Delete chained assertions (`x as A as B`) and widen-then-assert patterns (`const x: unknown = known; … x as T`) only when the value already has a precise type or a typed replacement is in the hunk. Exempt `as const`.

After collapsing a laundering pattern, keep a remaining assertion only with a preceding `SAFETY:` or equivalent comment stating the checked invariant. Do not invent a vague comment to justify it. Leave it unchanged if the producer is off-hunk or no compiling replacement exists; do not impose a wider ban on `unknown`, `typeof`, or mocks.

### Catches

Delete catch-and-rethrow with no added context. Delete an intentional swallow only when proven redundant. Keep catches that add context or handle a real I/O, parse, trust, security, or containment boundary. If the purpose is unclear, leave it unchanged.

### Tests

Trace table values to their real boundary and type before simplifying:

- Keep malformed inputs that exercise an external, untyped, or deserialized boundary.
- Remove impossible values only when the real typed internal producer cannot emit them and they enter solely through an impossible mock.
- Keep `it.each`/`describe.each` for multiple meaningful cases sharing behavior. Collapse single-case wrappers and needless nested tables; prefer existing local helpers.

## Verify and finish

Prefer deletion and local-style simplification over rewrites. Recheck the diff for behavior changes, unrelated churn, and remaining noise. Run relevant tests/type checks for code or type edits; comment-only cleanup needs diff inspection.

Stop when the changed hunks are clean or further cleanup would change behavior, expand scope, or require a team/product decision. Report the base, files changed, validation, and any skipped cleanup with its reason.
