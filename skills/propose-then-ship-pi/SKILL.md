---
name: propose-then-ship-pi
description: "Use for autonomous delivery in pi. For open-ended work, scan a repo, propose a ranked #1 recommendation, and wait for the user's direction. For a clear task or existing PR, treat the request as the direction and skip the proposal gate. Then deliver the complete approved outcome through every required PR and deployment with subagent review, CI, and Greptile. Do not use for plain research or generic read-only feedback unless the user names this skill or requests its full reviewer panel."
compatibility: "pi harness with the subagent tool and configured reviewer agents. Needs git worktree support and the gh-work or gh-personal CLI alias. Greptile review needs the greptile-apps GitHub App unless an explicit unavailable-service waiver applies. Bundled scripts need bash and jq."
metadata:
  version: "1.3.0"
  owner: "local"
  source: "Port of propose-then-ship from Cursor to pi. Pi runtime, agent registry, and gate behavior verified against the live session in August 2026."
---

# Propose Then Ship (pi)

## Goal

Turn one open-ended request into a fully delivered outcome across a single human decision point. The agent researches and proposes, the user picks the direction, then the agent implements the complete approved outcome through as many scoped PRs as necessary without further hand-holding.

## Success criteria

- Open-direction recon is read-only and pauses at the direction gate. No edits, commits, or pushes happen before the user picks a direction; a clear task or existing-PR request already supplies that direction.
- The proposal ranks candidates and leads with one #1 recommendation whose complete user-visible outcome, acceptance criteria, repository scope, and every known implementation slice are explicit. No required phase is hidden behind the first PR.
- Each implementation PR happens in a dedicated worktree on its own branch and remains a coherent slice of the approved direction.
- Every review finding is fixed, rebutted in writing, queued for immediate follow-up, or filed when it is an unrelated pre-existing issue. None are silently dropped or labeled accepted debt.
- The original approved acceptance criteria, not the first merged PR, define completion.
- Merge-ready is proven against each exact current head, not remembered from an earlier push.
- Each PR is squash-merged and every normal repository-defined deployment required by the approved outcome runs where policy allows, unless the user explicitly scoped a wait to that action. A publish or release runs only when the clear task or approved proposal explicitly includes it. Repositories that require external approval or a queue use that path instead.

## Use when

- The user asks for research plus a recommendation they expect to approve before any implementation.
- The user gives a clear implementation task and expects autonomous delivery rather than another proposal.
- The user asks to review, finish, or shepherd an existing PR through the full quality and delivery gates, or explicitly requests this skill's full panel for a read-only PR review.
- The user wants the full arc: investigate when needed, implement, adversarial review, merge, deploy when required, and verify the outcome.
- The user invokes this skill by name or with `/skill:propose-then-ship-pi`.

## Do not use when

- The user wants only an answer, explanation, research summary, or generic lightweight review feedback and did not name this skill or request its full panel.
- The task is solely an obvious non-behavioral typo or spelling correction outside a named invocation of this skill. A named invocation or PR review still receives the full panel; line count alone never creates an exemption.

## Core rules

