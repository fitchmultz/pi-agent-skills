---
name: propose-then-ship-pi
description: "Use for the propose-then-ship pipeline in pi: scan a repo, propose a ranked #1 recommendation, stop for the user's direction, then implement in a worktree and drive the PR through subagent review, CI, and Greptile to merge. Do not use for plain research, an already-decided change, or an existing PR."
compatibility: "pi harness with the subagent tool and configured reviewer agents. Needs git worktree support and the gh-work or gh-personal CLI alias. The Greptile phase needs the greptile-apps GitHub App on the repo. Bundled scripts need bash and jq."
metadata:
  version: "1.0.0"
  owner: "local"
  source: "Port of propose-then-ship from Cursor to pi. Pi runtime, agent registry, and gate behavior verified against the live session in August 2026."
---

# Propose Then Ship (pi)

## Goal

Turn one open-ended request into a merged PR across a single human decision point. The agent researches and proposes, the user picks the direction, then the agent implements and drives the PR to merge-ready without further hand-holding.

## Success criteria

- Recon is read-only and ends in a hard stop. No edits, no commits, and nothing pushed before the user picks a direction.
- The proposal ranks candidates and leads with one #1 recommendation plus a concrete plan.
- Implementation happens in the dedicated worktree on its own branch, scoped to the approved direction only.
- Every review finding is fixed, rebutted in writing, or recorded as a follow-up. None are silently dropped.
- Merge-ready is proven against the exact current head, not remembered from an earlier push.
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
- **One approved direction per PR.** Never widen a diff with discoveries. From the main run they queue for the Phase 6 chain; from inside a chain item they are filed or reported, never queued.
- **Repo conventions beat this skill.** Read the target repo's `AGENTS.md` hierarchy, `CLAUDE.md`, and `CONTRIBUTING.md` before coding, and follow them where they conflict with these defaults.
- **Never weaken a gate to pass it.** No disabled checks, loosened assertions, `--no-verify`, edited CI config, or force-push over a running CI.
- **Scale rigor with risk.** `reviewer-gpt`, deslop, and the evidence gate always run. `reviewer-security` is required whenever the change touches a trust boundary: authentication, authorization, untrusted input, secrets, dependencies, outbound calls, or data exposure. `reviewer-claude` is required when the change carries real blast radius. Skip a conditional pass only for genuinely low-risk work, and name the skip and its reason in the report. Never drop a pass silently.
- **Every finding gets a verdict, not silence.** Fix it, rebut it with reasoning, or record it as a follow-up.
- **Report instead of spinning.** Every loop in Phase 4 has a cap. On cap, hand back state and the blocker.

## pi runtime contract

This skill assumes pi, not Cursor. Four rules carry most of the difference.

1. **Shell state does not persist.** Each `bash` call is a new process. Values such as the base branch, worktree path, and PR number die at the end of the call that computed them. Compute a value, read it, then write the literal into every later command.
2. **There is no root-switch tool.** Scope work with an absolute path: `cd /Users/<you>/Projects/worktrees/<repo>/<slug> && <command>`. Pass the same absolute path as `cwd` to every subagent.
3. **Confirm the agent registry before delegating.** Call `subagent({ action: "list" })` once per run. Use the effective agent names it returns. Do not pin model IDs in this skill; the configured reviewer agents already carry their own models and fallbacks.
4. **Pick the GitHub alias from the remote owner.** Never run bare `gh` and never run `gh auth switch`.

```bash
git -C <repo-path> remote get-url origin | sed -E 's#\.git$##; s#.*[:/]([^/]+)/[^/]+$#\1#'
```

Strip the `.git` suffix in its own expression. A lazy quantifier such as `[^/]+?` is a hard `RE error` in the BSD `sed` on macOS, not a silent mismatch.

A `workos` owner means `gh-work`. Anything else means `gh-personal`. Verify the alias you actually resolved, not a fixed one, with `command -v <alias>` before any GitHub call. If it is missing, stop and report the missing alias together with the recovery action. Write the resolved alias literally into every later command, and pass it to bundled scripts as `GH_BIN=<alias>`; they refuse to run without it.

