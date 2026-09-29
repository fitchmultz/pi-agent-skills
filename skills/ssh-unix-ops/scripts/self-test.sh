#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/self-test.sh --host user@example-host [--workdir /tmp/ssh-unix-ops-self-test-NAME]

--workdir must be an absolute remote scratch path matching:
  /tmp/ssh-unix-ops-self-test-[A-Za-z0-9._-]+
EOF
}

HOST=""
WORKDIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --workdir)
      WORKDIR="$2"
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

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/ssh-unix-ops.py"
WORKDIR="${WORKDIR:-/tmp/ssh-unix-ops-self-test-$$}"
if [[ ! "$WORKDIR" =~ ^/tmp/ssh-unix-ops-self-test-[A-Za-z0-9._-]+$ ]]; then
  echo "refusing unsafe --workdir: $WORKDIR" >&2
  echo "expected an absolute remote scratch path like /tmp/ssh-unix-ops-self-test-$USER" >&2
  exit 2
fi
QPATH="$WORKDIR/quote 'check'.txt"
CFG="$WORKDIR/config.env"
REAL_REMOTE="$WORKDIR/real.txt"
LINK_REMOTE="$WORKDIR/real-link.txt"
FIFO_REMOTE="$WORKDIR/pipe.fifo"
TREE_REMOTE="$WORKDIR/tree"
TREE_REMOTE_VERBOSE="$WORKDIR/tree-verbose"
BIN_REMOTE="$WORKDIR/payload.bin"
BIN_LINK_REMOTE="$WORKDIR/payload-link.bin"
BACKUP_PATH=""
LOCAL_TMP_BASE="$(mktemp -d "${TMPDIR:-/tmp}/ssh-unix-ops-self-test.XXXXXX")"
BIN_LOCAL="$LOCAL_TMP_BASE/payload.bin"
BIN_LOCAL_LINK="$LOCAL_TMP_BASE/payload.link"
BIN_DOWNLOADED="$LOCAL_TMP_BASE/payload-downloaded.bin"
BIN_DOWNLOADED_FROM_LINK="$LOCAL_TMP_BASE/payload-downloaded-from-link.bin"
BIN_DOWNLOAD_LINK_TARGET="$LOCAL_TMP_BASE/download-target.bin"
BIN_DOWNLOAD_LINK="$LOCAL_TMP_BASE/download-link.bin"
DIFF_EXPECTED="$LOCAL_TMP_BASE/expected.env"
DIFF_OUTPUT="$LOCAL_TMP_BASE/file.diff"
TREE_LOCAL="$LOCAL_TMP_BASE/tree-local"
TREE_DOWNLOADED="$LOCAL_TMP_BASE/tree-downloaded"
TREE_DOWNLOADED_VERBOSE="$LOCAL_TMP_BASE/tree-downloaded-verbose"
TREE_DIFF_OUTPUT="$LOCAL_TMP_BASE/tree.diff"
DOCTOR_VERBOSE_ERR="$LOCAL_TMP_BASE/doctor-verbose.err"
UPLOAD_TREE_VERBOSE_ERR="$LOCAL_TMP_BASE/upload-tree-verbose.err"
DOWNLOAD_TREE_VERBOSE_ERR="$LOCAL_TMP_BASE/download-tree-verbose.err"
ERR_OUT="$LOCAL_TMP_BASE/err.out"

cleanup() {
  rm -rf -- "$LOCAL_TMP_BASE"
}
trap cleanup EXIT

printf 'self-test host=%s workdir=%s\n' "$HOST" "$WORKDIR"

python3 "$HELPER" doctor --host "$HOST" >/dev/null
python3 "$HELPER" doctor --host "$HOST" --json > "$LOCAL_TMP_BASE/doctor.json"
python3 - <<'PY' "$LOCAL_TMP_BASE/doctor.json"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "doctor"
assert payload["noninteractive"] is True
assert payload["facts"]["bash"]
assert payload["platform"]["isUnixLike"] is True
assert payload["platform"]["family"] in {"linux", "macos", "wsl2", "bsd"}
PY
python3 "$HELPER" --verbose doctor --host "$HOST" >/dev/null 2>"$DOCTOR_VERBOSE_ERR"
grep -Fq 'BatchMode=yes' "$DOCTOR_VERBOSE_ERR"

