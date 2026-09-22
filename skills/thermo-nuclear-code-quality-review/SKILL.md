---
name: thermo-nuclear-code-quality-review
description: "Read-only deep maintainability review of branch/PR changes: structural simplification, 1k-line growth, tangled branching, abstractions, types, and boundaries. Not whole-repo audits, quick nits, security-only review, bug triage, or implementation."
---

# Thermo-Nuclear Code Quality Review

Deliver a demanding, evidence-backed structural review. Stay read-only: findings, sign-off, and remediation guidance only, even when fixes are also requested. Implementation is a separate step.

Read `references/review-rubric.md` completely and apply every section. It defines the review questions, code-judo/1k-line/spaghetti standards, presumptive blockers, remedies, and output order.

## Scope

The diff is the seed, not the boundary. Never scan the whole repo.

1. Inspect `git diff <base>...HEAD` (default base `main`), full changed files, and `wc -l` on changed files for the 1k-line rule.
2. Expand one hop at a time to answer a specific rubric question:
   - Changed export or signature: search its callers and read call sites.
   - Unfamiliar call: read the definition.
   - Suspected duplicate: search shared/util layers by name or keyword and read hits.
   - Boundary question: list the module and skim neighboring interfaces, not whole bodies.
3. Stop expansion when the question is answered, a hop yields no new evidence, or two hops from the changed symbol are reached. Raise broader concerns as questions with the evidence gathered; do not start a repo audit.

## Review and report

Review inline by default; no subagent capability is required. Delegate substantive work when it saves time or improves quality and the harness supports it, using `agents/subagent.md` for the bounded read-only brief. Helpers may divide their assigned work; the original agent owns integration and delivery.

For each meaningful change, apply the rubric and prioritize structural regressions and missed simplification over cosmetic notes. Cite path/line or changed-hunk evidence, explain the structural impact, and recommend a remedy. Prefer a few high-conviction findings.

Approve only with no clear structural regression, obvious missed simplification, unjustified 1k+ growth, spaghetti, obscuring wrappers/casts, boundary leaks, canonical-helper duplication, or missed decomposition. Passing tests or preserving behavior alone is insufficient. Justify any presumptive blocker that does not block approval.

Stop when high-priority findings and remedies are documented or the inspected scope has no material findings. Do not pad the review with nits.