- **The proposal gate is real when direction is open.** Phase 1 ends by asking the user to choose. A clear implementation request, a request to finish an existing PR, or a named shipping direction is already the user's direction and skips Phase 1 without weakening Phases 3 through 6.
- **Approval resumes the run.** In pi, `ask_question` returns the answer into the same assistant turn. A proceed choice satisfies the direction gate: continue immediately through Phase 2 into Phase 3. Do not return a final response just to restate acceptance, announce that a PR is ready, or report an intermediate merge. After approval, continue until the full approved outcome earns the Ship report or a named stop rule.
- **Approval follows user-aware repository scope.** Direction approval authorizes creating, merging, and running the normal repository-defined deployments for every required change in repositories named or unmistakably implicated by the task or proposal, subject to each repository's policy. Never ask again for another PR, merge, or ordinary deployment in that aware scope. Sharing an organization is not authority: when there is reasonable doubt that the user knew another repository was involved, ask once before writing there. Newly discovered irreversible production operations outside the approved outcome still require a scope decision.
- **Approval binds the outcome, not the proposed mechanics.** Replan, reorder, split, or combine implementation work autonomously whenever that better satisfies the original acceptance criteria. Ask again only when the user-visible outcome, acceptance criteria, user-aware repository scope, or an irreversible production operation must change.
- **Wait is not cancel.** Honor the exact scope of an explicit wait instruction and preserve resumable state. A PR-specific wait pauses only that PR; an unqualified wait pauses the run until the user resumes it. Only an explicit stop, cancel, or rejection ends approved work.
- **One approved outcome, scoped PRs.** Keep each PR coherent, but never reinterpret a PR boundary as the task boundary. A valid finding related to the changed scope is fixed now or, when a separate PR is materially safer, queued for the Phase 6 chain. An unrelated pre-existing finding is filed in Linear if no existing issue tracks it.
- **Ship at ponytail-ultra standards.** The diff is the minimum that satisfies the approved direction: reuse what the repo already has, prefer stdlib and platform features over new code, and add no speculative abstractions, dependencies, or scaffolding.
- **Repo conventions beat this skill.** Read the target repo's `AGENTS.md` hierarchy, `CLAUDE.md`, and `CONTRIBUTING.md` before coding, and follow them where they conflict with these defaults.
- **Never weaken a gate to pass it.** No disabled checks, loosened assertions, `--no-verify`, edited CI config, or force-push over a running CI. An explicit absent-service policy changes which remote gates exist; it never excuses a failing gate.
- **Four-agent review is mandatory.** `reviewer-gpt`, `reviewer-security`, `reviewer-claude`, and `reviewer-ponytail` always run as fresh-context subagents, followed by deslop and the evidence gate in the parent. The user does not review agent-authored code, so no panel member is optional. Add task-specific reviewers when repository policy or risk requires them.
- **Every finding gets a verdict, not silence.** Address blockers and nits alike: fix them, rebut them with reasoning, queue independently shippable related work, file an unrelated pre-existing issue, or stop on a real blocker. Reviewers do not need to return zero nits or an explicit LGTM; all four must complete current-head review, every finding must be addressed, and no blocker may remain. The agent cannot declare accepted debt.
- **Autonomy includes completion and cleanup.** After direction approval, never ask whether to continue an already approved implementation phase or clean up valid slop or debt in the changed scope. A groundwork PR is an intermediate step, not completion. Continue through every PR required by the approved acceptance criteria. Slop, missing validation, and maintainability debt in code this run adds or changes must be fixed before that PR merges; Phase 6 is not a cleanup escape hatch for sloppy code. A Linear issue or handoff is not completion for work this run introduced.
- **Persist without blind spinning.** The run has no review-cycle, PR-count, or retry-attempt cap. Individual polling commands may time out so one process cannot hang forever; after a timeout, inspect current state, retry or change strategy, and continue independent work. Hand back only for a real stop rule when no productive path remains.

## pi runtime contract

This skill assumes pi, not Cursor. Four rules carry most of the difference.

1. **Shell state does not persist.** Each `bash` call is a new process. Values such as the base branch, worktree path, and PR number die at the end of the call that computed them. Compute a value, read it, then write the literal into every later command.
2. **Use `change_dir` for the parent session.** After creating or selecting a worktree, call `change_dir` once and run later parent commands there without repeated `cd` prefixes. `bash` shell state still does not persist. Pass the absolute worktree path as `cwd` to every subagent.
3. **Confirm the agent registry before delegating.** Call `subagent({ action: "list" })` once per run. Use the effective agent names it returns for the panel members below. A Review grouping that also lists regular `reviewer` does not expand the panel: regular `reviewer` is never a panel member and never substitutes for parent-run deslop. Do not pin model IDs in this skill; the configured reviewer agents already carry their own models and fallbacks.
4. **Pick the GitHub alias from the remote owner.** Never run bare `gh` and never run `gh auth switch`.

