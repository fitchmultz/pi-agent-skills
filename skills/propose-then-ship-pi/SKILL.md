---
name: propose-then-ship-pi
description: "Use for the propose-then-ship pipeline in pi: scan a repo, propose a ranked #1 recommendation, stop for the user's direction, then implement in a worktree and drive the PR through subagent review and CI to merge. Do not use for plain research, an already-decided change, or an existing PR."
compatibility: "pi harness with the subagent tool and configured reviewer agents. Needs git worktree support and the gh-work or gh-personal CLI alias. Bundled scripts need bash and jq."
metadata:
  version: "1.5.6"
  owner: "local"
  source: "Port of propose-then-ship from Cursor to pi. Pi runtime, agent registry, and gate behavior verified against the live session in August 2026."
---

# Propose Then Ship (pi)

## Goal

Turn one open-ended request into a merged PR across a single human decision point. The agent researches and proposes, the user picks the direction, then the agent implements, reviews, and merges the PR without further hand-holding.

## Success criteria

- Recon is read-only and ends in a hard stop. No edits, no commits, and nothing pushed before the user picks a direction.
- The proposal ranks candidates and leads with one #1 recommendation plus a concrete plan.
- Implementation happens in the dedicated worktree on its own branch, scoped to the approved direction, small defects encountered directly along its path, and valid review fixes tied to those changes.
- Every actionable review finding receives a **Fix** or **Rebut** verdict before completion. Fix valid actionable findings within this PR's scope. Rebut invalid or out-of-scope findings with reasoning; an optional follow-up may accompany an out-of-scope rebuttal but never clears the finding by itself. None are silently dropped.
- Merge-ready is proven on the current combined head: CI, base freshness, mergeability, reviewer sign-off for its reviewed content under the mechanical-sync rule below, and an explicit UX-impact verdict.
- The PR is squash-merged under the user's standing authorization, unless they said to wait.

## Use when

- The user asks for research plus a recommendation they expect to approve before any implementation.
- The user wants the full arc: investigate, propose, implement, adversarial review, merge.
- The user invokes this skill by name or with `/skill:propose-then-ship-pi`.

## Do not use when

- The user wants only an answer, an explanation, or a research summary.
- The direction is already decided. Skip to Phase 3 conventions instead of running the proposal gate.
- A PR already exists and only needs shepherding to green.
- The change is a trivial one-liner where a worktree and a review panel cost more than the change is worth.

## Core rules

