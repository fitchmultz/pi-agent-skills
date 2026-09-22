# Review Panel

Use local reviewers when explicitly required or when their independent analysis can save time or improve quality. The implementing agent owns integration, fixes, verification, and delivery. Reviewers inspect and report without editing product code.

## Select the reviewers

Complete every explicitly requested review. Otherwise choose distinct review roles for the actual change; there is no mandatory four-reviewer panel.

| Reviewer | Purpose |
| --- | --- |
| `reviewer-gpt` | Correctness, maintainability, and meaningful verification. |
| `reviewer-ponytail` | Unnecessary complexity, preserving the complete intended behavior. |
| `reviewer-security` | Relevant authentication, authorization, secrets, injection, or data-exposure concerns. |
| `reviewer-claude` | Optional second-provider review when deliberately selected. |

Follow the user's model policy and standing review requirements. Claude is not automatically included whenever another reviewer runs. A registry category does not add reviewers to the task. Run deslop and verification in the parent; use the bundled UX review for changes that affect people.

Confirm the effective agent registry before launching. If an explicitly required reviewer is unavailable, report that specific missing review and continue independent authorized work; do not silently substitute or skip it.

## Run the reviews

1. Give each reviewer a clear task, the exact source revision or an identified snapshot, and the relevant owner decisions.
2. Launch reviewers separately and asynchronously so each result can wake the parent. Continue useful independent work; use ordinary tools for routine monitoring and let completion notifications resume the work when waiting is necessary.
3. Keep the reviewed source stable while a reviewer inspects it. Use isolated worktrees or snapshots when implementation must continue concurrently.
4. Inspect each result as it arrives and address confirmed failures immediately.

An expired reviewer process has not completed a required review. Resume, rerun, or split that review to obtain its findings. Do not present a timeout as a passing verdict.

## Changes and rebuttals

- Judge findings against the approved outcome, reachable behavior, and concrete evidence. Fix valid in-scope defects.
- The owning agent may resolve an incorrect, out-of-scope, or approved-behavior-conflicting finding with an evidence-backed rebuttal. The originating reviewer's agreement is not required. A follow-up ticket alone does not replace the reasoning.
- Repeat reviews when changed code, failures, a concrete unresolved concern, or an explicit user requirement warrants them. Select the reviewers whose previous analysis was affected.
- Re-review changes to security-sensitive behavior with the relevant security review. A rebuttal or informational risk note alone does not require another review.
- Reuse still-applicable review results after mechanical base synchronization that leaves the reviewed behavior unchanged. Verify the final combined code and required CI rather than restarting every reviewer because a commit identifier changed.
- For new scope or a combined stack, review the resulting behavior and interactions with appropriate reviewers; do not automatically add every available reviewer.

Preserve actual repository checks and human approval requirements. An agent rebuttal does not fabricate a passing check or authorize bypassing repository protections.

## Reviewer brief

Include the task, approved outcome and non-goals, original owner instructions or source pointers, worktree, base and reviewed revision, PR link when present, relevant changes since earlier reviews, and why this reviewer is useful or required. Carry forward accepted tradeoffs, waivers, and earlier findings with their resolutions.

Provide inspectable validation evidence with enough code and environment context to establish whether it still applies. Reviewers can reuse valid checks and run missing or invalidated ones. Their review must independently assess the change; earlier findings and summaries are inputs to verify.

Use the tools actually available to each helper. Provide parent-only information in the brief. Helpers with delegation enabled may divide substantive review work within the same read-only scope; the original agent remains responsible for the complete result. Write readable messages with normal spacing.

## Optional Claude review

When using `reviewer-claude`, provide the thermo-nuclear rubric's labeled sections: `### Git / diff output`, `### Changed file contents`, and relevant `### Targeted context`. Include the recorded owner decisions so a second-provider review evaluates the same intended behavior.

## Completion

The requested review coverage is complete when the required reviewers have performed their reviews and the owning agent has resolved actionable findings through fixes or evidence-backed rebuttals. Record material findings and resolutions in the PR or work record. Keep the user update focused on the outcome, relevant verification, and any remaining blocker.
