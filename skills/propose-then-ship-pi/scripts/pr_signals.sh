#!/usr/bin/env bash
# Poll a PR's CI checks until they settle.
# Read-only: never comments, pushes, resolves, or merges.
#
# Scope: required CI checks only. Advisory automated reviewers such as Greptile
# never affect this script's result.
set -uo pipefail

GH_BIN="${GH_BIN:-}"
MAX_WAIT="${MAX_WAIT_SECONDS:-900}"
INTERVAL="${POLL_INTERVAL_SECONDS:-15}"

usage() {
  cat <<'EOF'
Usage: pr_signals.sh [PR_NUMBER]

Polls required CI checks for PR_NUMBER (default: the PR for the current branch)
until every check completes or the wait budget is exhausted. Advisory automated
reviewers such as Greptile never affect ship readiness.

Env:
  GH_BIN                 required. The gh alias for this repository, gh-work or
                         gh-personal. There is no default: a bare gh can be
                         authenticated as the wrong account.
  MAX_WAIT_SECONDS       total wait budget in seconds (default 900)
  POLL_INTERVAL_SECONDS  seconds between polls (default 15, minimum 1)

Exit codes:
  0  every check completed successfully on an open PR
  1  at least one check failed, even if others were still running at timeout
  2  timed out with checks still running and none failed yet
  3  setup problem (missing dependency, bad env value, no PR, not a repo)
  4  settled, but signals are missing or unknown (no checks reported, an
     unknown conclusion, or a PR that is not open)

The wait budget is a cap, not a floor: the final sleep is trimmed so a small
MAX_WAIT_SECONDS is honored even when it is below the poll interval.
EOF
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
esac

for var in MAX_WAIT INTERVAL; do
  case "${!var}" in
    '' | *[!0-9]*)
      echo "pr_signals: $var must be a non-negative integer" >&2
      exit 3
      ;;
  esac
done
if [ "$INTERVAL" -lt 1 ]; then
  echo "pr_signals: POLL_INTERVAL_SECONDS must be at least 1" >&2
  exit 3
fi

if [ -z "$GH_BIN" ]; then
  echo "pr_signals: set GH_BIN to this repository's gh alias (gh-work or gh-personal)" >&2
  exit 3
fi
if ! command -v "$GH_BIN" >/dev/null 2>&1; then
  echo "pr_signals: missing required gh executable '$GH_BIN'" >&2
  exit 3
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "pr_signals: missing required dependency 'jq'" >&2
  exit 3
fi

PR="${1:-}"
if [ -z "$PR" ]; then
  PR=$("$GH_BIN" pr view --json number -q .number 2>/dev/null) || {
    echo "pr_signals: no PR found for the current branch; pass a PR number" >&2
    exit 3
  }
fi

# Normalizes both CheckRun and StatusContext rollup entries into {name,state}.
NORMALIZE='
  [ .statusCheckRollup[]? |
    if .__typename == "CheckRun" then
      # gh returns conclusion as "" (not null) while a check runs, so jq //
      # cannot be relied on here.
      { name: (.name // "check"),
        state: (if (.status // "") != "COMPLETED" then "PENDING"
                elif (.conclusion // "") == "" then "UNKNOWN"
                else .conclusion end) }
    else
      { name: (.context // .name // "status"), state: (.state // "PENDING") }
    end
    | select((.name | test("greptile"; "i")) | not)
  ]'

PENDING_STATES='["PENDING","QUEUED","IN_PROGRESS","WAITING","EXPECTED","REQUESTED"]'
FAILED_STATES='["FAILURE","ERROR","TIMED_OUT","CANCELLED","ACTION_REQUIRED","STARTUP_FAILURE","STALE"]'
SUCCESS_STATES='["SUCCESS","NEUTRAL","SKIPPED"]'

elapsed=0
settled_note=""
while :; do
  view=$("$GH_BIN" pr view "$PR" --json number,url,state,isDraft,mergeable,mergeStateStatus,headRefOid,statusCheckRollup 2>/dev/null) || {
    echo "pr_signals: could not read PR #$PR" >&2
    exit 3
  }

  read -r pending failed unknown total <<<"$(
    jq -r "$NORMALIZE"' as $c
      | [ ($c | map(select(.state as $s | '"$PENDING_STATES"' | index($s))) | length),
          ($c | map(select(.state as $s | '"$FAILED_STATES"'  | index($s))) | length),
          ($c | map(select(.state as $s | ('"$PENDING_STATES"' + '"$FAILED_STATES"' + '"$SUCCESS_STATES"') | index($s) | not)) | length),
          ($c | length) ]
      | @tsv' <<<"$view"
  )"

  pr_state=$(jq -r '.state // "UNKNOWN"' <<<"$view")

  if [ "$pending" -eq 0 ]; then
    break
  fi

  # A closed or merged PR can carry checks that never complete. Never wait on it.
  if [ "$pr_state" != "OPEN" ]; then
    settled_note="PR is ${pr_state}; did not wait on ${pending} unfinished check(s)."
    break
  fi

  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "pr_signals: timed out after ${elapsed}s with ${pending}/${total} check(s) still running" >&2
    jq -r "$NORMALIZE"' | .[] | "  \(.state)\t\(.name)"' <<<"$view" >&2
    # A confirmed failure outranks the timeout: exit 1 so the caller acts on it.
    [ "$failed" -gt 0 ] && exit 1
    exit 2
  fi

  echo "waiting: ${pending}/${total} check(s) running (${elapsed}s elapsed)"
  remaining=$((MAX_WAIT - elapsed))
  step=$INTERVAL
  [ "$remaining" -lt "$step" ] && step=$remaining
  sleep "$step"
  elapsed=$((elapsed + step))
done

url=$(jq -r '.url' <<<"$view")
head=$(jq -r '.headRefOid // "unknown"' <<<"$view")
draft=$(jq -r 'if .isDraft then "yes" else "no" end' <<<"$view")
mergeable=$(jq -r '.mergeable // "UNKNOWN"' <<<"$view")
merge_state=$(jq -r '.mergeStateStatus // "UNKNOWN"' <<<"$view")

incomplete=""
note_gap() { incomplete="${incomplete}  - $1"$'\n'; }
[ "$total" -gt 0 ] || note_gap "no checks reported"
[ "$unknown" -eq 0 ] || note_gap "${unknown} check(s) in an unknown state"
[ "$pending" -eq 0 ] || note_gap "${pending} check(s) never finished"
[ "$pr_state" = "OPEN" ] || note_gap "PR is ${pr_state}"

echo
echo "PR #${PR} — ${url}"
echo "  gh:        ${GH_BIN}"
echo "  head:      ${head}"
echo "  state:     ${pr_state}"
echo "  checks:    ${total} total, ${failed} failed, ${unknown} unknown, ${pending} unfinished"
echo "  draft:     ${draft}"
echo "  mergeable: ${mergeable} (${merge_state})"
[ -n "$settled_note" ] && echo "  note:      ${settled_note}"
echo
jq -r "$NORMALIZE"' | .[] | "  \(.state)\t\(.name)"' <<<"$view"

if [ "$failed" -gt 0 ]; then
  exit 1
fi

if [ -n "$incomplete" ]; then
  echo
  echo "pr_signals: signals incomplete on ${head}" >&2
  printf '%s' "$incomplete" >&2
  exit 4
fi

exit 0