```bash
git -C <repo-path> remote get-url origin | sed -E 's#\.git$##; s#.*[:/]([^/]+)/[^/]+$#\1#'
```

Strip the `.git` suffix in its own expression. A lazy quantifier such as `[^/]+?` is a hard `RE error` in the BSD `sed` on macOS, not a silent mismatch.

A `workos` owner means `gh-work`. Anything else means `gh-personal`. Verify the alias you actually resolved, not a fixed one, with `command -v <alias>` before any GitHub call. If it is missing, stop and report the missing alias together with the recovery action. Write the resolved alias literally into every later command, and pass it to bundled scripts as `GH_BIN=<alias>`; they refuse to run without it.

## Workflow

### Entry path

Choose the path from the user's request; do not manufacture another approval gate:

- **Open direction:** create the provisional worktree, run Phases 1 and 2, then deliver.
- **Clear task:** the request itself is the approved direction. Create the worktree, state the outcome, user-aware repository scope, and run-level acceptance criteria, then start Phase 3 without `ask_question`.
- **Existing PR:** create or reuse an isolated worktree for its exact head, reconstruct the outcome and acceptance criteria from the request, issue, and PR, then enter Phase 3 if implementation remains or Phase 4 if the diff is ready. The full reviewer, CI, Greptile, merge, deployment, and completion rules still apply.
- **Named read-only PR review:** run all four fresh reviewers and the parent review passes against the exact head, and inspect existing CI, Greptile, threads, and PR comments without mutating them. Report findings only; make no edits, comments, thread resolutions, merge, or deployment because read-only scope is explicit. Then remove the unchanged review worktree and any unchanged local review branch.
- **Obvious typo outside this skill:** a non-behavioral spelling-only correction may use the repository's normal lightweight path. If this skill is named or a PR review is requested, do not take the exemption.

### Phase 0 — Worktree

Create the worktree before any recon, and work there for the rest of the run. Run this from the user's current checkout and read the printed values:

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

Record the printed worktree path and base. Call `change_dir` with that worktree once for the parent session, and pass the literal absolute path as every subagent `cwd`.

The slug is provisional when direction is open. Nothing is pushed until Phase 3, so rename the branch with `git branch -m` once the approved direction has a sharper name. If the user rejects, stops, or cancels before implementation, verify the provisional worktree is unchanged, remove it, and delete the unchanged local branch with a SHA-bound `git update-ref`; leave no rejected-work tree behind.

#### Remote gate policy

Before the next proposal or implementation phase, read the current user/project instructions and repository guidance, then record this run's policy and its source for every repository in the user-aware scope:

- CI: `required` or `waived-if-absent`
- Greptile: `required` or `waived-if-unavailable`
- Source: the user instruction or repository guidance path that grants any waiver

Both gates default to `required`. A standing user or project instruction can cover an owner or repository; a permanent repository policy belongs in checked-in guidance such as `AGENTS.md`. Never infer a waiver from missing workflows, a missing app, repository ownership, or what another repository did. If explicit sources conflict and normal instruction precedence does not resolve them, ask once. Carry the recorded policy through reviewer briefs and the Ship report so an absent service is reported as **waived**, never as passed.

### Phase 1 — Recon and proposal (read-only)

Zero writes to the repo: no edits, no commits, no pushes, no installs. An accidental invocation must cost a proposal and a local worktree, nothing else.

