import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guide = readFileSync(path.join(root, "skills/propose-then-ship-pi/references/merge-gate.md"), "utf8");

test("merge and SHA-bound branch cleanup are separate ordered steps", () => {
  assert.doesNotMatch(guide, /pr merge[^\n]*--delete-branch/);
  assert.match(guide, /BRANCH=\$\(git -C <worktree> branch --show-current\)/);
  assert.match(guide, /--force-with-lease="refs\/heads\/\$BRANCH:<verified-SHA>"/);
  assert.match(guide, /git update-ref -d "refs\/heads\/\$BRANCH" "<verified-SHA>"/);
  assert.match(guide, /remote_status.*-eq 2/s);

  const confirm = guide.indexOf("Confirm the merge actually landed");
  const smoke = guide.indexOf("Run a bounded smoke check");
  const capture = guide.indexOf("BRANCH=$(git -C <worktree>");
  const remoteDelete = guide.indexOf("git push origin --force-with-lease");
  const worktreeRemove = guide.indexOf("git worktree remove <worktree>");
  const localDelete = guide.indexOf('git update-ref -d "refs/heads/$BRANCH"');
  assert.ok(confirm < smoke && smoke < capture && capture < remoteDelete);
  assert.ok(remoteDelete < worktreeRemove && worktreeRemove < localDelete);
});
