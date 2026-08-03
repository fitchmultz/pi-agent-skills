# Merge Gate

Read when Phase 4 exits. The standing authorization quoted in SKILL.md Phase 5 covers the merge; only the user's wait-for-approval override blocks it, and under that override you stop at Merge-ready instead of entering this gate. Replace `<gh>` with the alias you resolved from the remote owner.

## Base freshness

Verify the PR against the base as it exists now. A green run proves the code worked against the base it was tested on, and `mergeable` reports textual conflicts only.

```bash
cd <worktree> && git fetch origin "<base>" \
  && git rev-list --count "HEAD..origin/<base>"   # base commits missing from this branch
```

Zero means proceed to the merge. Otherwise weigh whether those base commits can reach this PR:

```bash
# Three dots: each side's own changes since the branch point.
cd <worktree> && comm -12 <(git diff --name-only "HEAD...origin/<base>" | sort) \
                          <(git diff --name-only "origin/<base>...HEAD" | sort)
```

Direct file overlap is the cheap signal. Base changes also reach a PR through a module it imports from, or through a shared surface such as a package manifest, lockfile, shared type, or lint and CI config. Judge those, since no file-name comparison catches them.

Bring base in with `git merge "origin/<base>"` or `<gh> pr update-branch --rebase`, then:

- **Nothing intersects.** Push, then return to Phase 4.
- **Something intersects.** Run the targeted checks that exercise the intersection against the merged result first, fix what broke, then push and let the PR's CI run the full suite while you re-clear the other gates. Return to Phase 4.

**Integrating base creates a new head, and every gate resets with it.** CI is not the only gate: the reviewer panel, Greptile, and the thread sweep all judged the previous head. Re-clear the full Phase 4 exit conditions on the new SHA. Never arm auto-merge to escape this, because GitHub's own conditions do not include the reviewer panel or Greptile confidence, so `--auto` can land a head no reviewer has seen.

Re-check the commit count before merging. Cap at 3 attempts. When base advances faster than you can re-clear the gates, stop and report the churn rather than lowering the bar.

`<gh> pr view <PR> --json mergeStateStatus` returns `BEHIND` only where the repo requires branches to be up to date. Elsewhere a stale branch still reports `CLEAN`, so trust the commit count.

## Merge

Run one full review of the exact head immediately before merging. Authorization may arrive long after Phase 4 finished, and prior sign-off covers only the SHA it examined. Re-check head SHA, mergeability, draft state, checks, reviews, and unresolved threads in the same pass. Anything older is a memory, not evidence.

Bind the merge to the SHA you verified, so a push that lands between the check and the merge aborts instead of shipping unreviewed:

```bash
<gh> pr merge <PR> --squash --delete-branch --match-head-commit <verified-SHA>
```

## After the merge

1. Confirm the merge actually landed: `<gh> pr view <PR> --json state,mergedAt,mergeCommit`.
2. Run a bounded smoke check relevant to the change before claiming the end state is good.
3. Clean up. Check for uncommitted work first with `git -C <worktree> status --short`, and never remove a worktree that still holds changes. Leave the worktree before removing it, or you delete your own working directory and every later command fails. `--delete-branch` removes the remote branch and `git worktree remove` removes the checkout; neither deletes the local branch.

```bash
MAIN=$(cd <worktree> && dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
cd "$MAIN" && git worktree remove <worktree> && git branch -D <slug>
```

4. Close the linked Linear issue when the real end state and team convention support closure.
