# Greptile Loop

Read when waiting on Greptile, reading its verdict, or sweeping unresolved threads. Target state: **5/5 confidence on the current head, zero unresolved threads from any author.**

Replace `<gh>` with the alias you resolved from the remote owner, `gh-work` or `gh-personal`. Never run bare `gh`.

## Apply the recorded gate policy

Greptile defaults to `required`. Under an explicitly sourced `waived-if-unavailable` policy, first confirm that the app/review surface is unavailable. Record the waiver source and stop Greptile polling; the waiver does not waive the thread and comment sweep from other authors.

Any current-head Greptile signal establishes availability, so complete the normal verdict, score, finding, and resolution flow below. A failed review, a score below 5/5, or a reviewed head with no verifiable score is not an unavailable service and cannot use the absent-service waiver. Never infer policy from missing output alone.

## Greptile's output shape varies by deployment

Verified against two live installations. Do not assume one shape:

| Surface | workos/horizon | Other installs |
| --- | --- | --- |
| Check run | none | `Greptile Review`, app slug `greptile-apps` |
| Formal review | posted, `commit_id` set, **body empty** | posted, body may be empty |
| Summary issue comment | `<h3>Greptile Summary</h3>` with `Confidence Score: N/5`, edited in place | may be absent |
| PR body | not used | sometimes the only place a score appears |

Two consequences. First, **never gate on a check run alone**: the primary repo produces none, so requiring one deadlocks. Second, **never read the score from the PR body**, which is author-owned and carries no commit binding, so an edit replays an old score. When the score exists only there, treat it as unavailable and report it.

## Match the author exactly

A substring test such as `test("greptile"; "i")` matches an ordinary user account. A real account named `greptile-apps` exists and is type `User`. Anyone who can comment could otherwise post a `5/5` and clear the gate.

Use this anchored pattern plus the type check. GitHub logins cannot contain brackets, so the `[bot]` suffix is unforgeable, and the pattern accepts only the three vendor apps (`greptile-apps`, `greptile-apps-staging`, `greptile`, all owned by `greptileai`):

```jq
select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
```

Note that `gh api --jq` takes a single expression and does not accept `--arg`. To pass a variable, pipe to `jq` instead: `<gh> api ... | jq --arg s "<SHA>" '...'`.

## 0. Pin the head

Every verdict is valid for exactly one commit. Read the head SHA, use it in every query, and confirm it did not move before acting.

```bash
<gh> pr view <PR> --json headRefOid,state,isDraft -q .headRefOid
```

Call that value `SHA` and write it literally below.

## 1. Confirm Greptile reviewed this head

Two signals exist, with strict precedence: **when any Greptile check run exists on this commit, its latest attempt is authoritative**, and older formal-review evidence cannot override it. The formal review is the fallback for installs that produce no check runs at all. Whichever signal decides also supplies the timestamp floor for step 2.

```bash
# a) The LATEST Greptile check run on this commit, if the install produces one.
#    Slurp all pages BEFORE sorting: `--paginate --jq` runs the filter once per
#    page, so a per-page `sort | last` emits one winner per page and an older
#    success on another page could resurface. Judge only the newest attempt:
#    pre-filtering for success would let an older green run supply the floor
#    while a newer rerun is running or failed.
<gh> api --paginate "repos/{owner}/{repo}/commits/<SHA>/check-runs?per_page=100" \
| jq -s '[.[].check_runs[] | select(.app.owner.login == "greptileai")]
         | sort_by(.started_at) | last
         | if . == null then empty else {slug:.app.slug, name, status, conclusion, floor:.completed_at} end'

# b) Fallback, only when a) returns nothing at all: a formal review bound to
#    this commit. The body is often empty; its value here is the commit binding
#    and the timestamp.
<gh> api --paginate "repos/{owner}/{repo}/pulls/<PR>/reviews?per_page=100" \
  | jq --arg s "<SHA>" '.[] | select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
        | select(.commit_id == $s) | {floor:.submitted_at, state}'
```

Accept the check-run signal only when that latest attempt has `status == "completed"`, `conclusion == "success"`, and a non-null `floor`. A latest attempt that is queued or in progress means wait, then re-query. One that completed without `success` means the review errored: the head is not reviewed, so re-summon or report. Never fall back to an older attempt's verdict, even a successful one on the same SHA. Neither query returning anything means Greptile has not reviewed this head. Reviews automatically on push unless `greptile.json` sets `skipReview: "AUTOMATIC"`. Before summoning again, confirm nothing is already running, then:

