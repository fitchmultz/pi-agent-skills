---
name: deslop
description: "Clean AI-generated slop from branch/PR diffs while preserving behavior: noisy comments, debug/scaffold leftovers, odd defensive checks, casts, needless wrappers/nesting, test-table ceremony, and changed-hunk style mismatch. Do not use for features, bug triage, broad audits, generated-code cleanup, or repo-wide formatting."
---

# Deslop

## Goal

Remove AI-generated noise from a branch or PR diff without changing intended behavior.

## Success criteria

- The comparison base is known: user-stated base first, else the repo integration branch such as `main` or `master`.
- Pre-existing user changes are identified and preserved unless explicitly in scope.
- Only changed hunks in the branch/worktree diff were edited.
- Slop patterns were removed with minimal, focused edits.
- Behavior is unchanged unless the user separately asked for a bug fix.
- Final summary is concise and names validation performed.

## Use when

- The user asks to deslop, remove AI artifacts, clean a noisy diff, or make a PR less obviously AI-written.
- A branch/PR diff shows comment bloat, temporary debug/scaffold leftovers, spurious try/catch, type-silencing casts, needless wrappers, or nesting that local style would simplify.

## Do not use when

- The user asks for intentional behavior changes, feature work, or root-cause bug fixing.
- The task is a broad maintainability/code-quality audit rather than cleanup of changed hunks.
- The request is repo-wide formatting, generated-code cleanup, lint autofix, or style migration unrelated to the branch diff.
- A local style disagreement would require a team decision.

## Workflow

1. Inspect state before editing: `git status --short` for uncommitted edits, plus `git diff <base>...HEAD` (three-dot: branch changes since divergence, not base movement) for committed branch work. Treat dirty files as user-owned until proven otherwise.
2. If the base is not stated, prefer `main`; if absent, infer the integration branch from repo context or ask only if the choice changes the diff materially.
3. Scan changed hunks only for:
   - comments that repeat the code or use off-style AI narration
   - temporary debug logs, commented-out code, or leftover scaffolding
   - defensive checks abnormal for trusted internal paths
   - `any`/type assertions used only to silence errors instead of matching local types
   - needless adapters, wrappers, conditionals, or nesting that neighbors avoid
   - nested or table-driven test ceremony where a plain test or an existing repo helper is clearer
   - names, structure, or error handling inconsistent with the surrounding file
4. Before simplifying parameterized tests, trace each value to its real boundary and type:
   - keep malformed-value cases for external, untyped, or deserialized input when they prove a real boundary
   - remove values the real typed internal producer cannot emit and that reach the code only through an impossible mock
   - use `it.each`/`describe.each` only when multiple meaningful cases share behavior; collapse wrappers that only rerun one test
   - prefer an existing local test helper over a hand-rolled nested table
5. Apply the smallest behavior-preserving edit. Check nearby code first; prefer deletion and local-style simplification over rewrites.
6. Re-check the diff for unrelated churn, accidental behavior changes, and remaining slop.
7. Run relevant tests/type checks when code behavior or types were touched; for comment-only cleanup, diff inspection is enough.

## Stop rules

Stop when changed hunks are clean, or when further cleanup would alter behavior, expand scope, or require a style/product decision.

## Output contract

Report the base inspected, files changed, validation run, and any skipped cleanup with the reason.

## Anti-patterns

- Behavior changes disguised as cleanup.
- Broad rewrites instead of focused deslop.
- Removing comments that document non-obvious invariants, security reasoning, or external contracts.
- Deleting malformed-input coverage from a real trust boundary because downstream types look narrower.
- Parameterizing typed internal seams with values they cannot produce just to appear defensive.
- Touching unrelated user changes just because they are nearby.
