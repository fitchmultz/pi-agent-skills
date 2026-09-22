import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guide = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/merge-gate.md"), "utf8");

test("merge follows required review coverage and evidence-supported progress", () => {
  const baseGate = guide.split("## Base freshness\n")[1].split("## Merge\n")[0];
  const mergeGate = guide.split("## Merge\n")[1].split("## After the merge\n")[0];
  assert.match(baseGate, /Phase 4.*explicitly required reviews/i);
  assert.match(mergeGate, /completion of required reviews.*resolution of actionable findings/i);
  assert.match(baseGate, /Continue while .*evidence supports progress/i);
  assert.match(baseGate, /report .*concrete blocker.*next action/i);
  assert.doesNotMatch(guide, /wave rules|panel wave|panel-wave|Cap at 3 attempts/i);
  assert.match(guide, /wait-for-approval override, stop at Merge-ready/i);
  assert.match(guide, /Re-check head SHA, mergeability, draft state, required checks/i);
  assert.match(baseGate, /Refresh CI and other commit-bound evidence on the new SHA/i);
  assert.match(guide, /pr merge <PR> --squash --match-head-commit <verified-SHA>/);
});

test("merge and SHA-bound branch cleanup are separate ordered steps", () => {
  assert.doesNotMatch(guide, /pr merge[^\n]*--delete-branch/);
  assert.match(guide, /BRANCH=\$\(git -C <worktree> branch --show-current\)/);
  assert.match(guide, /--force-with-lease="refs\/heads\/\$BRANCH:<verified-SHA>"/);
  assert.match(guide, /git update-ref -d "refs\/heads\/\$BRANCH" "<verified-SHA>"/);
  assert.match(guide, /remote_status.*-eq 2/s);

  const confirm = guide.indexOf("--json state,mergedAt,mergeCommit");
  const capture = guide.indexOf("BRANCH=$(git -C <worktree>");
  const remoteDelete = guide.indexOf("git push origin --force-with-lease");
  const worktreeRemove = guide.indexOf("git worktree remove <worktree>");
  const localDelete = guide.indexOf('git update-ref -d "refs/heads/$BRANCH"');
  assert.ok(confirm >= 0 && confirm < capture && capture < remoteDelete);
  assert.ok(remoteDelete < worktreeRemove && worktreeRemove < localDelete);
});
