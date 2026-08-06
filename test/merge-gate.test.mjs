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
  assert.match(guide, /keep the parent issue active while any run-level acceptance criterion or completion-chain PR remains/);
  assert.match(guide, /only after the full approved outcome is verified/);
  assert.match(guide, /There is no attempt cap/);
  assert.doesNotMatch(guide, /Cap at 3 attempts/);

  const confirm = guide.indexOf("Confirm the merge actually landed");
  const smoke = guide.indexOf("Run the targeted post-merge validation");
  const capture = guide.indexOf("BRANCH=$(git -C <worktree>");
  const remoteDelete = guide.indexOf("git push origin --force-with-lease");
  const worktreeRemove = guide.indexOf("git worktree remove <worktree>");
  const localDelete = guide.indexOf('git update-ref -d "refs/heads/$BRANCH"');
  assert.ok(confirm < smoke && smoke < capture && capture < remoteDelete);
  assert.ok(remoteDelete < worktreeRemove && worktreeRemove < localDelete);
  assert.match(guide, /create the highest-priority completion-chain repair PR/);
  assert.match(guide, /do not report `Shipped` or close the parent issue/);
});