- **The gate is real.** Phase 1 ends by asking the user to choose. Never continue into implementation on your own judgment, even when the answer looks obvious.
- **Approval resumes the run.** In pi, `ask_question` returns the answer into the same assistant turn. A proceed choice satisfies the direction gate: continue immediately through Phase 2 into Phase 3. Do not return a final response just to restate acceptance, announce that the PR is ready, or report merge-ready. After approval, continue until the Ship report or a named stop rule.
- **One approved direction per PR.** Do not turn discoveries into a new feature. Fix valid actionable review findings within this PR's scope. Rebut findings outside that scope with the scope reason and create a follow-up only when useful. When scope is genuinely ambiguous, Fix the finding in this PR.
- **Ship at ponytail-ultra standards.** The diff is the minimum that satisfies the approved direction, small defects encountered directly along its path, and valid review fixes tied to those changes: reuse what the repo already has, prefer stdlib and platform features over new code, and add no speculative abstractions, dependencies, or scaffolding.
- **Repo conventions beat this skill.** Read the target repo's `AGENTS.md` hierarchy, `CLAUDE.md`, and `CONTRIBUTING.md` before coding, and follow them where they conflict with these defaults.
- **Never weaken a gate to pass it.** No disabled checks, loosened assertions, `--no-verify`, edited CI config, or force-push over a running CI. An explicit absent-CI policy changes whether missing checks block; it never excuses a failing check.
- **User-visible changes require UX review.** Follow the bundled `../ux-review/SKILL.md` in the parent session. A UX regression, material finding, or `blocked on evidence` verdict blocks merge. Record `N/A` only when the actual diff is proven unable to affect user-visible behavior, with the concrete reason.
- **Use review waves, not rerun-all churn.** Every PR's first substantive change gets one fresh-context async exact-head panel with `reviewer-gpt`, `reviewer-ponytail`, `reviewer-claude`, and `reviewer-security`. Later remediation on the same scope reruns only `reviewer-ponytail` plus the seats that blocked the previous wave; also rerun `reviewer-security` when remediation touches auth, secrets, injection, or data exposure, or after any finding or risk note from that seat is fixed or rebutted. New substantive scope starts a new full panel. Extensive remediation may justify voluntarily rerunning the full panel or adding reviewers.
- **Keep one writer accountable.** The implementing agent owns the PR through review, fixes, CI, and merge. Reviewers stay read-only; do not split writer and captain roles or hand the PR off mid-loop.
- **Do not re-panel mechanical base syncs.** Reviewer sign-off carries across a purely mechanical rebase or merge of the current base with no overlap, conflict resolution, or reviewed-content change; the UX verdict also carries when user-visible behavior is unchanged; refresh exact combined-head CI, base freshness, and mergeability instead. Re-review only after substantive edits, real conflict-resolution changes, or new scope.
- **Never defer an actionable review finding.** An actionable finding identifies a defect, regression, policy violation, or concrete change to the current diff at any severity. Pure context, praise, and risk notes that identify no defect or change are informational; record each item from a reviewer's `Findings` section that is classified informational, with its reason, in the Ship report. Give every `reviewer-security` risk note a **Fix** or **Rebut** verdict even when it requests no change. Give every actionable panel, human, and already-present automated-review finding a **Fix** or **Rebut** verdict. A follow-up does not clear a finding.
- **Report instead of spinning.** Every loop in Phase 4 has a cap. On cap, hand back state and the blocker.

## pi runtime contract

This skill assumes pi, not Cursor. Four rules carry most of the difference.

1. **Shell state does not persist.** Each `bash` call is a new process. Values such as the base branch, worktree path, and PR number die at the end of the call that computed them. Compute a value, read it, then write the literal into every later command.
2. **There is no root-switch tool.** Scope work with an absolute path: `cd /Users/<you>/Projects/worktrees/<repo>/<slug> && <command>`. Pass the same absolute path as `cwd` to every subagent.
3. **Confirm the agent registry before delegating.** Call `subagent({ action: "list" })` once per run. Use the effective agent names it returns for the four panel members below. A missing or disabled named seat is a stop-and-report condition, never a silent skip or substitute. A Review grouping that also lists regular `reviewer` does not expand the panel: regular `reviewer` is never a panel member and never substitutes for parent-run deslop. Do not pin model IDs in this skill; the configured reviewer agents already carry their own models and fallbacks.
4. **Pick the GitHub alias from the remote owner.** Never run bare `gh` and never run `gh auth switch`.

```bash
git -C <repo-path> remote get-url origin | sed -E 's#\.git$##; s#.*[:/]([^/]+)/[^/]+$#\1#'
```

Strip the `.git` suffix in its own expression. A lazy quantifier such as `[^/]+?` is a hard `RE error` in the BSD `sed` on macOS, not a silent mismatch.

A `workos` owner means `gh-work`. Anything else means `gh-personal`. Verify the alias you actually resolved, not a fixed one, with `command -v <alias>` before any GitHub call. If it is missing, stop and report the missing alias together with the recovery action. Write the resolved alias literally into every later command, and pass it to bundled scripts as `GH_BIN=<alias>`; they refuse to run without it.

## Workflow

### Phase 0 — Worktree

Create the worktree before any recon, and work there for the rest of the run. This pipeline requires a branch, commit, push, and pull request: if the user explicitly excludes any of them, stop before Phase 0 and report that the full shipping pipeline cannot satisfy the restriction. Run this from the user's current checkout and read the printed values:

