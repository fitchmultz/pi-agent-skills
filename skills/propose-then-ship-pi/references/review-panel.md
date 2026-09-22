# Review Panel

Use local reviewers when explicitly required or when their independent analysis saves time or improves quality. The implementing agent owns integration, fixes, verification, and delivery. Reviewers inspect and report without editing product code.

## Select the reviewers

Complete every explicitly requested review. Otherwise choose distinct roles for the actual change; there is no mandatory four-reviewer panel or fresh opt-in requirement.

| Reviewer | Purpose |
| --- | --- |
| `reviewer-gpt` | Correctness, maintainability, and meaningful verification. |
| `reviewer-ponytail` | Unnecessary complexity, preserving the complete intended behavior. |
| `reviewer-security` | Relevant authentication, authorization, secrets, injection, or data-exposure concerns. |
| `reviewer-claude` | Optional second-provider review when deliberately selected. |

Follow current model policy and standing review requirements. Mitch's roles use Astra except for the optional Claude review; do not hard-code model IDs or add reviewers from a registry category alone. Run deslop and verification in the parent; use the bundled UX review for changes affecting people.

Discover available delegation tools first. Prefer `agent_runs({ action: "profiles" })` for effective profiles and `delegate` for a single review; use `load_subagent` only for advanced controls the light tools lack. If only the advanced tool exists, list with `subagent({ action: "list" })`. If an explicitly required reviewer is unavailable, report that missing review and continue independent authorized work; do not silently substitute or skip it.

## Run the reviews

1. Give each reviewer a clear task, exact revision or identified snapshot, and relevant owner decisions. Pass absolute worktree `cwd`; do not rely on `change_dir` to supply it.
2. Launch reviewers separately and asynchronously so each result can wake the parent. Continue useful independent work; use ordinary tools for routine monitoring and completion notifications when waiting is necessary.
3. Keep reviewed source stable. Use isolated worktrees or snapshots if implementation must continue concurrently.
4. Inspect each result as it arrives and address confirmed failures immediately.

An expired reviewer process has not completed a required review. Resume, rerun, or split it to obtain findings; never present timeout as a passing verdict.

## Changes and rebuttals

- Judge findings against the approved outcome, reachable behavior, and concrete evidence. Fix valid in-scope defects.
- The owning agent may clear incorrect, out-of-scope, or approved-behavior-conflicting findings with an evidence-backed rebuttal. Originating reviewer agreement is not required; a follow-up ticket alone is not reasoning.
- Repeat reviews for changed code, failures, concrete unresolved concerns, or explicit requirements. Select reviewers whose analysis was affected.
- Refresh relevant security review when security-sensitive behavior changes. A rebuttal or informational risk note alone does not require another review.
- Mechanical base synchronization with unchanged reviewed behavior does not restart reviews. Verify combined code and current CI; for new scope or combined stacks, review the resulting behavior/interactions with appropriate roles.

Preserve actual repository checks, human approvals, and unresolved valid security findings. An agent rebuttal neither fabricates a passing check nor permits bypassing repository protections.

## Reviewer brief

Include the task, approved outcome/non-goals, original owner instructions or pointers, absolute worktree, base/revision, PR link, relevant changes since prior reviews, and why the reviewer is useful or required. Carry forward accepted tradeoffs, waivers, and findings with their resolutions.

Provide inspectable validation with sufficient code/environment context for reuse. Reviewers run missing/invalidated checks and independently assess the change; earlier findings and summaries are inputs to verify.

Use tools actually available to each helper and supply parent-only information in the brief. Helpers with delegation enabled may split substantive review within the read-only scope; the original agent still owns the complete result. Write readable messages with normal spacing.

For optional `reviewer-claude`, provide the thermo-nuclear rubric's `### Git / diff output`, `### Changed file contents`, and relevant `### Targeted context`, plus owner decisions.

## Completion

Required reviewers have performed their reviews and the owner has resolved actionable findings through fixes or evidence-backed rebuttals. Record material findings/resolutions in the PR or work record; keep the user update focused on outcome, verification, and real blockers.