python3 "$HELPER" exec --host "$HOST" --cwd / <<REMOTE
mkdir -p "$WORKDIR"
cat > "$CFG" <<'EOF'
PORT=3000
LOG_LEVEL=info
EOF
printf 'remote-real\n' > "$REAL_REMOTE"
rm -f -- "$LINK_REMOTE" "$FIFO_REMOTE" "$BIN_LINK_REMOTE"
ln -s "$(basename "$REAL_REMOTE")" "$LINK_REMOTE"
mkfifo "$FIFO_REMOTE"
REMOTE

set +e
python3 "$HELPER" read --host "$HOST" --path "$LINK_REMOTE" >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to read symlink path' "$ERR_OUT"
python3 "$HELPER" read --host "$HOST" --path "$LINK_REMOTE" --follow-symlinks | grep -Fqx 'remote-real'

set +e
cat <<'CONTENT' | python3 "$HELPER" write --host "$HOST" --path "$LINK_REMOTE" >/dev/null 2>"$ERR_OUT"
should-not-write
CONTENT
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to overwrite non-regular target' "$ERR_OUT"
python3 "$HELPER" exec --host "$HOST" --cwd / <<REMOTE
test -L "$LINK_REMOTE"
grep -Fqx 'remote-real' "$REAL_REMOTE"
REMOTE

set +e
python3 "$HELPER" read --host "$HOST" --path "$FIFO_REMOTE" >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to read non-regular path' "$ERR_OUT"

set +e
cat <<'CONTENT' | python3 "$HELPER" write --host "$HOST" --path "$FIFO_REMOTE" >/dev/null 2>"$ERR_OUT"
nope
CONTENT
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to overwrite non-regular target' "$ERR_OUT"

cat <<'CONTENT' | python3 "$HELPER" write --host "$HOST" --path "$QPATH" --verify-sha256
hello
quotes: 'single' "double"
CONTENT
python3 "$HELPER" read --host "$HOST" --path "$QPATH" | grep -Fqx 'quotes: '\''single'\'' "double"'

python3 "$HELPER" replace --host "$HOST" --path "$CFG" <<'JSON' >/dev/null
{
  "edits": [
    {"old": "PORT=3000\n", "new": "PORT=8080\n"},
    {"old": "LOG_LEVEL=info\n", "new": "LOG_LEVEL=debug\n"}
  ]
}
JSON
python3 "$HELPER" replace --host "$HOST" --path "$CFG" --json <<'JSON' > "$LOCAL_TMP_BASE/replace.json"
{
  "edits": [
    {"old": "PORT=8080\n", "new": "PORT=8080\n", "expected_count": 1}
  ]
}
JSON
python3 - <<'PY' "$LOCAL_TMP_BASE/replace.json"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "replace"
assert payload["status"] == "ok"
assert payload["editsRequested"] == 1
PY
python3 "$HELPER" read --host "$HOST" --path "$CFG" | grep -Fqx 'PORT=8080'
python3 "$HELPER" read --host "$HOST" --path "$CFG" | tail -n 1 | grep -Fqx 'LOG_LEVEL=debug'

set +e
python3 "$HELPER" backup --host "$HOST" --path "$LINK_REMOTE" >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to back up symlink path' "$ERR_OUT"
LINK_BACKUP="$(python3 "$HELPER" backup --host "$HOST" --path "$LINK_REMOTE" --follow-symlinks)"
python3 "$HELPER" read --host "$HOST" --path "$LINK_BACKUP" | grep -Fqx 'remote-real'

