---
name: ux-review
description: "Review PRs, designs, plans, and product behavior that affect a human user's experience, especially agentic or long-running workflows. Evaluate usability, end-to-end task completion, recovery, visible progress, truthful outcomes, capability boundaries, scope fidelity, meaningful metrics, and channel-appropriate output. Do not use for backend-only changes with no user-visible impact, maintainability-only review, or live exploratory QA."
---

# End-User Experience Review

## Goal

Review the whole path from a user's request or action to its truthful outcome. Reliability comes before polish: once the product accepts work, it completes that work or reaches an honest, persistent, user-actionable boundary. It never silently disappears.

Default to a read-only review. If the user also requests fixes, finish the review first so remediation does not erase the evidence, then rerun affected journeys and acceptance checks before issuing the current verdict.

## Use when

- A PR, design, plan, or implementation changes user-visible behavior.
- An agent, automation, or long-running workflow retries, resumes, reports progress, performs external writes, or reports outcomes.
- The user asks for a UX, product-experience, failure-UX, or end-user-impact review.

## Do not use when

- A backend-only change cannot alter user-visible behavior.
- The request is only a maintainability, security, or visual-polish audit.
- The user wants live exploratory QA through the product; use the dogfood skill instead.

## Scope contract

Start with the promised user outcome, not the implementation.

- **PR or branch:** inspect `git diff <base>...HEAD` from the user-stated base or repository integration branch and the full changed files, then follow only the relevant entrypoint, user-visible states, work lifecycle, side effects and receipts when present, and final result. Expand far enough to prove the journey; do not scan the whole repo.
- **Design or plan:** inspect the stated audience, scope, channel, discoverability, interaction, and applicable happy, working, empty, retry, resumed, awaiting-user, persistent-error, permission, and completed states.
- **Observed behavior:** separate what was reproduced from what is inferred. Use logs, receipts, screenshots, or traces when available.

Write the applicable journey in one line before judging it:

- Task or action: `user intent → admission → visible work → side effect/receipt → truthful outcome`
- Information or navigation: `user goal → discoverable path → interaction → feedback → usable result`

When a real user decision is required, branch through a visible, resumable `awaiting-user` state before the terminal outcome.

Apply only the rubric sections the journey can reach. Do not force retries, receipts, or long-running state onto a surface that has none.

## Review rubric

### 0. Make the path usable

- The intended user can discover the next action, understand the current state and copy, operate the controls, receive timely feedback, recover from mistakes, and recognize the result.
- Review meaningful empty, disabled, loading, error, and completed states when the surface can reach them. Follow native platform conventions and flag obvious accessibility blockers.

### 1. Own the requested outcome

- Treat one admitted request as one obligation until the requested outcome is delivered.
- Review the user's objective, not an intermediate step. “Open a PR” ends with a real PR, even if the work is slow.
- Flag permission ceremony, bare promises, partial completion, abandoned background work, and questions whose answers are discoverable from available context.
- A pause is legitimate when the user must make a real choice or confirm an irreversible, costly, security-sensitive, or privacy-sensitive action. Keep the request, context, and visible state resumable while awaiting them.
- Duration is not a reason to return early. Preserve ownership across queues, workers, retries, restarts, and handoffs.

### 2. Recover without making the user operate the system

- Recover transient network stalls, timeouts, resets, provider blips, and retryable server failures without surfacing an error when the failure class is observed or reproducibly documented and its path is reachable.
- Silence is acceptable only after recovery; otherwise the run remains visible until an explicit outcome.
- Retry, resume, or re-dispatch only from a real failure class with a bounded budget and safe side-effect semantics. Do not recommend a generic retry matrix or timeout zoo without evidence.
- Reconcile before retrying non-idempotent external writes so recovery cannot duplicate the action.

### 3. Use the failure UX hierarchy

Best to worst:

1. silent recovery
2. concise, honest agent- or product-level limitation
3. platform warning when the platform itself needs the user's attention
4. vanished, contradictory, or permanently “working” request

Surface an error only after the recovery budget is exhausted or when the user can act on it now. Keep raw provider details, HTTP codes, stack traces, and internal degradation labels out of normal user copy. Labels such as `degraded_success` belong in observability unless they change the user's next action.

### 4. Keep activity visible and truthful