1. Split the request into its research half and its scan half. Research external concepts from current sources; do not rely on recall for anything that changes over time.
2. Scan the repo for concrete instances. Gather path/line evidence for each candidate. Include relevant follow-ups and deferred work from earlier runs. Unfinished work directly related to code an agent previously touched has priority. A glaring unrelated hole may still rank highly when its severity justifies that choice, but it must not silently displace required related cleanup. Launch parallel `scout` tasks in one `subagent` call instead of a serial crawl, and add `researcher` only when external evidence matters. Give every task `output: false` and an explicit `cwd`.
3. Rank candidates by cost of leaving them in place: blast radius, recurrence, reader and maintainer tax, and risk of the fix itself.
4. Deliver the complete outcome and all known implementation slices using the **Proposal contract** below.
5. Ask for the direction with `ask_question`. Offer, in order: proceed with #1, each named runner-up, narrow the scope, stop.
6. `ask_question` is the pause. Do not implement while it is waiting. When it returns, handle the answer immediately: any selected recommendation continues to Phase 2, a narrowed scope is re-proposed, and stop or rejection triggers provisional-worktree cleanup and ends the run. Never turn a proceed result into a status-only final response.

### Phase 2 — Direction gate

A result returned by `ask_question` is the user's direction choice, even though the tool returns it in the same assistant turn. The same rule applies when the original request already gives a clear task. Before touching code, state in two sentences the chosen outcome, user-aware repository scope, and run-level acceptance criteria. For a selected runner-up, derive its complete delivery contract now and continue without asking for a second approval; ask only if that derivation reveals a repository or irreversible production boundary the user could not reasonably have known. The criteria remain the completion contract across every PR, deployment, and implementation replan. Do not end the turn after this restatement: rename the provisional branch if useful, then start Phase 3 immediately.

### Phase 3 — Implement

1. Restore what worktrees do not copy: ignored files the build needs, such as `.env*` and installed dependencies. A fresh worktree has no `node_modules`.
2. Read the repo's own conventions and follow them.
3. Implement the approved outcome. Treat the delivery plan as a starting route, not a permission boundary: autonomously replan within the acceptance criteria. If the complete outcome needs multiple PRs, record every known remaining required slice for the Phase 6 completion chain before treating the first PR as merge-ready; newly discovered required slices may be added later.
4. Validate at the scope of your change: the tests that exercise it, lint and build on what you touched. Fix what you broke. Do not duplicate a full remote matrix locally when CI exists. When CI is absent under `waived-if-absent`, its replacement is the repository's canonical local validation on the exact head before merge.
5. Commit with a message describing why, then open the PR with `<gh-alias> pr create`. If it opens as a draft, mark it ready with `<gh-alias> pr ready <PR>` once implementation and local validation are complete. Direction approval covers every required PR in the user-aware repository scope. If another repository becomes necessary, continue when it was unmistakably implicated in the approved task; when user awareness is genuinely doubtful, stop before writing there and ask once to expand scope.
6. When the work maps to a Linear issue, attach every PR link and keep the parent issue active across intermediate PRs. Move it to the team's final review or completion state only when the full run-level acceptance criteria support that transition.

### Phase 4 — Review loop

There is no review-cycle cap. Steps 1 through 4 are local and settle in minutes. Let CI and Greptile run in the background, but do not wait on either until the local panel is clean: they review whatever is pushed at that moment, so blocking early spends a remote cycle on a diff you are about to rewrite. Keep iterating until the exit conditions hold or a real stop rule applies; a cycle count is never a stop reason.

1. **Panel.** Launch the review panel below in one `subagent` call. Every required reviewer performs a fresh analysis of the current diff; ledger reuse never replaces a reviewer pass.
2. **Triage.** Fix valid findings related to the changed scope. Rebut invalid ones in writing with reasoning. Queue a separate PR only for independently shippable functional work when separation is materially safer; never defer slop, missing validation, or maintainability debt in code this run adds or changes. File unrelated pre-existing findings under the File verdict below. Do not churn code to satisfy a wrong comment.
3. **Deslop.** Follow the bundled `../deslop/SKILL.md` in the parent session, against the same base, after the fixes land.
4. **Evidence gate.** Follow the bundled `../verification-before-completion/SKILL.md` in the parent session against the exact claim you are about to make. Claims about passing tests need current inspectable evidence, not memory; reuse only ledger entries whose scope remains unchanged.
5. **Push and watch CI.** When checks exist, every required check must pass regardless of policy. When none are reported, `required` is a blocker; `waived-if-absent` requires the repository's canonical local validation on the exact head and the waiver source in the report. Fix failures within this PR's scope. If a merge-blocking failure looks unrelated, check whether the branch is behind base and merge latest first; another PR may have already fixed it.
6. **Greptile and threads.** Apply the recorded policy, then follow `references/greptile-loop.md`. `required` needs the normal current-head verdict. `waived-if-unavailable` permits only a confirmed unavailable app/review surface; any current-head Greptile signal makes the normal verdict and findings required. Sweep threads and PR comments from every author under either policy.
7. **Re-run the required reviewers** after any diff change since their last review. Reuse still-valid deterministic checks, not reviewer judgment; a prior clean verdict never signs off a changed diff.

