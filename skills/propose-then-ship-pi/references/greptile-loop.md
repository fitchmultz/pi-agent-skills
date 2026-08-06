# Greptile Loop

Read when waiting on Greptile, reading its verdict, or sweeping unresolved threads. Target state: **the bot-authored summary footer names the current head, every actionable finding is addressed, and no review thread remains unresolved.** Strive for 5/5 confidence, but the score is not a blocking gate.

The score is advisory; the feedback is not. Every substantive Greptile comment must be fixed or rebutted, and a lower score never excuses unresolved actionable feedback.

Replace `<gh>` with the alias resolved from the remote owner, `gh-work` or `gh-personal`. Never run bare `gh`.

## Apply the recorded gate policy

Greptile defaults to `required`. Under an explicitly sourced `waived-if-unavailable` policy, first confirm that the app/review surface is unavailable. Record the waiver source and stop Greptile polling; the waiver does not waive the thread and comment sweep from other authors.

Any current-head Greptile signal establishes availability. A failed review, stale summary footer, or unresolved finding is incomplete work, not an unavailable service. Never infer a waiver from missing output alone.

## Trust the bot, not lookalikes

A substring test such as `test("greptile"; "i")` matches ordinary user accounts. Require `user.type == "Bot"` and the bracketed bot login:

```jq
select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
```

GitHub users cannot register the `[bot]` suffix. This keeps a user-authored comment from satisfying the gate.

## 0. Pin the head

Every verdict is valid for one commit. Read the head SHA, use it in every comparison, and confirm it did not move before acting:

```bash
<gh> pr view <PR> --json headRefOid,state,isDraft -q .headRefOid
```

Call that value `SHA` and write it literally below.

## 1. Wait for the edited summary

Greptile automatically reviews each pushed commit and edits its original summary comment. Do not tag Greptile as a normal step after pushing. Read the bot-authored summary and its footer:

```bash
<gh> api --paginate "repos/{owner}/{repo}/issues/<PR>/comments?per_page=100" \
  --jq '.[] | select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
        | {id, updated_at, body}'
```

The footer's last-reviewed commit must equal `SHA` or be an unambiguous prefix of it. An older score, formal review, inline comment, or check run does not override a stale footer. If the footer names an older commit, wait and re-query; a push normally schedules the review automatically.

A manual retry is optional, not part of the normal loop. If the agent deliberately chooses to request one after an abnormal delay, use the current account:

```bash
<gh> pr comment <PR> --body "@greptileai review"
```

Do not repeatedly summon Greptile while an automatic review may still be running. If one polling wait times out, record the stale footer, inspect current state, and start another bounded wait or do independent work. A polling timeout is not a run-level stop condition.

## 2. Read the score and collect actionable work

Read the confidence score from the bot summary when present and report it. Aim for 5/5, but a lower or unavailable score does not block once the footer matches `SHA` and all actionable feedback is resolved. Never change correct code solely to raise the score.

Collect inline Greptile comments:

```bash
<gh> api --paginate "repos/{owner}/{repo}/pulls/<PR>/comments?per_page=100" \
  --jq '.[] | select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
        | {path, line, id, commit_id, body}'
```

Also inspect actionable items in the summary's **Prompt to fix all with AI** section. It can contain real work when the inline endpoint returns nothing.

Give each actionable finding a verdict from `SKILL.md`: Fix, Rebut, Defer, File, or Block. A score alone is not a finding.

## 3. Sweep and resolve threads

Read each comment in context. Resolve a thread only after the issue is fixed or rebutted. Pure noise may be resolved without a code change, but leave a one-line reason. Never resolve an unfixed substantive thread to clear the count.

Fetch unresolved threads from every author, not only Greptile. `--paginate` needs the `$endCursor` variable and `pageInfo`, or it silently reviews only the first 100:

```bash
<gh> api graphql --paginate -f query='
query($owner:String!, $repo:String!, $pr:Int!, $endCursor:String) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$pr) {
      reviewThreads(first:100, after:$endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          comments(first:1) { nodes { body path author { login } } }
        }
      }
    }
  }
}' -F owner=<owner> -F repo=<repo> -F pr=<PR> \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'
```

Resolve addressed threads, batching several mutations per request:

```bash
<gh> api graphql -f query='
mutation {
  t1: resolveReviewThread(input:{threadId:"<ID1>"}) { thread { isResolved } }
  t2: resolveReviewThread(input:{threadId:"<ID2>"}) { thread { isResolved } }
}'
```

Sweep PR-level comments from every author too. Address actionable comments; informational bot summaries do not need a reply.

## 4. Push changes and let Greptile rerun

If a finding changes the diff, commit and push, then return to step 0. The push automatically schedules Greptile and the edited summary footer must advance to the new head. Do not add a routine summon comment.

## 5. Re-pin, then exit

Read the head SHA again. If it moved, discard the verdict and restart from step 0:

```bash
<gh> pr view <PR> --json headRefOid -q .headRefOid
```

Exit when the summary footer matches the confirmed head, every actionable finding and PR-level comment is addressed, and the unresolved-thread query returns nothing. Report the score, including a score below 5/5 or an unavailable score, without treating it as a blocker.

## Gotchas

- **The summary is edited in place.** Read its current body and footer; `created_at` is irrelevant.
- **No check run does not mean no review.** The summary footer is the commit binding.
- **A repo can have Greptile uninstalled.** Confirm availability before spending the polling budget. Under `required`, unavailable remains blocking; under a cited `waived-if-unavailable` policy, report the waiver and continue through the other gates and the full thread/comment sweep.
- **Force-pushing mid-review** orphans threads and restarts the cycle. Push forward commits during the loop.
