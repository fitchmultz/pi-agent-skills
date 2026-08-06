#!/usr/bin/env bash
# Mocked check of every pr_signals.sh exit path. No network, no gh, no PR.
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TARGET="$HERE/pr_signals.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat >"$TMP/gh" <<'MOCK'
#!/usr/bin/env bash
check() { printf '{"__typename":"CheckRun","name":"%s","status":"%s","conclusion":"%s"}' "$1" "$2" "$3"; }
pr() { printf '{"number":1,"url":"https://example.test/pr/1","state":"%s","isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","headRefOid":"deadbeef","statusCheckRollup":[%s]}' "$1" "$2"; }
case "${MOCK_CASE:-}" in
  green)       pr OPEN   "$(check ci COMPLETED SUCCESS),$(check lint COMPLETED SUCCESS)" ;;
  failing)     pr OPEN   "$(check ci COMPLETED FAILURE),$(check lint COMPLETED SUCCESS)" ;;
  no_checks)   pr OPEN   "" ;;
  closed_ok)   pr CLOSED "$(check ci COMPLETED SUCCESS),$(check lint COMPLETED SUCCESS)" ;;
  closed_run)  pr CLOSED "$(check ci IN_PROGRESS ''),$(check lint COMPLETED SUCCESS)" ;;
  neutral)     pr OPEN   "$(check ci COMPLETED NEUTRAL),$(check lint COMPLETED SKIPPED)" ;;
  unknown)     pr OPEN   "$(check ci COMPLETED ''),$(check lint COMPLETED SUCCESS)" ;;
  running)     pr OPEN   "$(check ci IN_PROGRESS ''),$(check lint COMPLETED SUCCESS)" ;;
  fail_run)    pr OPEN   "$(check ci COMPLETED FAILURE),$(check lint IN_PROGRESS '')" ;;
  *) exit 1 ;;
esac
MOCK
chmod +x "$TMP/gh"

fails=0
expect() { # expect <label> <want-exit> <env-assignments...>
  local label=$1 want=$2
  shift 2
  local got
  env GH_BIN="$TMP/gh" POLL_INTERVAL_SECONDS=1 MAX_WAIT_SECONDS=1 "$@" "$TARGET" 1 >/dev/null 2>&1
  got=$?
  if [ "$got" -eq "$want" ]; then
    printf 'ok   %-28s exit=%s\n' "$label" "$got"
  else
    printf 'FAIL %-28s want=%s got=%s\n' "$label" "$want" "$got"
    fails=$((fails + 1))
  fi
}

# Each case must isolate one guard. If two conditions both yield exit 4, removing
# either guard still passes, and the test proves nothing about that guard.
expect "all green"               0 MOCK_CASE=green
expect "check failed"            1 MOCK_CASE=failing
expect "no checks at all"        4 MOCK_CASE=no_checks
expect "closed pr, else green"   4 MOCK_CASE=closed_ok
expect "neutral and skipped settled"  0 MOCK_CASE=neutral
expect "completed but unknown"   4 MOCK_CASE=unknown
expect "still running, no wait"  2 MOCK_CASE=running MAX_WAIT_SECONDS=0
expect "failure outranks timeout" 1 MOCK_CASE=fail_run MAX_WAIT_SECONDS=0
expect "bad poll interval"       3 MOCK_CASE=green POLL_INTERVAL_SECONDS=0
expect "gh unset"                3 MOCK_CASE=green GH_BIN=
expect "gh not executable"       3 MOCK_CASE=green GH_BIN=/nonexistent/gh

# The unfinished-check guard only fires alongside the PR-state guard, so no exit
# code can isolate it. Its value is the diagnostic line, so assert on that.
expect_msg() { # expect_msg <label> <substring> <env-assignments...>
  local label=$1 want=$2
  shift 2
  local out
  out=$(env GH_BIN="$TMP/gh" POLL_INTERVAL_SECONDS=1 MAX_WAIT_SECONDS=1 "$@" "$TARGET" 1 2>&1)
  if printf '%s' "$out" | grep -q -- "$want"; then
    printf 'ok   %-28s says %s\n' "$label" "$want"
  else
    printf 'FAIL %-28s missing %s\n' "$label" "$want"
    fails=$((fails + 1))
  fi
}

expect_msg "closed pr reports hang"  "never finished" MOCK_CASE=closed_run

echo
if [ "$fails" -eq 0 ]; then
  echo "pr_signals: all exit paths behave as documented"
  exit 0
fi
echo "pr_signals: ${fails} exit path(s) wrong"
exit 1