#### Review panel

`reviewer-gpt`, `reviewer-security`, `reviewer-claude`, and `reviewer-ponytail` always run as fresh-context subagents, plus `deslop` and `verification-before-completion` in the parent. Regular `reviewer` is never a panel member and never a deslop proxy; deslop runs only in the parent. `references/review-panel.md` carries the exact invocation forms, brief contents, and the completion bar; read it before the first launch.

#### Triage verdicts

Give every finding one verdict, and record which:

- **Fix** — valid and related to the approved or touched scope. Change the code. This is the default.
- **Rebut** — wrong, or right about a pattern the repo deliberately uses. Write the reasoning. Never silently drop it. A rebutted **blocking** finding clears only after that reviewer reassesses the current head with the rebuttal and no longer classifies it as blocking; special withdrawal wording is not required.
- **Defer** — valid, independently shippable functional work related to the changed scope, where a separate PR is materially safer than widening the current diff. Never use Defer for slop, missing tests, missing validation, or maintainability debt in code this run adds or changes. It must enter the Phase 6 completion chain; a Linear issue alone never satisfies it.
- **File** — valid, unrelated, and pre-existing. Search Linear first; if no issue already tracks it, create one in the relevant team and project, assigned to the user or left unassigned. Do not widen the current diff or add it to the completion chain.
- **Block** — continuing requires changed user intent, permission the agent does not have, a security or irreversible decision requiring human authorization, or an external dependency the agent cannot progress after trying the available safe paths. Implementation uncertainty is not a blocker: choose a reasonable reversible default and continue. A Block verdict records the attempted paths and concrete missing decision or capability.

There is no agent-selected accepted-debt verdict. Inside Phase 6, fix related findings in the current PR or add another required completion-chain PR when separation is materially safer; never file away work the chain introduced.

#### Exit conditions

Leave the loop only when all of these hold against the current head SHA:

- `reviewer-gpt`, `reviewer-security`, `reviewer-claude`, and `reviewer-ponytail` each completed a fresh review of the exact diff being shipped after their last requested change. Every finding has a recorded verdict and zero blocking findings remain; explicit LGTM wording and a zero-nit response are not required.
- The diff is free of AI narration and debug leftovers, and the verification pass confirmed the green claim with current inspectable evidence.
- The head contains the current base tip and the PR is mergeable with no conflicts. CI checks are green when present. With zero checks, `waived-if-absent` also requires canonical local validation on the exact head and a cited waiver source; under `required`, missing checks remain unavailable and blocking.
- Greptile's bot-authored summary footer identifies the current head and every actionable finding is addressed, or the app/review surface is confirmed unavailable under a cited `waived-if-unavailable` policy. Strive for 5/5 and report the score when available, but a lower or unavailable score is not blocking once the current-head review and actionable feedback are clear.
- Zero unresolved review threads from any author, and every PR-level comment addressed. Threads and issue comments are separate surfaces; check both.
- Any linked Linear issue is current.

Passing tests alone never satisfies panel completion. If the same failure repeats, inspect why, change strategy, rebut invalid feedback through the normal process, or identify the concrete stop rule. Continue independent completion-chain work when possible; elapsed cycles alone never justify stopping.