BACKUP_PATH="$(python3 "$HELPER" backup --host "$HOST" --path "$CFG")"
[[ -n "$BACKUP_PATH" ]]
python3 "$HELPER" backup --host "$HOST" --path "$CFG" --dest "$WORKDIR/config.explicit.bak" --json > "$LOCAL_TMP_BASE/backup.json"
python3 - <<'PY' "$LOCAL_TMP_BASE/backup.json"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "backup"
assert payload["status"] == "ok"
assert payload["backupPath"].endswith("config.explicit.bak")
PY
cat <<'CONTENT' | python3 "$HELPER" write --host "$HOST" --path "$CFG"
PORT=9999
LOG_LEVEL=broken
CONTENT
python3 "$HELPER" restore --host "$HOST" --path "$CFG" --from-backup "$BACKUP_PATH" --json > "$LOCAL_TMP_BASE/restore.json"
python3 - <<'PY' "$LOCAL_TMP_BASE/restore.json"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "restore"
assert payload["status"] == "ok"
PY
python3 "$HELPER" read --host "$HOST" --path "$CFG" | grep -Fqx 'PORT=8080'
python3 "$HELPER" read --host "$HOST" --path "$CFG" | tail -n 1 | grep -Fqx 'LOG_LEVEL=debug'

printf '\x00\x01\x02ssh-unix-ops\xff' > "$BIN_LOCAL"
ln -s "$BIN_LOCAL" "$BIN_LOCAL_LINK"
set +e
python3 "$HELPER" upload --host "$HOST" --local-path "$BIN_LOCAL_LINK" --remote-path "$WORKDIR/payload-from-link.bin" >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to read local symlink path' "$ERR_OUT"
python3 "$HELPER" upload --host "$HOST" --local-path "$BIN_LOCAL_LINK" --remote-path "$WORKDIR/payload-from-link.bin" --follow-symlinks --verify-sha256
python3 "$HELPER" upload --host "$HOST" --local-path "$BIN_LOCAL" --remote-path "$BIN_REMOTE" --verify-sha256 --json > "$LOCAL_TMP_BASE/upload.json"
python3 - <<'PY' "$LOCAL_TMP_BASE/upload.json"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "upload"
assert payload["status"] == "ok"
assert payload["verified"] is True
PY
python3 "$HELPER" exec --host "$HOST" --cwd / <<REMOTE
ln -s "$(basename "$BIN_REMOTE")" "$BIN_LINK_REMOTE"
REMOTE
python3 "$HELPER" sha256 --host "$HOST" --remote-path "$BIN_REMOTE" > "$LOCAL_TMP_BASE/remote.sha"
python3 "$HELPER" sha256 --local-path "$BIN_LOCAL" > "$LOCAL_TMP_BASE/local.sha"
python3 "$HELPER" sha256 --host "$HOST" --remote-path "$BIN_REMOTE" --json > "$LOCAL_TMP_BASE/remote-sha.json"
python3 - <<'PY' "$LOCAL_TMP_BASE/remote-sha.json"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "sha256"
assert payload["scope"] == "remote"
assert len(payload["sha256"]) == 64
PY
cut -d' ' -f1 "$LOCAL_TMP_BASE/remote.sha" > "$LOCAL_TMP_BASE/remote.sha.only"
cut -d' ' -f1 "$LOCAL_TMP_BASE/local.sha" > "$LOCAL_TMP_BASE/local.sha.only"
cmp -s "$LOCAL_TMP_BASE/remote.sha.only" "$LOCAL_TMP_BASE/local.sha.only"

set +e
python3 "$HELPER" download --host "$HOST" --remote-path "$BIN_LINK_REMOTE" --local-path "$BIN_DOWNLOADED_FROM_LINK" >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to read symlink path' "$ERR_OUT"
python3 "$HELPER" download --host "$HOST" --remote-path "$BIN_LINK_REMOTE" --local-path "$BIN_DOWNLOADED_FROM_LINK" --follow-symlinks --verify-sha256
cmp -s "$BIN_LOCAL" "$BIN_DOWNLOADED_FROM_LINK"

