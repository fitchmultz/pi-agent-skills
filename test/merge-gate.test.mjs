import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guide = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/merge-gate.md"), "utf8");

test("merge follows required review coverage and evidence-supported progress", () => {
  assert.match(guide, /review policy in `references\/review-panel\.md`/i);
  assert.match(guide, /current required review coverage and its recorded requirement sources/i);
  assert.match(guide, /continue while evidence supports progress/i);
  assert.match(guide, /report a concrete blocker/i);
  assert.doesNotMatch(guide, /wave rules|panel wave|panel-wave|Cap at 3 attempts/i);
  assert.match(guide, /wait override, stop at Merge-ready/i);
  assert.match(guide, /Re-check head SHA, mergeability, draft state, required checks/i);
  assert.match(guide, /CI and other commit-bound evidence must still be refreshed on the new SHA/i);
  assert.match(guide, /pr merge <PR> --squash --match-head-commit <verified-SHA>/);
});

test("merge and SHA-bound branch cleanup are separate ordered steps", () => {
  assert.doesNotMatch(guide, /pr merge[^\n]*--delete-branch/);
  assert.match(guide, /BRANCH=\$\(git -C <worktree> branch --show-current\)/);
  assert.match(guide, /--force-with-lease="refs\/heads\/\$BRANCH:<verified-SHA>"/);
  assert.match(guide, /git update-ref -d "refs\/heads\/\$BRANCH" "<verified-SHA>"/);
  assert.match(guide, /remote_status.*-eq 2/s);
  assert.match(guide, /mechanical base sync changes the commit SHA but does not invalidate panel clearance/i);
  assert.match(guide, /substantive conflict resolution reopens review/i);
  assert.doesNotMatch(guide, /exact-head gates reset with it/i);
  assert.doesNotMatch(guide, /CI and the reviewer panel judged the previous head/i);

  const confirm = guide.indexOf("Confirm the merge actually landed");
  const smoke = guide.indexOf("Run a bounded smoke check");
  const capture = guide.indexOf("BRANCH=$(git -C <worktree>");
  const remoteDelete = guide.indexOf("git push origin --force-with-lease");
  const worktreeRemove = guide.indexOf("git worktree remove <worktree>");
  const localDelete = guide.indexOf('git update-ref -d "refs/heads/$BRANCH"');
  assert.ok(confirm < smoke && smoke < capture && capture < remoteDelete);
  assert.ok(remoteDelete < worktreeRemove && worktreeRemove < localDelete);
});