## Workflow

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

There is no root-switch in pi: record the printed worktree path and base, and write those literals into every later command and every subagent `cwd`.

The slug is provisional, since the direction is not chosen yet. Nothing is pushed until Phase 3, so rename the branch with `git branch -m` once the approved direction has a sharper name.

### Phase 1 — Recon and proposal (read-only)

Zero writes to the repo: no edits, no commits, no pushes, no installs. An accidental invocation must cost a proposal and a local worktree, nothing else.

1. Split the request into its research half and its scan half. Research external concepts from current sources; do not rely on recall for anything that changes over time.
2. Scan the repo for concrete instances. Gather path/line evidence for each candidate. Include follow-ups and accepted debt deferred by earlier runs in this repo; a stale deferral is a first-class candidate for #1. Launch parallel `scout` tasks in one `subagent` call instead of a serial crawl, and add `researcher` only when external evidence matters. Give every task `output: false` and an explicit `cwd`.
3. Rank candidates by cost of leaving them in place: blast radius, recurrence, reader and maintainer tax, and risk of the fix itself.
4. Deliver the proposal using the **Proposal contract** below.
5. Ask for the direction with `ask_question`. Offer, in order: proceed with #1, each named runner-up, narrow the scope, stop.
6. **Stop.** Do not implement.

### Phase 2 — Direction gate

The user picks. Before touching code, restate in two sentences: the chosen direction and the acceptance criteria you will hold yourself to. If the answer materially changes scope, re-propose instead of silently expanding. Rename the provisional branch with `git branch -m` if the approved direction has a sharper name.

### Phase 3 — Implement

1. Restore what worktrees do not copy: ignored files the build needs, such as `.env*` and installed dependencies. A fresh worktree has no `node_modules`.
2. Read the repo's own conventions and follow them.
3. Implement the approved plan only.
4. Validate at the scope of your change: the tests that exercise it, lint and build on what you touched. Fix what you broke. Do not run the repo's full CI suite locally — every PR check must pass remotely anyway, and the full matrix runs there in parallel with your next steps.
5. Commit with a message describing why, then open the PR with `<gh-alias> pr create`. If it opens as a draft, mark it ready with `<gh-alias> pr ready <PR>` once implementation and local validation are complete. Outside a WorkOS repository, opening the PR is an external write with no standing exemption: confirm it first unless the user already asked for a PR.
6. When the work maps to a Linear issue, move it to review and attach the PR link.

### Phase 4 — Review loop

Cap at **10 cycles**. Steps 1 through 4 are local and settle in minutes. Let CI and Greptile run in the background, but do not wait on either until the local panel is clean: they review whatever is pushed at that moment, so blocking early spends a remote cycle on a diff you are about to rewrite.

1. **Panel.** Launch the review panel below in one `subagent` call.
2. **Triage.** Fix valid findings. Rebut invalid ones in writing with reasoning. Give out-of-scope findings the Defer verdict below. Do not churn code to satisfy a wrong comment.
3. **Deslop.** Follow the bundled `../deslop/SKILL.md` in the parent session, against the same base, after the fixes land.
4. **Evidence gate.** Follow the bundled `../verification-before-completion/SKILL.md` in the parent session against the exact claim you are about to make. Claims about passing tests need fresh output, not memory.
5. **Push and watch CI.** Fix failures within this PR's scope. If a merge-blocking failure looks unrelated, check whether the branch is behind base and merge latest first; another PR may have already fixed it.
6. **Greptile and threads.** Confirm Greptile reviewed the current head, then address and resolve per `references/greptile-loop.md`. Its output shape varies by installation, so follow that reference rather than assuming a check run exists. Sweep threads from every author, not only Greptile.
7. **Re-run the panel** whenever the code changed materially since step 1.

#### Review panel

