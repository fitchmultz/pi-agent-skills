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

- **Nothing intersects.** Push, then refresh CI, mergeability, draft state, and other deterministic exact-head gates. Carry panel clearance forward because the reviewed content did not change.
- **Something intersects.** Run the targeted checks that exercise the intersection against the merged result first. If the reviewed content remains unchanged, push and refresh the same non-panel gates. If conflict resolution or another edit changes reviewed content, commit it, push it, and return to Phase 4 under the normal remediation or new-scope wave rules.

A mechanical base sync changes the commit SHA but does not invalidate panel clearance when the reviewed content is unchanged. CI and other commit-bound evidence must still be refreshed on the new SHA. Greptile remains automatic and advisory; never wait for or trigger it. Never arm auto-merge to escape a panel wave required by substantive changes, because GitHub's own conditions do not include that sign-off.

Re-check the commit count before merging. Cap at 3 attempts. When base advances faster than you can re-clear the gates, stop and report the churn rather than lowering the bar.

`<gh> pr view <PR> --json mergeStateStatus` returns `BEHIND` only where the repo requires branches to be up to date. Elsewhere a stale branch still reports `CLEAN`, so trust the commit count.

## Merge

Run one final gate check immediately before merging. Authorization may arrive long after Phase 4 finished. Re-check head SHA, mergeability, draft state, required checks, the panel-wave history required for the current content, blocking human or required-reviewer feedback, and any Greptile comments already present in the same pass. A mechanical base sync may carry panel clearance across SHAs only after confirming the reviewed content is unchanged; substantive conflict resolution reopens review. Fix or rebut present Greptile comments, but never wait for acknowledgment or re-review. Anything older is a memory, not evidence.

Bind the merge to the SHA you verified, so a push that lands between the check and the merge aborts instead of shipping unreviewed:

```bash
<gh> pr merge <PR> --squash --match-head-commit <verified-SHA>
```

## After the merge

1. Confirm the merge actually landed: `<gh> pr view <PR> --json state,mergedAt,mergeCommit`.
2. Run a bounded smoke check relevant to the change before claiming the end state is good.
3. Run or verify the repository's own defined deployment when applicable user or repository instructions define one and the Phase 4 ship gate has passed. Record `N/A` when no deployment is defined. If the deployment publishes or releases an external artifact, or requires production control outside the defined deployment, stop for explicit authorization instead of treating merge permission as release permission.
4. Clean up only after the confirmed merge, smoke check, and applicable deployment handling. Check for uncommitted work first with `git -C <worktree> status --short`, and never remove a worktree that still holds changes. Capture the current branch from the worktree because its directory can retain an older provisional slug after a branch rename. Bind both branch deletions to the verified SHA so work pushed or committed during the smoke window is preserved instead of force-deleted.

```bash
set -e
BRANCH=$(git -C <worktree> branch --show-current)
[[ -n "$BRANCH" ]]
[[ "$(git -C <worktree> rev-parse HEAD)" == "<verified-SHA>" ]]
MAIN=$(cd <worktree> && dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
cd "$MAIN"
if git ls-remote --exit-code --heads origin "refs/heads/$BRANCH" >/dev/null; then
  git push origin --force-with-lease="refs/heads/$BRANCH:<verified-SHA>" ":refs/heads/$BRANCH"
else
  remote_status=$?
  [[ "$remote_status" -eq 2 ]] || exit "$remote_status"
fi
git worktree remove <worktree>
git update-ref -d "refs/heads/$BRANCH" "<verified-SHA>"
```

Exit 2 from `git ls-remote --exit-code` means repository automation already removed the remote branch. Any other remote lookup or lease failure is a blocker, not proof that cleanup succeeded. Leave the local worktree or branch in place when a guard fails and report the advanced ref.

5. Close the linked Linear issue when the real end state and team convention support closure.