```bash
REPO=$(basename "$(git rev-parse --show-toplevel)")
SLUG="<kebab-case-slug-from-the-request>"
# Assign then default; a `|| echo main` after a pipe would fall back on sed, not git.
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null) || BASE=""
BASE=${BASE#origin/}
BASE=${BASE:-main}
git fetch origin "$BASE"
git worktree add -b "$SLUG" "$HOME/Projects/worktrees/$REPO/$SLUG" "origin/$BASE"
echo "WORKTREE=$HOME/Projects/worktrees/$REPO/$SLUG BASE=$BASE"
```

There is no root-switch in pi: record the printed worktree path and base, and write those literals into every later command and every subagent `cwd`.

The slug is provisional, since the direction is not chosen yet. Nothing is pushed until Phase 3, so rename the branch with `git branch -m` once the approved direction has a sharper name.

#### CI gate policy

Before Phase 1, read the current user/project instructions and repository guidance, then record this run's CI policy and its source:

- CI: `required` or `waived-if-absent`
- Source: the user instruction or repository guidance path that grants any waiver

CI defaults to `required`. A standing user or project instruction can cover an owner or repository; a permanent repository policy belongs in checked-in guidance such as `AGENTS.md`. Never infer a waiver from missing workflows, repository ownership, or what another repository did. If explicit sources conflict and normal instruction precedence does not resolve them, ask once. Carry the recorded policy through reviewer briefs and the Ship report so absent CI is reported as **waived**, never as passed.

Greptile is not a gate and has no policy mode. It reviews and comments automatically after changes: never wait for it, poll it, trigger it, or require an exact-head review, confidence score, acknowledgment, or re-review. Fix or rebut any actionable Greptile comments already present when the PR is checked, then proceed without waiting; the required review panel determines code sign-off.

### Phase 1 — Recon and proposal (read-only)

Zero writes to the repo: no edits, no commits, no pushes, no installs. An accidental invocation must cost a proposal and a local worktree, nothing else.

1. Split the request into its research half and its scan half. Research external concepts from current sources; do not rely on recall for anything that changes over time.
2. Scan the repo for concrete instances. Gather path/line evidence for each candidate. Include follow-ups, accepted tradeoffs, and rebutted out-of-scope findings recorded by earlier runs in this repo; stale tradeoffs are first-class candidates for #1. Launch parallel `scout` tasks in one `subagent` call instead of a serial crawl, and add `researcher` only when external evidence matters. Give every task `output: false` and an explicit `cwd`.
3. Rank candidates by cost of leaving them in place: blast radius, recurrence, reader and maintainer tax, and risk of the fix itself.
4. Deliver the proposal using the **Proposal contract** below.
5. Ask for the direction with `ask_question`. Offer, in order: proceed with #1, each named runner-up, narrow the scope, stop.
6. `ask_question` is the pause. Do not implement while it is waiting. When it returns, handle the answer immediately: a proceed choice continues to Phase 2, a narrowed scope is re-proposed, and stop ends the run. Never turn a proceed result into a status-only final response.

### Phase 2 — Direction gate

A proceed result returned by `ask_question` is the user's pick, even though the tool returns it in the same assistant turn. Before touching code, restate in two sentences: the chosen direction and the acceptance criteria you will hold yourself to. Do not end the turn after this restatement: rename the provisional branch with `git branch -m` if the approved direction has a sharper name, then start Phase 3 immediately. If the answer materially changes scope, re-propose instead of silently expanding.

### Phase 3 — Implement

