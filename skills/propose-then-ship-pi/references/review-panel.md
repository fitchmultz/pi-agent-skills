# Review Panel

Read before Phase 4. Exact invocation forms and the sign-off bar for the pi reviewer panel.

Up to three reviewers run as fresh-context subagents; two passes run in the parent session. Reviewers are read-only with respect to product code. Apply the risk rule from Core rules: only `reviewer-gpt`, deslop, and the evidence gate are unconditional.

| Pass | Where | Required | Looks for |
| --- | --- | --- | --- |
| `reviewer-gpt` | subagent, fresh | always | Correctness, maintainability, validation gaps. This is the gate. |
| `reviewer-security` | subagent, fresh | on any trust boundary | Security and data safety against an explicit trust-boundary rubric. Different model family than the gate. |
| `reviewer-claude` | subagent, fresh | on real blast radius | Cross-family structural review against the thermo-nuclear rubric. |
| `deslop` | parent, edits | always | AI narration, debug leftovers, spurious defensiveness, style mismatch. |
| `verification-before-completion` | parent, verifies | always | Whether the "it is green" claim survives current evidence. |

Confirm the registry once per run with `subagent({ action: "list" })` and use the effective agent names it returns.

## Launch shape

Write the worktree path in literally. Drop a conditional task when its trigger does not apply, and record the skip and its reason in the report:

```typescript
subagent({
  tasks: [
    { agent: "reviewer-gpt",      cwd: "<worktree>", output: false, task: "Review the branch diff against origin/<base> ..." },
    // conditional: include when the change touches a trust boundary
    { agent: "reviewer-security", cwd: "<worktree>", output: false, task: "Security review of the branch diff against origin/<base> ..." },
    // conditional: include when the change carries real blast radius
    { agent: "reviewer-claude",   cwd: "<worktree>", output: false, task: "Read <skill-dir>/../thermo-nuclear-code-quality-review/agents/subagent.md and follow it ..." }
  ],
  concurrency: 3,
  context: "fresh",
  async: true
})
```

## Brief contents

Every task brief carries: the absolute worktree path, the base branch, the **current head SHA**, the PR number and link once one exists, the approved direction and its non-goals, the recorded remote gate policy and source, the validation already run, and the running record of declined findings and accepted tradeoffs so they are not re-litigated. Include the shared evidence ledger: exact commands or sources, cwd, tree or head identity, results, and relevant environment. Reviewers may reuse entries whose scope is still valid instead of repeating a full suite; they run missing or invalidated checks and return the same fields for new evidence. Tell reviewers not to modify project or source files. Record each run ID and inspect its result.

Never ask a child for evidence only the parent can obtain. Children do not receive the `subagent` tool, so registry listings, agent configs, and run status must be captured in the parent and pasted into the brief. A child asked to "verify the registry" will stall or guess.

## Preparing reviewer-claude

`reviewer-claude` needs the thermo-nuclear labeled sections, because a subagent starts with none of your history. Gather them first, then supply `### Git / diff output`, `### Changed file contents`, and `### Targeted context`. That last section is where duplication and convention drift surface, so supply it.

```bash
cd <worktree> && git diff "origin/<base>...HEAD"
cd <worktree> && git diff "origin/<base>...HEAD" --name-only -z | xargs -0 wc -l
```

`reviewer-claude` is also the cross-family check: it runs a different vendor family than `reviewer-gpt`, so the panel does not share one model's blind spots. Rerun it after every change it caused, until it signs off on the exact diff you are shipping.

## Sign-off bar

An async reviewer that times out is not sign-off. Rerun it, resume it, or split it, then wait for a real verdict. A rebutted blocking finding clears only when that reviewer withdraws it on a rerun with the rebuttal in the brief.