`reviewer-gpt` (always), `reviewer-security` (on any trust boundary), and `reviewer-claude` (on real blast radius) run as fresh-context subagents, plus `deslop` and `verification-before-completion` in the parent. `references/review-panel.md` carries the exact invocation forms, brief contents, and the sign-off bar; read it before the first launch.

#### Triage verdicts

Give every finding one verdict, and record which:

- **Fix** — valid and in scope. Change the code.
- **Rebut** — wrong, or right about a pattern the repo deliberately uses. Write the reasoning. Never silently drop it. Rebutting a **blocking** finding does not clear it: rerun that reviewer with the rebuttal in the brief, and treat only its own withdrawal as sign-off.
- **Defer** — valid but outside the approved direction. Leave this diff alone. In the main run, record it for the Phase 6 chain. Inside a chain item, never queue it: file it or report it. Only what the chain will not reach becomes a ticket — on real WorkOS work a linked Linear issue in the relevant project, assigned to the user or left unassigned, never to an automation you picked. Anything you would not bet on getting done is **accepted debt**: say so in the report instead of laundering it through a ticket.

Two reviewers disagreeing is signal, not noise. The code is usually ambiguous enough to be worth clarifying regardless of who is right.

#### Exit conditions

Leave the loop only when all of these hold against the current head SHA:

- `reviewer-gpt` reports no blocking findings.
- `reviewer-security` and `reviewer-claude` each either signed off on the diff you are shipping, after their last requested change, or were skipped under the risk rule with the reason recorded in the report.
- The diff is free of AI narration and debug leftovers, and the verification pass reproduced the green claim with fresh output.
- CI is green on a head that contains the current base tip, and the PR is mergeable with no conflicts.
- Greptile is at 5/5 confidence on this head, read from a bot-authored source. Two alternatives are legitimate, and both are reported as unavailable rather than passed: the app is not installed on this repo, or it reviewed the head but published no score any bot-authored source carries. Never infer a score from the PR body.
- Zero unresolved review threads from any author, and every PR-level comment addressed. Threads and issue comments are separate surfaces; check both.
- Any linked Linear issue is current.

Passing tests alone is never sign-off. On hitting the cap, stop and report remaining findings, what you tried, and the recommended next step.

### Phase 5 — Merge

Standing instruction from the user, verbatim:

> When the PR is merge ready you may merge. I am repo admin so I am able to squash and merge. Thank you.

Default: **squash-merge without asking again** once the Phase 4 exit conditions are verified. This is standing pre-authorization.

Override: if the user says anywhere in the conversation to wait for their approval before merging, that overrides the default for the rest of the run. Report merge-ready and stop.

Follow `references/merge-gate.md` for the mechanics: the base freshness gate, the SHA-bound merge command, the post-merge smoke check, and cleanup. Then deliver the **Ship report**.

### Phase 6 — Follow-up chain

Deferred findings are work the run already judged valid, deferred only for scope. Agent labor is not scarce, so they do not wait for a human to rediscover a ticket: after the merge lands and cleanup finishes, announce the chain — this run's deferrals in ranked order — and execute it. Each item gets its own slug, worktree, branch, and PR through the full Phase 3→5 pipeline: same panel, same Greptile, same exit conditions, same standing merge authorization. No per-item permission — but only the direction gate is waived. Every other confirmation and stop rule stays live for each chain item, including the non-WorkOS PR confirmation and the dotfiles stop. The announcement is the interrupt point, and a "wait" or "stop" ends the chain for the rest of the run.

Bounds that keep it finite:

- Only deferrals recorded by the main run enter the chain. Deferrals discovered *while working a chain item* are filed or reported, never queued — the chain must not grow while it runs.
- Skip any item whose implementation reveals it was misjudged; report that instead of forcing a diff.
- A gate failure inside a chain item ends the chain: report what shipped, what remains, and why.

End the chain with a closing report: one line per item — shipped PR, skipped as misjudged, ended on gate failure, filed, or accepted debt. The deeper the chain runs, the less human intent it carries; the announcement and the closing report are what keep it honest.

## Available scripts