1. Restore what worktrees do not copy: ignored files the build needs, such as `.env*` and installed dependencies. A fresh worktree has no `node_modules`.
2. Read the repo's own conventions and follow them.
3. Implement the approved plan, plus small defects encountered directly along its path. Review fixes land in Phase 4.
4. Validate at the scope of your change: the tests that exercise it, lint and build on what you touched. Fix what you broke. Do not duplicate a full remote matrix locally when CI exists. When CI is absent under `waived-if-absent`, its replacement is the repository's canonical local validation on the exact head before merge.
5. Commit with a message describing why, push the branch, then open the PR with `<gh-alias> pr create`. If it opens as a draft, mark it ready with `<gh-alias> pr ready <PR>` once implementation and local validation are complete. Task and direction approval authorize branch creation, commits, pushes, and PR creation in both WorkOS and personal repositories unless the user explicitly excluded one of those delivery actions; an exclusion stops this pipeline before that action rather than silently downgrading delivery. Do not ask again solely because the repository is outside WorkOS. That approval does not authorize tags, releases, external artifact publication, release credential reads, or production-control changes outside the repository's defined deployment.
6. When the work maps to a Linear issue, move it to review and attach the PR link.

### Phase 4 — Review loop

Cap at **10 cycles**. Steps 1 through 5 are local and settle in minutes. Let CI run in the background, but do not wait on it until the local panel is clean. Make at most one direct parent-session CI poll, and give its Bash tool call a 300-second timeout so `gh`, `jq`, and polling all share the hard wall-clock cap. On exit 2 or a tool timeout, hand the remaining wait to an asynchronous detached `watcher` instead of chaining parent polls. Continue useful work; when none remains, end the turn and let the watcher completion resume the run. Greptile reviews automatically and remains advisory; never wait for or trigger it.

1. **Panel.** Launch all four reviewers below in one fresh-context async `subagent` call for the first substantive head. On later remediation waves, launch `reviewer-ponytail` plus only the seats that blocked the previous wave, and add `reviewer-security` whenever the remediation touches auth, secrets, injection, or data exposure, or any finding or risk note from that seat is fixed or rebutted. New substantive scope starts a new full panel. Every launched reviewer performs a fresh analysis of the exact current head; ledger reuse never replaces a reviewer pass required in that wave. Keep the checkout and HEAD fixed until every scheduled seat returns a real verdict.
2. **Triage.** Give every actionable finding and every `reviewer-security` risk note a **Fix** or **Rebut** verdict. Fix each valid actionable finding within this PR's scope regardless of effort. Rebut invalid findings and findings outside that scope in writing with the reasoning; when scope is genuinely ambiguous, Fix. A follow-up may accompany an out-of-scope rebuttal but cannot replace it. Do not churn code to satisfy a wrong comment.
3. **Deslop.** Follow the bundled `../deslop/SKILL.md` in the parent session, against the same base, after the fixes land.
4. **UX gate.** Decide from the actual diff whether the PR can affect user-visible behavior. After all current changes are committed, follow the bundled `../ux-review/SKILL.md` in the parent session as a read-only review of the exact head; a dirty checkout cannot receive a verdict. Fix every UX regression or material finding, commit the fix, and rerun the affected journey and UX review on the new head. `blocked on evidence` is not clearance. Record `N/A` only when the diff is proven unable to affect user-visible behavior, with the concrete reason.
5. **Evidence gate.** Follow the bundled `../verification-before-completion/SKILL.md` in the parent session against the exact claim you are about to make. Claims about passing tests need current inspectable evidence, not memory; reuse only ledger entries whose scope remains unchanged.
6. **Push and watch CI.** When checks exist, every required check must pass regardless of policy. When none are reported, `required` is a blocker; `waived-if-absent` requires the repository's canonical local validation on the exact head and the waiver source in the report. Fix failures within this PR's scope. If a merge-blocking failure looks unrelated, check whether the branch is behind base and merge latest first; another PR may have already fixed it.
7. **Advisory automation and threads.** Never wait for, poll, trigger, score, or require Greptile. Fix or rebut each actionable Greptile comment already visible when the PR is checked, but do not wait for acknowledgment, resolution, or re-review. Its absence, latency, status, score, and reviewed head never block or reset readiness. Sweep blocking feedback from humans and required reviewers.
8. **Launch only the next required wave** after remediation: `reviewer-ponytail` plus the seats that blocked the previous wave, with the security override above. An unchanged-head rebuttal reruns only the blocking seat with that rebuttal; any rebuttal of a `reviewer-security` finding or risk note also reruns `reviewer-security`. A mechanical rebase or merge of unchanged content does not trigger re-review. New substantive scope restarts the full four-seat panel. Reuse still-valid deterministic checks, not reviewer judgment. Rerun UX review whenever remediation changes user-visible behavior after the prior UX verdict.