: > "$BIN_DOWNLOAD_LINK_TARGET"
ln -s "$BIN_DOWNLOAD_LINK_TARGET" "$BIN_DOWNLOAD_LINK"
set +e
python3 "$HELPER" download --host "$HOST" --remote-path "$BIN_REMOTE" --local-path "$BIN_DOWNLOAD_LINK" >/dev/null 2>"$ERR_OUT"
STATUS=$?
set -e
[[ "$STATUS" -eq 2 ]]
grep -Fq 'refusing to overwrite local non-regular target' "$ERR_OUT"
python3 "$HELPER" download --host "$HOST" --remote-path "$BIN_REMOTE" --local-path "$BIN_DOWNLOADED" --verify-sha256 --json > "$LOCAL_TMP_BASE/download.json"
python3 - <<'PY' "$LOCAL_TMP_BASE/download.json"
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload["command"] == "download"
assert payload["status"] == "ok"
assert payload["verified"] is True
PY
cmp -s "$BIN_LOCAL" "$BIN_DOWNLOADED"

mkdir -p "$TREE_LOCAL/sub dir"
cat > "$TREE_LOCAL/root.txt" <<'EOF'
root
EOF
cat > "$TREE_LOCAL/sub dir/space name.txt" <<'EOF'
child
EOF
cat > "$TREE_LOCAL/sub dir/unicode-λ.txt" <<'EOF'
unicode
EOF
python3 "$HELPER" --verbose upload-tree --host "$HOST" --local-path "$TREE_LOCAL" --remote-path "$TREE_REMOTE_VERBOSE" >/dev/null 2>"$UPLOAD_TREE_VERBOSE_ERR"
grep -Fq -- '--no-same-owner' "$UPLOAD_TREE_VERBOSE_ERR"
python3 "$HELPER" upload-tree --host "$HOST" --local-path "$TREE_LOCAL" --remote-path "$TREE_REMOTE"
python3 "$HELPER" tree-diff --host "$HOST" --remote-path "$TREE_REMOTE" --local-path "$TREE_LOCAL" --checksum
python3 "$HELPER" --verbose download-tree --host "$HOST" --remote-path "$TREE_REMOTE" --local-path "$TREE_DOWNLOADED_VERBOSE" >/dev/null 2>"$DOWNLOAD_TREE_VERBOSE_ERR"
grep -Fq -- '--no-same-owner' "$DOWNLOAD_TREE_VERBOSE_ERR"
python3 "$HELPER" download-tree --host "$HOST" --remote-path "$TREE_REMOTE" --local-path "$TREE_DOWNLOADED"
diff -ru "$TREE_LOCAL" "$TREE_DOWNLOADED"

cat > "$DIFF_EXPECTED" <<'EOF'
PORT=8080
LOG_LEVEL=info
EOF
set +e
python3 "$HELPER" diff --host "$HOST" --remote-path "$CFG" --local-path "$DIFF_EXPECTED" > "$DIFF_OUTPUT"
DIFF_STATUS=$?
python3 "$HELPER" diff --host "$HOST" --remote-path "$CFG" >/dev/null 2>"$ERR_OUT"
DIFF_USAGE_STATUS=$?
set -e
[[ "$DIFF_STATUS" -eq 1 ]]
[[ "$DIFF_USAGE_STATUS" -eq 2 ]]
grep -Fq -- '-LOG_LEVEL=debug' "$DIFF_OUTPUT"
grep -Fq -- '+LOG_LEVEL=info' "$DIFF_OUTPUT"
grep -Fq -- 'choose exactly one of --local-path, --stdin' "$ERR_OUT"

echo 'extra' >> "$TREE_LOCAL/root.txt"
set +e
python3 "$HELPER" tree-diff --host "$HOST" --remote-path "$TREE_REMOTE" --local-path "$TREE_LOCAL" --checksum > "$TREE_DIFF_OUTPUT"
TREE_DIFF_STATUS=$?
set -e
[[ "$TREE_DIFF_STATUS" -eq 1 ]]
grep -Fq 'sha256' "$TREE_DIFF_OUTPUT"

python3 "$HELPER" exec --host "$HOST" --cwd / <<REMOTE
rm -rf -- "$WORKDIR"
REMOTE

printf 'self-test: ok\n'