### Phase 5 — Merge, deploy, and verify

Standing authorization: merge and ordinary repository-defined deployment required by the approved outcome are pre-authorized unless the user explicitly scopes a wait or prohibition to them. Publishing or releasing is authorized when the clear task or approved proposal explicitly includes it; do not infer release authority from merge or deploy authority alone. Direction approval within the user-aware repository scope is the authorization; omitting a normal delivery action from the proposal does not create another approval gate.

Default: **squash-merge and deliver without asking again** once the Phase 4 exit conditions are verified and repository policy permits it. Passing the exit conditions is an action trigger, not a reporting checkpoint: do not report merge-ready and stop under the default. After merge, trigger or monitor the repository's normal deploy workflow when the approved outcome requires it, plus any release workflow explicitly included in the approved direction, then verify the live or operational end state. Do not invent a deployment when the repository or outcome has none.

If repository policy requires external human approval, a merge queue, or a deployment approval system, request or enter that repository-defined gate instead of asking the user to manually review agent code. Wait for that external gate, then continue the run. Any code change requested during external review returns the PR to Phase 4 and resets every exact-head gate.

Override only to the scope the user states. A request to wait on one PR pauses that PR at Merge-ready and preserves the rest of the approved run; a run-wide wait pauses all delivery until the user resumes it. Neither form cancels the completion chain, and approval resumes automatically once the scoped wait is lifted.

Follow `references/merge-gate.md` for the mechanics: the base freshness gate, the SHA-bound merge command, the post-merge check, and cleanup. Then perform any required deployment and post-deploy validation. If post-merge or post-deploy validation reveals an uncaught defect, regression, or polish gap, do not report `Shipped`, close the parent issue, or hand the polish back: diagnose it immediately, make the repair the highest-priority completion-chain item, run it through Phases 3 through 5, redeploy when required, and revalidate the end state. Repeat until clean or a real stop rule applies. If approved work remains for any other reason, continue immediately into Phase 6.

### Phase 6 — Completion chain

The chain contains every remaining implementation or delivery slice required by the approved outcome and valid changed-scope findings deferred because a separate PR was materially safer. A merged groundwork PR never completes the run while approved acceptance criteria remain. After each merge and cleanup, announce the next queued item and execute it; the announcement is informational, not a permission request.

Each code-change item gets its own slug, worktree, branch, and PR through the full Phase 3→5 pipeline: same panel, same Greptile, same exit conditions, and the repository's merge, deployment, or external-approval path. A delivery-only item runs the repository workflow and validates the already reviewed artifact without fabricating an empty PR or rerunning reviewers against unchanged code. No per-item permission is needed because the direction approved the outcome, not merely the first PR. Every other stop rule stays live, including the dotfiles stop. A scoped `wait` pauses only its stated work and preserves the queue; an explicit `stop` or `cancel` ends the chain and triggers safe cleanup of agent-owned worktrees.

The acceptance criteria, not a PR count or a frozen queue, bound the chain:

- Add any newly discovered implementation slice or related fix demonstrably required to satisfy the original acceptance criteria. There is no numerical PR cap.
- A related finding discovered while working a chain item is fixed there or added as another completion-chain PR when separation is materially safer. An unrelated pre-existing finding is searched in Linear and filed only when no issue exists.
- No queued item is silently skipped as "misjudged." Remove it only through a documented Rebut tied to the acceptance criteria and current evidence. The normal fresh panel then reviews the resulting current head; only an originally blocking reviewer finding requires reassessment by that reviewer with no blocker remaining.
- A gate failure is work, not an automatic end to the chain. Keep fixing or retrying it. If a genuine external blocker remains, continue independent queued items and pause only dependent work. Stop the run only when no productive independent work remains or the blocker prevents an original acceptance criterion; never claim `Shipped` while it remains.

