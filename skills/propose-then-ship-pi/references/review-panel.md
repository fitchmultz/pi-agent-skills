# Review Panel

Read before Phase 4. Exact invocation forms and the completion bar for the pi reviewer panel.

Four reviewers run as fresh-context subagents; two passes run in the parent session. Reviewers are read-only with respect to product code. All four reviewer subagents are unconditional because the user does not personally review agent-authored code.

| Pass | Where | Required | Looks for |
| --- | --- | --- | --- |
| `reviewer-gpt` | subagent, fresh | always | Correctness, maintainability, validation gaps. |
| `reviewer-security` | subagent, fresh | always | Security, data safety, and trust-boundary mistakes. |
| `reviewer-claude` | subagent, fresh | always | Cross-family structural review against the thermo-nuclear rubric. |
| `reviewer-ponytail` | subagent, fresh | always | Over-engineering, unnecessary code, dependencies, and abstractions. |
| `deslop` | parent | always | AI narration, debug leftovers, spurious defensiveness, style mismatch. |
| `verification-before-completion` | parent, verifies | always | Whether the "it is green" claim survives current evidence. |

In a named read-only PR review, all four subagents still run and the parent applies the deslop and verification rubrics as analysis only; also inspect existing CI, already-present Greptile comments, human threads, and PR comments, but explicit read-only scope forbids edits, comments, thread resolutions, merge, and deployment. Never wait for or trigger Greptile.

A spelling-only typo outside a named invocation may use the repository's lightweight path. Once this skill is active or a PR review is requested, all four reviewers are required regardless of diff size.

Regular `reviewer` is never a panel member and never substitutes for deslop. Deslop runs in the parent only; do not launch `reviewer` with the deslop skill as a proxy. Confirm the registry once per run with `subagent({ action: "list" })` and use the effective names it returns for the four panel agents above. A Review grouping that also lists regular `reviewer` does not add it to this panel.

## Launch shape

Write the worktree path in literally and launch all four tasks together:

```typescript
subagent({
  tasks: [
    { agent: "reviewer-gpt",      cwd: "<worktree>", output: false, task: "Review the branch diff against origin/<base> ..." },
    { agent: "reviewer-security", cwd: "<worktree>", output: false, task: "Security review of the branch diff against origin/<base> ..." },
    { agent: "reviewer-claude",   cwd: "<worktree>", output: false, task: "Read <skill-dir>/../thermo-nuclear-code-quality-review/agents/subagent.md and follow it ..." },
    { agent: "reviewer-ponytail", cwd: "<worktree>", output: false, task: "Review the branch diff against origin/<base> only for unnecessary complexity and code that should be deleted ..." }
  ],
  concurrency: 4,
  context: "fresh",
  async: true
})
```

## Brief contents

Every task brief carries: the absolute worktree path, the base branch, the **current head SHA**, the PR number and link once one exists, the approved outcome, acceptance criteria, user-aware repository scope, delivery action, and non-goals, the recorded CI gate policy and source, the validation already run, and the running record of rebutted findings and user-approved tradeoffs so they are not re-litigated. Include the shared evidence ledger: exact commands or sources, cwd, tree or head identity, results, and relevant environment. Reviewers may reuse still-valid deterministic validation outputs instead of repeating a full suite; they run missing or invalidated checks and return the same fields for new evidence. Ledger reuse never replaces the reviewer's own fresh analysis. Prior findings and rebuttals are context, but prior verdicts and sign-off cannot satisfy a later review cycle or a changed diff. Tell reviewers not to modify project or source files. Record each run ID and inspect its result.

Never ask a child for evidence only the parent can obtain. Children do not receive the `subagent` tool, so registry listings, agent configs, and run status must be captured in the parent and pasted into the brief. A child asked to "verify the registry" will stall or guess.

## Preparing reviewer-claude

`reviewer-claude` needs the thermo-nuclear labeled sections, because a subagent starts with none of your history. Gather them first, then supply `### Git / diff output`, `### Changed file contents`, and `### Targeted context`. That last section is where duplication and convention drift surface, so supply it.

```bash
git -C <worktree> diff "origin/<base>...HEAD"
git -C <worktree> diff "origin/<base>...HEAD" --name-only -z | xargs -0 wc -l
```

`reviewer-claude` is also the cross-family check: it runs a different vendor family than `reviewer-gpt`, so the panel does not share one model's blind spots. Rerun it with the rest of the panel after every diff change until all four sign off on the exact diff being shipped.

## Completion bar

An async reviewer that times out is incomplete. Rerun it, resume it, or split it, then wait for a real verdict. Every blocker and nit gets a recorded verdict, but reviewers need not return zero nits or explicit LGTM wording. For delivery, exit only after all four reviewed the exact current diff and zero blocking findings remain. For an explicitly read-only review, completion means all four exact-head reviews returned and their findings were consolidated; blockers remain reported because editing was forbidden. A rebutted blocking finding clears when that reviewer reassesses the current head with the rebuttal and no longer classifies it as blocking. After any diff change, all four reviewers must analyze the updated diff again; later passes may find issues an earlier pass missed.