#### Review panel

The first substantive head gets `reviewer-gpt`, `reviewer-ponytail`, `reviewer-claude`, and `reviewer-security` together as fresh-context subagents. Remediation waves use the selective rerun rule above. `deslop`, `ux-review`, and `verification-before-completion` run in the parent. Regular `reviewer` is never a panel member and never a deslop proxy. `references/review-panel.md` carries the exact invocation forms, wave rules, brief contents, and sign-off bar; read it before the first launch.

#### Triage verdicts

Give every actionable finding one verdict, and record which:

- **Fix** — a valid actionable finding within this PR's scope. Change the code now, regardless of effort.
- **Rebut** — invalid, deliberate by repository convention, or outside this PR's scope. When scope is genuinely ambiguous, Fix instead. Write the reasoning and never silently drop it. For a valid out-of-scope issue, optionally file a follow-up after recording the Rebut verdict; the ticket does not clear the finding by itself. Rebutting a **blocking** finding does not clear it: rerun that reviewer with the rebuttal in the brief, and treat only its own withdrawal as sign-off. Any rebutted `reviewer-security` finding or risk note likewise requires that seat to withdraw it on rerun, regardless of severity. For a valid out-of-scope security note, withdrawal means accepting that it does not gate this PR, not declaring the underlying issue invalid. A rerun that accepts the prior verdict and only restates the same residual risk with no new defect or requested change is clearance, not a new verdict cycle.

Two reviewers disagreeing is signal, not noise. The code is usually ambiguous enough to be worth clarifying regardless of who is right.

#### Exit conditions

Leave the loop only when all of these hold against the current head SHA:

- The full four-seat first wave completed for the current scope, every blocking finding from it or a later wave was cleared by its originating seat on a required rerun, and every fixed `reviewer-security` finding or risk note was cleared and every rebutted item from that seat was withdrawn on rerun. Do not rerun another non-blocking seat solely because it listed findings the writer then fixed.
- Every actionable panel, human, and already-present automated-review finding and every `reviewer-security` risk note has a recorded **Fix** or **Rebut** verdict, and every `Findings` item classified informational is named with the reason. A follow-up alone never clears a finding.
- Every later remediation wave is clear on its exact head from `reviewer-ponytail`, every seat that blocked the previous wave, and `reviewer-security` whenever the remediation touched auth, secrets, injection, or data exposure, or any finding or risk note from that seat was fixed or rebutted.
- No new substantive scope or substantive conflict resolution landed without reopening review; mechanical base syncs alone do not invalidate panel clearance.
- The diff is free of AI narration and debug leftovers, and the verification pass confirmed the green claim with current inspectable evidence.
- UX impact has an explicit current verdict: changes that can affect users have a clear bundled UX review with no regression, material finding, or `blocked on evidence` verdict; `N/A` records why the diff is proven unable to affect user-visible behavior.
- Before merge, the repository's deployment path is classified: any merge-triggered artifact publication, external release, or production control outside the defined deployment already has explicit authorization.
- The head contains the current base tip and the PR is mergeable with no conflicts. CI checks are green when present. With zero checks, `waived-if-absent` also requires canonical local validation on the exact head and a cited waiver source; under `required`, missing checks remain unavailable and blocking.
- Zero unresolved blocking feedback from humans or required reviewers, and every actionable Greptile comment already present when checked has a recorded Fix or Rebut verdict. Greptile acknowledgment, thread resolution, and re-review are not required.
- Any linked Linear issue is current.

Passing tests alone is never sign-off. On hitting the cap, stop and report remaining findings, what you tried, and the recommended next step.

### Phase 5 — Merge

Standing instruction from the user, verbatim:

> When the PR is merge ready you may merge. I am repo admin so I am able to squash and merge. Thank you.

Default: **squash-merge without asking again** once the Phase 4 exit conditions are verified. This is standing pre-authorization. Passing the exit conditions is an action trigger, not a reporting checkpoint: do not report merge-ready and stop under the default.

Override: if the user says anywhere in the conversation to wait for their approval before merging, that overrides the default for the rest of the run. Report merge-ready and stop.

Follow `references/merge-gate.md` for the mechanics: the base freshness gate, the SHA-bound merge command, the post-merge smoke check, repository-defined deployment handling, and cleanup. Then deliver the **Ship report**.

### Phase 6 — Out-of-scope follow-ups

A follow-up may record an issue rebutted as outside this PR's scope, but it is optional and never substitutes for the recorded verdict. For WorkOS work, file it in the relevant project, assigned to the user or left unassigned, never to automation chosen by the agent. For personal repositories, do not create a Linear follow-up unless the user asks. After merge, there is no follow-up PR chain.

## Available scripts

**pr_signals.sh**: poll a PR's required CI checks until they settle. Read-only. Call it by absolute path, since the working directory is the worktree. Advisory automated reviewers such as Greptile do not affect its result.

Resolve `scripts/pr_signals.sh` from this skill directory before invoking it. Its 300-second default bounds accumulated polling sleeps; the Bash tool timeout is the hard wall-clock bound around subprocesses too. Make at most one direct parent call:

```typescript
bash({
  command: "GH_BIN=gh-work MAX_WAIT_SECONDS=285 <skill-dir>/scripts/pr_signals.sh <PR>",
  timeout: 300
})
```

On exit 2, or if that tool call reaches its timeout, launch a detached watcher instead of polling again in the parent:

```typescript
subagent({
  agent: "watcher",
  cwd: "<worktree>",
  output: false,
  context: "fresh",
  async: true,
  task: "Run GH_BIN=gh-work MAX_WAIT_SECONDS=1740 <skill-dir>/scripts/pr_signals.sh <PR> with a Bash tool timeout of 1800 seconds. Report the script exit code and printed head SHA when available. If the Bash tool times out first, report tool timeout with exit code unavailable and the head unavailable unless it was already printed. Report the terminal condition: pass, fail, setup problem, missing or unknown signals, closed PR, expired script budget, or tool timeout."
})
```

Continue useful work. If none remains, end the turn; the detached completion resumes the run.

Exit codes: `0` every check completed successfully on an open PR, `1` a check failed, `2` timed out with checks running, `3` setup problem, `4` settled but signals are missing or unknown, meaning zero checks reported, an unknown conclusion, or a PR that is not open. Exit 4 for zero checks is eligible for `waived-if-absent` only after canonical local validation passes on that printed head; it never hides an unknown check or closed PR. The script prints the head SHA; bind every claim to it.

**test_pr_signals.sh**: mocked check of every exit path. Run it after editing `pr_signals.sh`.

## Reference loading

- Read `references/review-panel.md` before Phase 4. It carries the exact subagent invocation forms and the sign-off bar.
- `references/greptile-loop.md` records the non-blocking Greptile policy. Never use it as a wait or merge gate.
- Read `references/merge-gate.md` when Phase 4 exits, before merging.

## Proposal contract

```markdown
## Recommendation: [one line, the #1 item]

**What it is** — [the pattern or problem, in plain terms]
**Where** — [`path:line` evidence, the worst 2-3 sites]
**Scale** — [how many instances, how it spread]
**Why this is #1** — [cost of leaving it, versus the runners-up]

### Plan
1. [Step with a concrete file or boundary]
2. ...

**Blast radius** — [what this touches, what could break]
**Verification** — [how you will prove it worked]
**Not doing** — [adjacent temptations explicitly out of scope]

### Runners-up
2. [Item] — [one line on why it ranked lower]
3. [Item] — [one line]
```

Then ask for the direction choice with `ask_question`. The tool itself supplies the pause; when it returns a proceed choice, continue with Phase 2 in the same assistant turn.

