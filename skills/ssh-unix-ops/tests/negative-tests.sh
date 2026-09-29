#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./tests/negative-tests.sh --host user@example-host

Example: ./tests/negative-tests.sh --host user@example-host
Exit codes: 0 success/help; 2 argument refusal; other nonzero values indicate failed checks or commands.
EOF
}

HOST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  usage >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="$SCRIPT_DIR/scripts/ssh-unix-ops.py"
TMPDIR_LOCAL="$(mktemp -d "${TMPDIR:-/tmp}/ssh-unix-ops-negative.XXXXXX")"
trap 'rm -rf -- "$TMPDIR_LOCAL"' EXIT

REGULAR="$TMPDIR_LOCAL/data.bin"
SYMLINK="$TMPDIR_LOCAL/data.link"
ERR_OUT="$TMPDIR_LOCAL/err.out"
JSON_OUT="$TMPDIR_LOCAL/out.json"

echo 'payload' > "$REGULAR"
ln -s "$REGULAR" "$SYMLINK"

set +e
python3 "$HELPER" write --host "$HOST" --path /tmp/should-not-matter --mode nope >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq "invalid file mode" "$ERR_OUT"

set +e
python3 "$HELPER" sha256 --remote-path /tmp/example >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq -- '--host is required when using --remote-path' "$ERR_OUT"

set +e
python3 "$HELPER" sha256 --local-path "$SYMLINK" >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to hash local symlink path' "$ERR_OUT"

python3 "$HELPER" sha256 --local-path "$SYMLINK" --follow-symlinks --json > "$JSON_OUT"
python3 - <<'PY' "$JSON_OUT"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "sha256"
assert payload["scope"] == "local"
assert len(payload["sha256"]) == 64
PY

set +e
python3 "$HELPER" diff --host "$HOST" --remote-path /tmp/example >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'choose exactly one of --local-path, --stdin' "$ERR_OUT"

python3 "$HELPER" doctor --host "$HOST" --json > "$JSON_OUT"
python3 - <<'PY' "$JSON_OUT"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "doctor"
assert payload["noninteractive"] is True
assert "BatchMode=yes" in payload["sshOptions"]
assert payload["platform"]["isUnixLike"] is True
PY

printf 'negative-tests: ok\n'