**pr_signals.sh**: poll a PR's CI checks until they settle. Read-only. Call it by absolute path, since the working directory is the worktree. It does not evaluate Greptile — some installs produce no Greptile check, and the rollup hides the producing app — so that gate lives in `references/greptile-loop.md`.

Resolve `scripts/pr_signals.sh` from this skill directory before invoking it:

```bash
GH_BIN=gh-work <skill-dir>/scripts/pr_signals.sh <PR>
GH_BIN=gh-work MAX_WAIT_SECONDS=1800 <skill-dir>/scripts/pr_signals.sh <PR>
```

Exit codes: `0` every check completed successfully on an open PR, `1` a check failed, `2` timed out with checks running, `3` setup problem, `4` settled but signals are missing or unknown, meaning zero checks reported, an unknown conclusion, or a PR that is not open. The script prints the head SHA; bind every claim to it.

**test_pr_signals.sh**: mocked check of every exit path. Run it after editing `pr_signals.sh`.

## Reference loading

- Read `references/review-panel.md` before Phase 4. It carries the exact subagent invocation forms and the sign-off bar.
- Read `references/greptile-loop.md` when waiting on Greptile, reading its verdict, or sweeping unresolved threads.
- Read `references/merge-gate.md` when Phase 4 exits, before merging.
- Read `references/merge-gate.md` only after merge is authorized.

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

Then ask for the direction choice with `ask_question`.

## Ship report

Title it `Shipped` once merged. Under the wait-for-approval override, title it `Merge-ready` and stop.

```markdown
## [Shipped|Merge-ready]: [PR title] ([#N](url))

**Direction taken** — [what the user approved]
**Change** — [what actually landed, in two or three lines]
**Head verified** — [SHA the gates below were checked against]

| Gate | Result |
| --- | --- |
| Panel | [cycles run, findings fixed, findings rebutted] |
| CI | [green, and what ran] |
| Greptile | [confidence, threads resolved] |
| Threads | [unresolved count across all authors] |
| Linear | [issue and state, or "none"] |
| Merge | [squash-merged and smoke-checked / merge-ready, awaiting your go] |

**Skipped or deferred validation** — [each pass not run, with the reason, or "none"]
**Rebutted findings** — [each one, with the reasoning, or "none"]
**Follow-up chain** — [items queued for the chain, or "none"; per-item outcomes land in the chain's closing report]
```

## Gotchas

- **A settled check is not a passing check.** A completed run with an empty conclusion is unknown, not green, and a `SKIPPED` or `NEUTRAL` Greptile run produced no review.
- **A clean merge is not a working merge.** Git reports a conflict only when both sides touch the same lines. A renamed function, a new required field, a tightened lint rule, or a new test all merge cleanly and fail afterward. Prove compatibility by testing the merged result.
- **A fresh worktree is not a working checkout.** Ignored files and dependencies are missing until you restore them.
- **Draft PRs do not run all checks** in some repos, and a draft never becomes mergeable. Mark ready early.
- **Automated reviewers produce false positives.** Validate before acting; an unjustified "fix" is worse than a rebuttal.
- **`--delete-branch` does not remove the worktree or the local branch.** Remove both explicitly, from the main checkout.

## Stop rules

Stop and hand back when: the direction gate has not been answered; a review finding reveals the approved plan is wrong; a Phase 4 loop hits its cap; CI fails for reasons outside this PR's scope; the required GitHub alias is unavailable; or merging would require weakening a gate.

Stop before Phase 0 when the target repository is the home dotfiles checkout, where `$HOME` is the repository root. Worktree and branch operations there are governed by separate standing prohibitions. Report the conflict and ask how to proceed.

## Anti-patterns

- Implementing during Phase 1 because the fix seemed obvious.
- Presenting five equal options instead of one ranked recommendation.
- Substituting an inline self-review for the fresh-context reviewer gate.
- Expanding the diff with unrelated cleanup discovered mid-implementation.
- Looping on Greptile forever chasing 5/5 on subjective comments instead of reporting at the cap.
