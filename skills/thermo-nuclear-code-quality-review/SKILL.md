---
name: thermo-nuclear-code-quality-review
description: "Strict maintainability review for branch/PR diffs: thermonuclear/deep code quality, code-judo simplification, 1k-line growth, spaghetti conditionals, abstraction/type/boundary debt. Do not use for whole-repo audits, ponytail-only reviews, quick nits, security-only reviews, LGTM, or bug triage."
---

# Thermo-Nuclear Code Quality Review

## Goal

Deliver a demanding maintainability review that pushes for structural simplification without changing intended behavior.

## Success criteria

- Branch diff audited against the full rubric in `references/review-rubric.md`.
- Review stays read-only: findings and sign-off only, no file edits through this skill.
- Context scoped to the diff's blast radius: no whole-repo scan, no diff-only tunnel vision.
- Findings cite concrete path/line or changed-hunk evidence, structural impact, and preferred remediation.
- Findings prioritized: structural regressions and missed simplification first.
- Approval withheld when presumptive blockers apply unless clearly justified.
- Few high-conviction comments over cosmetic nit floods.

## Use when

- User wants thermo-nuclear / thermonuclear / deep maintainability review.
- PR needs harsh scrutiny on structure, file size, and abstraction—not just correctness.

## When not to use

- Quick style pass or typo hunt.
- Security-only or incident triage without maintainability scope.
- Rubber-stamp "LGTM" requests.

## Workflow

1. Read `references/review-rubric.md` completely before reviewing.
2. Gather context per the scope contract below.
3. For each meaningful change, run the primary review questions in the rubric.
4. Flag presumptive blockers explicitly; propose preferred remedies from the rubric.
5. Order output per output expectations in the rubric. If fixes are requested, return the review and recommended remediation path rather than editing files.

## Scope contract

The diff is the seed, not the boundary. Never scan the whole repo.

1. **Seed (always):** `git diff <base>...HEAD` (triple-dot diffs from the merge-base; default base `main`), full contents of changed files, and `wc -l` on changed files for the 1k-line rule.
2. **Expand one hop at a time, only to answer a specific rubric question:**
   - Changed/new exported symbol or signature: `rg` its callers; read only the call sites.
   - Diff calls something unfamiliar: read that definition.
   - Suspected duplicate of a canonical helper: search shared/util layers by name or keyword; read only the hits.
   - Boundary/layer question: list the surrounding module and skim neighbor interfaces, not full bodies.
3. **Stop expanding** when the question is answered, when a hop yields no new evidence, or at two hops from a changed symbol. If a concern truly needs repo-wide evidence, raise it as a question to the author with what you did verify; do not go scan for it.

Whole-repo health is a codebase audit, not this review.

## Harness notes

- **Default everywhere:** gather scoped context per the scope contract, read `references/review-rubric.md`, review inline in the parent session.
- **Optional delegation:** see `agents/subagent.md` when the harness supports subagents (Cursor Task, pi sub-session, etc.).

## Approval bar

Do not approve on behavior alone. Approve only when:

- no clear structural regression
- no obvious missed code-judo simplification
- no unjustified 1k+ file growth
- no obvious spaghetti from special-case branching
- no magic/wrapper/cast churn obscuring design
- no boundary leak or canonical-helper duplication
- no missed obvious decomposition

Otherwise leave actionable feedback and request restructuring.

## Stop rules

Stop when high-priority findings are documented with clear remediation paths, or when the inspected scope has no material thermo-nuclear findings. Do not drown the author in low-value nits if structural issues remain.

## Anti-patterns

- Mild suggestions for major structural debt.
- Approving because tests pass.
- Long lists of cosmetic notes while missing 1k-line or spaghetti regressions.