End the chain only after a requirement-to-evidence map proves every original acceptance criterion. The closing report lists each shipped PR, any rebutted queued item with its evidence, any remaining blocker in a non-Shipped blocker report, and unrelated pre-existing Linear issues filed.

## Available scripts

**pr_signals.sh**: poll a PR's CI checks until they settle. Read-only. Call it by absolute path, since the working directory is the worktree. It does not evaluate Greptile — some installs produce no Greptile check, and the rollup hides the producing app — so that gate lives in `references/greptile-loop.md`.

Resolve `scripts/pr_signals.sh` from this skill directory before invoking it:

```bash
GH_BIN=gh-work <skill-dir>/scripts/pr_signals.sh <PR>
GH_BIN=gh-work MAX_WAIT_SECONDS=1800 <skill-dir>/scripts/pr_signals.sh <PR>
```

Exit codes: `0` every reported check settled with no failure or unknown state on an open PR; neutral or skipped checks still require the caller to verify that no required or materially relevant validation was omitted, `1` a check failed, `2` timed out with checks running, `3` setup problem, `4` settled but signals are missing or unknown, meaning zero checks reported, an unknown conclusion, or a PR that is not open. Exit 2 bounds one polling process, not the run: inspect state and start another wait while checks remain active. Exit 4 for zero checks is eligible for `waived-if-absent` only after canonical local validation passes on that printed head; it never hides an unknown check or closed PR. The script prints the head SHA; bind every claim to it.

**test_pr_signals.sh**: mocked check of every exit path. Run it after editing `pr_signals.sh`.

## Reference loading

- Read `references/review-panel.md` before Phase 4. It carries the exact subagent invocation forms and the completion bar.
- Read `references/greptile-loop.md` when waiting on Greptile, reading its verdict, or sweeping unresolved threads.
- Read `references/merge-gate.md` only after Phase 4 exits, before merging and any required deployment.

## Proposal contract

```markdown
## Recommendation: [one line, the #1 complete outcome]

**What it is** — [the pattern or problem, in plain terms]
**Where** — [`path:line` evidence, the worst 2-3 sites]
**Scale** — [how many instances, how it spread]
**Why this is #1** — [cost of leaving it, versus the runners-up]
**Final outcome** — [the complete user-visible or operational end state; groundwork is not an outcome]
**Acceptance criteria** — [every condition that must hold before the run may say Shipped]
**Repository scope** — [every repository named or unmistakably implicated; call out cross-repo work so user awareness is clear]
**Delivery action** — [merge only / normal deploy or release required for the operational outcome]

### Delivery plan
1. [Ordered PR/slice with its repository, concrete boundary, and purpose]
2. ...

**Blast radius** — [what this touches, what could break]
**Verification** — [how the final outcome and each risky boundary will be proven]
**Not doing** — [adjacent temptations explicitly out of scope; never exclude work required by an acceptance criterion]

### Runners-up
2. [Item] — [complete outcome, known repository scope, and one line on why it ranked lower]
3. [Item] — [complete outcome, known repository scope, and one line on why it ranked lower]
```

Then ask for the direction choice with `ask_question`. The tool itself supplies the pause; when it returns a proceed choice, continue with Phase 2 in the same assistant turn.

## Ship report

Title it `Shipped` only when the complete approved outcome is delivered, every original acceptance criterion is verified, all required validation ran, and no completion-chain work remains. An intermediate merged PR gets no final Ship report. Under a scoped wait, title the affected PR `Merge-ready`, preserve the rest of the run, and resume when the wait is lifted.

