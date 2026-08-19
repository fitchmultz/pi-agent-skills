# Review Panel

Read before Phase 4. Exact invocation forms and the sign-off bar for the pi reviewer panel.

The first substantive head for each scope gets four fresh-context reviewers in one async exact-head panel. Later remediation waves are selective. Deslop and verification always run in the parent session; the bundled UX review also runs there for every user-visible PR. Reviewers are read-only with respect to product code.

| Pass | Where | Required | Looks for |
| --- | --- | --- | --- |
| `reviewer-gpt` | subagent, fresh | first wave; later only when it blocked the previous wave | Correctness, maintainability, validation gaps. |
| `reviewer-ponytail` | subagent, fresh | every wave with a new head | Over-engineering and slop without changing intended behavior. |
| `reviewer-claude` | subagent, fresh | first wave; later only when it blocked the previous wave | Cross-family structural review against the thermo-nuclear rubric. |
| `reviewer-security` | subagent, fresh | first wave; later when it blocked or remediation touches auth, secrets, injection, or data exposure | Security and data safety against an explicit trust-boundary rubric. |
| `deslop` | parent, edits | always | AI narration, debug leftovers, spurious defensiveness, style mismatch. |
| `verification-before-completion` | parent, verifies | always | Whether the "it is green" claim survives current evidence. |
| `ux-review` | parent, read-only | user-visible changes | End-to-end usability, recovery, truthful outcomes, and regressions. |

Regular `reviewer` is never a panel member and never substitutes for deslop. Deslop runs in the parent only; do not launch `reviewer` with the deslop skill as a proxy. Confirm the registry once per run with `subagent({ action: "list" })` and use the effective names it returns for the four panel agents above. A missing or disabled named seat stops the run; never skip it or substitute another reviewer. A Review grouping that also lists regular `reviewer` does not add it to this panel.

The implementing agent remains the sole writer and owns the PR through merge. Panel agents inspect and report; they do not modify product code or hand ownership between writer and captain roles. `ux-review` is a conditional parent gate, not a fifth panel seat.

## Wave rules

1. **First wave.** The first substantive head for a PR, and every new substantive scope, launches all four seats together. The panel is fresh-context, async, and bound to the committed head SHA.
2. **Remediation wave.** A fix within the same approved scope reruns `reviewer-ponytail` plus only the seats that blocked the immediately preceding wave. A seat that clears drops from the next wave unless it blocks again.
3. **Sensitive remediation.** Any remediation touching auth, secrets, injection, or data-exposure paths also reruns `reviewer-security`, even when it previously cleared.
4. **Blocking rebuttal.** When the head is unchanged and the response is only a rebuttal, rerun the blocking seat with that rebuttal. Do not invent a remediation wave or rerun `reviewer-ponytail` solely for an unchanged head.
5. **Extensive remediation.** The owning agent may rerun the full panel or add reviewers when a fix is broad enough that the selective wave would miss meaningful risk.
6. **Base changes.** A mechanical rebase or merge that leaves reviewed content unchanged does not trigger re-review. Substantive conflict-resolution changes reopen review. When several cleared PRs become a new combined stack, review that combined tree once as a new first wave instead of re-paneling each component PR.

Commit remediation before launching a wave. A dirty checkout is not an exact-head review. Do not change the checkout or HEAD until every scheduled seat returns a real verdict.

## Launch shape

### First wave

Write the worktree path and current head SHA into every brief literally:

```typescript
subagent({
  tasks: [
    { agent: "reviewer-gpt",      cwd: "<worktree>", output: false, task: "Review the branch diff against origin/<base> at <head-sha> ..." },
    { agent: "reviewer-ponytail", cwd: "<worktree>", output: false, task: "Review the branch diff against origin/<base> at <head-sha> for over-engineering and slop ..." },
    { agent: "reviewer-claude",   cwd: "<worktree>", output: false, task: "Read <skill-dir>/../thermo-nuclear-code-quality-review/agents/subagent.md and follow it for the diff at <head-sha> ..." },
    { agent: "reviewer-security", cwd: "<worktree>", output: false, task: "Security review of the branch diff against origin/<base> at <head-sha> ..." }
  ],
  concurrency: 4,
  context: "fresh",
  async: true
})
```

### Remediation wave

Delete every inapplicable task before launch. `reviewer-ponytail` stays; other seats stay only under the comments below:

```typescript
subagent({
  tasks: [
    { agent: "reviewer-ponytail", cwd: "<worktree>", output: false, task: "Review the remediated diff at <head-sha> ..." },
    // Keep only when this seat blocked the previous wave.
    { agent: "reviewer-gpt",      cwd: "<worktree>", output: false, task: "Re-review the remediated diff and prior blocking finding at <head-sha> ..." },
    // Keep only when this seat blocked the previous wave.
    { agent: "reviewer-claude",   cwd: "<worktree>", output: false, task: "Re-review the remediated diff and prior blocking finding at <head-sha> ..." },
    // Keep when this seat blocked, or when remediation touches auth, secrets, injection, or data exposure.
    { agent: "reviewer-security", cwd: "<worktree>", output: false, task: "Re-review the remediated diff and relevant security paths at <head-sha> ..." }
  ],
  concurrency: 4,
  context: "fresh",
  async: true
})
```

## Brief contents

Every task brief carries: the absolute worktree path, the base branch, the **current head SHA**, the panel wave number, why that seat is included, the PR number and link once one exists, the approved direction and its non-goals, the recorded remote gate policy and source, the validation already run, the remediation since the prior wave, and the running record of declined findings and accepted tradeoffs so they are not re-litigated. Include the shared evidence ledger: exact commands or sources, cwd, tree or head identity, results, and relevant environment. Reviewers may reuse still-valid deterministic validation outputs instead of repeating a full suite; they run missing or invalidated checks and return the same fields for new evidence. Ledger reuse never replaces the reviewer's own fresh analysis in a wave where that seat is required. Prior findings and rebuttals are context. Prior sign-off does not replace a seat required in the current wave; seats omitted by the wave rules are intentionally not rerun.

Never ask a child for evidence only the parent can obtain. Children do not receive the `subagent` tool, so registry listings, agent configs, and run status must be captured in the parent and pasted into the brief. A child asked to "verify the registry" will stall or guess.

## Preparing reviewer-claude

`reviewer-claude` needs the thermo-nuclear labeled sections, because a subagent starts with none of your history. Gather them first, then supply `### Git / diff output`, `### Changed file contents`, and `### Targeted context`. That last section is where duplication and convention drift surface, so supply it.

```bash
cd <worktree> && git diff "origin/<base>...HEAD"
cd <worktree> && git diff "origin/<base>...HEAD" --name-only -z | xargs -0 wc -l
```

`reviewer-claude` is also the cross-family check, so it always runs in a first wave. Rerun it on remediation only when it blocked the previous wave, or when extensive remediation warrants a voluntary full panel.

## Sign-off bar

An async reviewer that times out is not sign-off. Resume it, rerun it, or split it, then wait for a real verdict. A rebutted blocking finding clears only when that reviewer withdraws it on a rerun with the rebuttal in the brief. A wave clears only when every seat scheduled for that exact head returns a non-blocking verdict. Remaining blockers and nits are a triage state: every blocker is cleared by its originating seat, and every nit is fixed, rebutted, or filed as a major-effort follow-up. Do not rerun a non-blocking seat solely because it listed nits the writer then fixed. Non-blocking seats omitted from a later remediation wave retain their earlier clearance by policy; do not turn every fix or mechanical rebase into a full-panel cascade. New substantive scope always resets to a full four-seat panel.