- Preserve a visible working state throughout long work, retry delays, resume, and re-dispatch.
- Say roughly what is happening in the native vocabulary of the surface without exposing internal machinery.
- Do not clear activity before the final outcome, leave stale activity after completion, or fake progress the system cannot substantiate.

### 5. Reconcile truth before writing copy

- Never report failed when the requested artifact or write exists, done when execution never happened, or verified after mutating or hiding the evidence.
- Reconcile external receipts and final state before choosing success or failure copy.
- Ensure retries and late completions converge on one canonical outcome with no contradictory terminal messages.

### 6. Enforce capability boundaries at the right place

- Apply intentional identity, admission, safety, legal, and product policy at the earliest point with enough information, usually ingress, so acceptance is honest. A runtime security check on newly resolved facts is part of admission, not an implementation excuse.
- Once admitted, own the request until completion or a real security or permission boundary enforced by policy or the destination platform.
- Treat hidden allowlists, arbitrary refusal policy, browser/domain blocks, and implementation-specific gates as defects when evidence shows they are convenience restrictions rather than real security or admission policy.
- If a gate's purpose is uncertain, record an evidence gap and confirm with its owner or security context. Never recommend removing or bypassing a real security or external permission boundary.

### 7. Honor scope and fix proven causes

- Preserve explicit dates, entities, channels, environments, audiences, and requested output shape. A useful answer outside the requested scope is still wrong.
- Prove the failing path is reachable and identify its root cause before proposing recovery behavior.
- Prefer the smallest shared fix and one source of truth. Do not propose a new backend, wholesale rewrite, or speculative failure taxonomy before the current path is reliable and evidence shows the need.

### 8. Measure user outcomes, not internal noise

- Count one admitted request once. Alerts, attempts, retries, worker runs, and callbacks are diagnostic events, not additional user requests.
- Prefer useful completions, persistent failures, external receipts, active users, repeat use, and user acceptance.
- Keep outcome definitions canonical so dashboards cannot count the same request as both success and failure.

### 9. Optimize for the reading surface

- Make the primary result concise, native to the surface, and immediately usable.
- Put detail in an artifact or linked report when the surface is narrow, conversational, or interruptive.
- Flag multi-message walls, raw internals, generic degradation chrome, and summaries that bury the requested result.

This rubric complements, but does not replace, dedicated accessibility, privacy, security, visual-design, and live dogfood reviews. Still flag an obvious blocker introduced in the inspected path.

## Evidence rules

For every finding, identify:

- the reachable user journey or specified state
- the concrete evidence or explicit missing state
- what the user observes
- the smallest fix at the shared cause
- one acceptance check that would fail before the fix

Do not turn hypothetical edge cases into findings. If evidence is missing, ask a focused review question or list the gap instead of inventing evidence or a defect.

## Approval bar

Severity ranks urgency: a blocker breaks completion, truth, scope, or a required boundary; high materially harms the journey; medium is limited but still actionable. Request changes for any material finding. Use `blocked on evidence` only when missing evidence prevents review of the requested journey or could conceal a blocker. Approve only with no material findings and no blocker-sized evidence gap.

Treat these as blockers:

- accepted work can vanish or remain incomplete without an outcome
- final copy can contradict external reality
- the product drops ownership before the requested outcome
- an admitted request hits an arbitrary internal capability refusal
- the implementation violates an explicit scope boundary

Do not approve merely because tests pass, the happy path works, or errors are loud.

## Output contract

Keep the review suitable for the same reading surface you are protecting.

```md
Verdict: [approve | request changes | blocked on evidence]
Journey checked: [goal → interaction/work → feedback/receipt → outcome]

Findings:
- [blocker|high|medium] `path:line` or design surface — [user consequence]. Evidence: [fact]. Smallest fix: [change]. Acceptance: [check].

Evidence gaps: [none or specific gaps]
```

Omit the Findings section when there are none and say `No material UX findings.` When fixes were requested, label pre-fix findings as resolved and keep only current issues under Findings. Do not dump the rubric, praise the design, or pad the review with cosmetic nits.

## Stop rules

Stop when the requested journey and its meaningful interaction, working, recovery, awaiting-user, permission, persistent-error, and terminal states are covered; each finding has evidence and an acceptance check; and untested or unspecified states are explicit. Do not expand into unrelated product strategy or speculative platform work.
