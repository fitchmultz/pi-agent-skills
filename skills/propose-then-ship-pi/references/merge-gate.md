# Merge Gate

Read when Phase 4 exits and the current user has authorized merge. Honor Mitch's applicable standing approval without asking again; the historical quotation in SKILL.md does not authorize unrelated users. Under an explicit wait-for-approval override, stop at Merge-ready. Deployment preflight can still require separate release/production authorization. Replace `<gh>` with the executable verified under the current user's account policy.

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

- **Nothing intersects.** Push, then refresh CI, mergeability, draft state, and other exact-head gates. Reuse review results whose analyzed behavior remains unchanged.
- **Something intersects.** Run targeted checks against the combined result first. If reviewed behavior is unchanged, refresh the same gates without repeating unaffected reviews. If conflict resolution or other edits invalidate analysis, commit, push, and return to Phase 4 for affected or explicitly required reviews.

A mechanical base sync changes the SHA without invalidating analysis of unchanged content or the UX verdict for unchanged user-visible behavior. Refresh CI and other commit-bound evidence on the new SHA. Greptile remains advisory; never wait for or trigger it. Do not use auto-merge to bypass an explicitly required review or unresolved valid blocker.

Re-check the commit count before merging. Continue while fresh evidence supports progress; if base churn prevents completing the gates, report that concrete blocker and the next action rather than lowering the bar.

`<gh> pr view <PR> --json mergeStateStatus` returns `BEHIND` only where the repo requires branches to be up to date. Elsewhere a stale branch still reports `CLEAN`, so trust the commit count.

## Merge

Run one final gate check immediately before merging. Authorization may arrive long after Phase 4 finished. Before merging, inspect the repository's deployment configuration and determine whether merge itself triggers deployment. If that trigger can publish or release an external artifact or perform production control outside the repository's defined deployment, obtain explicit authorization before merge; never merge first and ask afterward. Re-check head SHA, mergeability, draft state, required checks, completion of required reviews and resolution of actionable findings for the current content, the current UX-impact verdict, blocking human or required-reviewer feedback, and any Greptile comments already present in the same pass. A mechanical base sync may carry review results and the UX verdict across SHAs after confirming unchanged relevant behavior; substantive conflict resolution needs affected review. Evidence-backed owner rebuttals resolve incorrect, out-of-scope, or approved-behavior-conflicting agent findings without originating reviewer agreement, while actual repository protections and required human approvals remain binding. Fix or rebut present actionable Greptile comments, but never wait for acknowledgment or re-review. Reuse older evidence only when its relevant inputs demonstrably remain valid.

Bind the merge to the SHA you verified, so a push that lands between the check and the merge aborts instead of shipping unreviewed:

```bash
<gh> pr merge <PR> --squash --match-head-commit <verified-SHA>
```

## After the merge

1. Confirm the merge actually landed: `<gh> pr view <PR> --json state,mergedAt,mergeCommit`.
2. Run a bounded smoke check relevant to the change before claiming the end state is good.
3. Run or verify the repository's own defined deployment when applicable user or repository instructions define one and the Phase 4 exit conditions have passed. Record the result with the Ship report Deployment states. If the deployment publishes or releases an external artifact, or requires production control outside the defined deployment, stop for explicit authorization instead of treating merge permission as release permission.
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
