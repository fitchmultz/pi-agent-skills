---
name: thermo-nuclear-code-quality-review
description: "Read-only deep maintainability review of branch/PR changes: structural simplification, 1k-line growth, tangled branching, abstractions, types, and boundaries. Not whole-repo audits, quick nits, security-only review, bug triage, or implementation."
---

# Thermo-Nuclear Code Quality Review

Deliver a demanding, evidence-backed structural review. Keep the review phase read-only: findings, sign-off, and remediation guidance. If the user also requested fixes, finish the findings first, then continue authorized remediation as a separate implementation step without asking again. Review-only requests and delegated read-only assignments remain read-only.

Read `references/review-rubric.md` completely and apply every section. It defines the review questions, code-judo/1k-line/spaghetti standards, presumptive blockers, remedies, and output order.

## Scope

The diff is the seed, not the boundary. Never scan the whole repo.

1. Use the user's review target and base; otherwise inspect `git diff <base>...HEAD` with base `main`. Check `git status --short` and include staged/unstaged changes when they are part of the requested review. Read full changed files and use `wc -l` for the 1k-line rule. Ask about the target only if discovery leaves a materially different scope unresolved.
2. Expand one hop at a time to answer a specific rubric question:
   - Changed export or signature: search its callers and read call sites.
   - Unfamiliar call: read the definition.
   - Suspected duplicate: search shared/util layers by name or keyword and read hits.
   - Boundary question: list the module and skim neighboring interfaces, not whole bodies.
3. Stop expansion when the question is answered, a hop yields no new evidence, or two hops from the changed symbol are reached. Raise broader concerns as questions with the evidence gathered; do not start a repo audit.

## Review and report

Review inline by default; no subagent capability is required. Delegate substantive work when it saves time or improves quality and the harness supports it, using `agents/subagent.md` for the bounded read-only brief. Give helpers explicit scope, evidence, and a findings contract. Nested delegation must be permitted by the harness; the original agent owns integration and delivery.

For each meaningful change, apply the rubric and prioritize structural regressions and missed simplification over cosmetic notes. Cite path/line or changed-hunk evidence, explain the structural impact, and recommend a remedy. Prefer a few high-conviction findings.

Approve only with no clear structural regression, obvious missed simplification, unjustified 1k+ growth, spaghetti, obscuring wrappers/casts, boundary leaks, canonical-helper duplication, or missed decomposition. Passing tests or preserving behavior alone is insufficient. Justify any presumptive blocker that does not block approval.

Follow the user's report format while retaining the rubric's priorities. Name the inspected scope and material evidence gaps; do not equate unavailable context with a clean sign-off. Finish the review phase when high-priority findings and remedies are documented or the inspected scope has no material findings. Do not pad the review with nits.