```bash
<gh> pr comment <PR> --body "@greptile-apps review"
```

Record the earliest `floor` you found. If polling times out, report the timeout. Never proceed on a missing or stale review.

## 2. Read the score

Trusted sources only: bot-authored review bodies bound to `<SHA>`, and bot-authored issue comments updated at or after `floor`.

**Select by score presence, not by recency alone.** Greptile also posts conversational replies that are newer than the summary. A reply can even quote a score ("the prior 5/5 result"), so filter on the full `Confidence Score:` label, not on any `N/5` fragment, before sorting.

```bash
{
  <gh> api --paginate "repos/{owner}/{repo}/issues/<PR>/comments?per_page=100" \
    --jq '.[] | select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
          | {src:"comment", updated_at, body}'
  <gh> api --paginate "repos/{owner}/{repo}/pulls/<PR>/reviews?per_page=100" \
    --jq '.[] | select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
          | {src:"review", updated_at:.submitted_at, commit_id, body}'
} | jq -s --arg floor '<floor>' --arg s '<SHA>' '
      [ .[]
        | select(.src == "review" and .commit_id == $s or .src == "comment" and .updated_at >= $floor)
        | select(.body != null and (.body | test("Confidence [Ss]core:? ?[0-5] ?/ ?5")))
      ] | sort_by(.updated_at) | last'
```

Extract the score from that same labeled phrase. Sort by `updated_at`, never `created_at`: Greptile edits the summary in place, so the newest score usually lives in an older comment.

**If Greptile reviewed the head but no trusted source carries a score**, that is a named state, not a pass and not a silent skip. Report it as "reviewed, score unavailable from a verifiable source", note that the PR body may hold one but cannot be attributed, and let the user decide. Do not infer a passing score.

## 3. Collect the work

```bash
<gh> api --paginate "repos/{owner}/{repo}/pulls/<PR>/comments?per_page=100" \
  --jq '.[] | select(.user.type == "Bot" and (.user.login | test("^greptile(-apps(-staging)?)?\\[bot\\]$")))
        | {path, line, id, commit_id, body}'
```

Also carry forward actionable items from the summary's **"Prompt to fix all with AI"** section. It can list real work when the inline endpoint returns nothing.

## 4. Fix and resolve

Read each comment in context, then fix it or classify it as informational or a false positive. Resolve a thread only after the underlying issue is fixed. Pure noise may be resolved without a code change, but leave a one-line reason on the thread and repeat it in your report. Never resolve an unfixed substantive thread to clear the count.

Fetch unresolved threads from every author, not only Greptile; the exit gate counts all of them. `--paginate` needs the `$endCursor` variable and the `pageInfo` block, or you silently review only the first 100.

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

Resolve addressed ones, batching several mutations per request:

```bash
<gh> api graphql -f query='
mutation {
  t1: resolveReviewThread(input:{threadId:"<ID1>"}) { thread { isResolved } }
  t2: resolveReviewThread(input:{threadId:"<ID2>"}) { thread { isResolved } }
}'
```

Then commit, push, and return to step 0. The new push creates a new head, so the previous verdict no longer counts.

## 5. Re-pin, then exit

Read the head SHA again. If it moved, a push landed mid-loop: discard this verdict and restart from step 0.

```bash
<gh> pr view <PR> --json headRefOid -q .headRefOid   # must still equal <SHA>
```

Stop when the score is 5/5 on the confirmed head and the unresolved-thread query returns nothing, or at the Phase 4 cycle cap. On cap, report the score and list what remains.

## Gotchas

- **No comment does not mean no review.** Greptile stopped posting a "found nothing" confirmation. Confirm through step 1.
- **A repo can have Greptile uninstalled.** If neither signal ever appears, confirm availability before spending the polling budget. With the default `required` policy, report the gate as unavailable and treat the PR as not merge-ready. With a cited `waived-if-unavailable` policy, record the waiver and continue only after the other gates and the full thread/comment sweep pass.
- **Subjective comments do not always reach 5/5.** Rebut with reasoning and report at the cap instead of reshaping code to chase a score.
- **Force-pushing mid-review** orphans threads and restarts the cycle. Push forward commits during the loop.