## Ship report

Title it `Shipped` once merged. Under the wait-for-approval override, title it `Merge-ready` and stop.

```markdown
## [Shipped|Merge-ready]: [PR title] ([#N](url))

**Direction taken** — [what the user approved]
**Change** — [what actually landed, in two or three lines]
**Head verified** — [SHA the gates below were checked against]

| Gate | Result |
| --- | --- |
| Panel | [waves run and seats in each, findings fixed, findings rebutted] |
| CI | [green and what ran / waived-if-absent, policy source, and exact-head local validation] |
| Feedback | [blocking human or required-reviewer feedback addressed] |
| UX | [bundled UX review verdict for changes that can affect users / `N/A` with proof of no user-visible impact] |
| Linear | [issue and state, or "none"] |
| Merge | [squash-merged and smoke-checked / merge-ready, awaiting your go] |
| Deployment | [run or verified / not defined / not reached while merge-ready / blocked pending authorization / failed] |

**Skipped or deferred validation** — [each policy-required pass not run, with the reason, or "none"; seats omitted by remediation-wave policy belong in the Panel row, and a UX `N/A` belongs in the UX row]
**Rebutted findings** — [each one, with the reasoning, or "none"]
**Informational review notes** — [each `Findings` item classified informational, with the reason, or "none"]
**Follow-ups** — [optional links for rebutted out-of-scope findings, or "none"]
```

## Gotchas

- **A settled check is not a passing check.** A completed required CI run with an empty conclusion is unknown, not green.
- **Missing CI is not an implicit waiver.** Cite the recorded instruction or repository guidance, apply only the matching absence policy, and report the gate as waived rather than passed.
- **Greptile never gates shipping.** It runs automatically; never wait, poll, trigger, score, or require it. Fix or rebut actionable comments already present, then merge without waiting for acknowledgment or re-review.
- **A clean merge is not a working merge.** Git reports a conflict only when both sides touch the same lines. A renamed function, a new required field, a tightened lint rule, or a new test all merge cleanly and fail afterward. Prove compatibility by testing the merged result.
- **A fresh worktree is not a working checkout.** Ignored files and dependencies are missing until you restore them.
- **Draft PRs do not run all checks** in some repos, and a draft never becomes mergeable. Mark ready early.
- **Automated reviewers produce false positives.** Validate before acting; an unjustified "fix" is worse than a rebuttal.
- **Merge and cleanup are separate operations.** Do not pass `--delete-branch` to `gh pr merge`; confirm the merge and smoke check first, then lease-delete the remote branch, remove the worktree, and atomically delete the unchanged local ref.

## Stop rules

Stop and hand back when: the user excludes a branch, commit, push, or pull-request action required by this pipeline; the direction gate has not been answered; a review finding reveals the approved plan is wrong; a Phase 4 loop hits its cap; a required panel seat is unavailable; CI fails for reasons outside this PR's scope; the required GitHub alias is unavailable; merging would require weakening a gate; or merge would trigger an external artifact release or production control outside the defined deployment that lacks explicit authorization. For an authorization stop, ask for that authorization before merge.

Stop before Phase 0 when the target repository is the home dotfiles checkout, where `$HOME` is the repository root. Worktree and branch operations there are governed by separate standing prohibitions. Report the conflict and ask how to proceed.

## Anti-patterns

- Implementing during Phase 1 because the fix seemed obvious.
- Presenting five equal options instead of one ranked recommendation.
- Substituting an inline self-review for the fresh-context reviewer gate.
- Adding regular `reviewer` to the panel because the registry groups it under Review, or launching it with the deslop skill as a stand-in for the parent deslop pass.
- Rerunning all four seats after every remediation or mechanical rebase instead of following the wave rules.
- Expanding the diff with unrelated cleanup discovered mid-implementation, beyond the approved direction, small defects encountered directly along its path, and valid review fixes tied to those changes.
- Waiting for, manually triggering, or treating any Greptile result as a merge condition.