```markdown
## [Shipped: approved outcome | Merge-ready: PR title]

**Direction taken** — [what the user approved]
**Acceptance criteria** — [requirement-to-evidence map]
**PRs** — [every shipped PR, or the current merge-ready PR]
**Change** — [what actually landed, in two or three lines]
**Heads verified** — [each PR and exact SHA its gates were checked against]

| Gate | Result |
| --- | --- |
| Panel | [all four current-head reviews completed, blockers remaining: 0, findings fixed/rebutted/queued/filed] |
| CI | [green and what ran / waived-if-absent, policy source, and exact-head local validation] |
| Greptile | [reviewed head/footer hash, score if available, actionable findings and threads resolved / waived-if-unavailable and policy source] |
| Threads | [unresolved count across all authors] |
| Linear | [issue and state, or "none"] |
| Merge | [each PR squash-merged and post-merge checked / scoped merge-ready wait] |
| Delivery | [required deploy/release and post-deploy validation / not required] |

**Required validation** — [every required pass and evidence; `Shipped` requires no omissions]
**Unavailable optional validation** — [non-required passes that could not run, with the reason, or "none"]
**Rebutted findings** — [each one, with the reasoning, or "none"]
**Filed pre-existing issues** — [Linear issue links, or "none"]
**Completion chain** — [every completed slice and PR; `Shipped` requires no remaining item]
```

## Gotchas

- **A settled CI check is not automatically evidence that required validation ran.** Empty or unknown is incomplete. Neutral or skipped may be valid for an optional check, but a required or materially relevant check must actually pass or be rerun; inspect what was skipped instead of treating exit 0 as proof.
- **A missing service is not an implicit waiver.** Cite the recorded instruction or repository guidance, apply only the matching absence policy, and report the gate as waived rather than passed.
- **A clean merge is not a working merge.** Git reports a conflict only when both sides touch the same lines. A renamed function, a new required field, a tightened lint rule, or a new test all merge cleanly and fail afterward. Prove compatibility by testing the merged result.
- **A fresh worktree is not a working checkout.** Ignored files and dependencies are missing until you restore them.
- **Draft PRs do not run all checks** in some repos, and a draft never becomes mergeable. Mark ready early.
- **Automated reviewers produce false positives.** Validate before acting; an unjustified "fix" is worse than a rebuttal.
- **Merge and cleanup are separate operations.** Do not pass `--delete-branch` to `gh pr merge`; confirm the merge and targeted post-merge validation first, then lease-delete the remote branch, remove the worktree, and atomically delete the unchanged local ref.

## Stop rules

Stop and hand back when: an open-ended direction gate has not been answered; changed user intent or a repository or irreversible production boundary outside the user's awareness requires a decision; the approved outcome or acceptance criteria cannot be met without changing them; CI fails for reasons the agent cannot progress after safe retries or an external dependency remains genuinely unavailable; the required GitHub alias is unavailable; or delivery would require weakening a gate. A failed implementation plan is not a stop rule: replan within the approved outcome. Cycle count, PR count, retry count, and polling timeout are never stop rules by themselves.

Stop before Phase 0 when the target repository is the home dotfiles checkout, where `$HOME` is the repository root. Worktree and branch operations there are governed by separate standing prohibitions. Report the conflict and ask how to proceed.

On explicit rejection, stop, or cancellation, clean every agent-owned isolated worktree created for the rejected work. Before implementation, remove the unchanged worktree and SHA-bound local branch. After implementation starts, discard only changes proven to belong to this run, remove the worktree, and preserve already-pushed branches, PRs, or unique commits unless the user explicitly asks to close or delete them. Never clean the user's original checkout or a shared worktree.

## Anti-patterns

- Implementing during Phase 1 because the fix seemed obvious.
- Presenting five equal options instead of one ranked recommendation.
- Substituting an inline self-review for the fresh-context reviewer gate.
- Adding regular `reviewer` to the panel because the registry groups it under Review, or launching it with the deslop skill as a stand-in for the parent deslop pass.
- Expanding the diff with unrelated cleanup discovered mid-implementation.
- Calling a groundwork PR "Shipped" while approved acceptance criteria remain, or asking whether to begin the next already approved phase.
- Treating a gate failure in one PR as permission to abandon independent approved work.
- Writing to an undisclosed repository because another repository in the same organization was approved.
- Changing correct code or looping solely to chase Greptile 5/5 after the current-head review has no actionable findings.
