# Merge Gate

Read when Phase 4 exits. SKILL.md Phase 5 pre-authorizes merge and required normal deployment; a publish or release must be explicit in the approved direction within the user-aware approved outcome; only a scoped user wait or repository-defined external gate pauses it. Under a merge wait, preserve the PR at Merge-ready and resume this gate when the wait is lifted. Replace `<gh>` with the alias you resolved from the remote owner.

## Base freshness

Verify the PR against the base as it exists now. A green run proves the code worked against the base it was tested on, and `mergeable` reports textual conflicts only.

```bash
git -C <worktree> fetch origin "<base>" \
  && git -C <worktree> rev-list --count "HEAD..origin/<base>"   # base commits missing from this branch
```

Zero means proceed to the merge. Otherwise weigh whether those base commits can reach this PR:

```bash
# Three dots: each side's own changes since the branch point.
comm -12 <(git -C <worktree> diff --name-only "HEAD...origin/<base>" | sort) \
         <(git -C <worktree> diff --name-only "origin/<base>...HEAD" | sort)
```

Direct file overlap is the cheap signal. Base changes also reach a PR through a module it imports from, or through a shared surface such as a package manifest, lockfile, shared type, or lint and CI config. Judge those, since no file-name comparison catches them.

Bring base in with `git merge "origin/<base>"` or `<gh> pr update-branch --rebase`, then:

- **Nothing intersects.** Push, then return to Phase 4.
- **Something intersects.** Run the targeted checks that exercise the intersection against the merged result first, fix what broke, then push and let the PR's CI run the full suite while you re-clear the other gates. Return to Phase 4.

**Integrating base creates a new head, and every gate resets with it.** CI is not the only gate: the reviewer panel, Greptile, and the thread sweep all judged the previous head. Re-clear the full Phase 4 exit conditions on the new SHA. Never arm auto-merge to escape this, because GitHub's own conditions do not include the reviewer panel or Greptile confidence, so `--auto` can land a head no reviewer has seen.

Re-check the commit count before merging. There is no attempt cap: if base advances, integrate it and re-clear the gates again. Repeated churn is not permission to lower the bar or stop by count; stop only when a concrete external condition makes progress impossible and no independent approved work remains.

`<gh> pr view <PR> --json mergeStateStatus` returns `BEHIND` only where the repo requires branches to be up to date. Elsewhere a stale branch still reports `CLEAN`, so trust the commit count.

## Merge

Run one full review of the exact head immediately before merging. Authorization may arrive long after Phase 4 finished, and prior reviewer results cover only the SHA they examined. Re-check head SHA, mergeability, draft state, checks, reviews, and unresolved threads in the same pass. Anything older is a memory, not evidence.

Bind the merge to the SHA you verified, so a push that lands between the check and the merge aborts instead of shipping unreviewed:

```bash
<gh> pr merge <PR> --squash --match-head-commit <verified-SHA>
```

## After the merge

1. Confirm the merge actually landed: `<gh> pr view <PR> --json state,mergedAt,mergeCommit`.
2. Run the targeted post-merge validation against the confirmed merge commit, updated default branch, or delivered artifact—not only the stale pre-merge worktree—before claiming the end state is good. If it reveals an uncaught defect, regression, or polish gap, do not report `Shipped` or close the parent issue. Diagnose immediately and create the highest-priority completion-chain repair PR through the full implementation, review, merge, deployment, and validation loop; repeat until clean or a real stop rule applies.
3. Clean up only after the confirmed merge and successful post-merge validation. Check for uncommitted work first with `git -C <worktree> status --short`, and never remove a worktree that still holds changes. Capture the current branch from the worktree because its directory can retain an older provisional slug after a branch rename. Bind both branch deletions to the verified SHA so work pushed or committed during the smoke window is preserved instead of force-deleted.

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

4. Attach the merged PR to the linked Linear issue, but keep the parent issue active while any run-level acceptance criterion or completion-chain PR remains. Close or complete it only after the full approved outcome is verified and team convention supports closure.
