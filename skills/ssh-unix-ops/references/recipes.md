# SSH Unix Ops Recipes

All examples assume you are running them from the skill directory so `./scripts/ssh-unix-ops.py` resolves correctly.

## Inspect a repo on the remote host

```bash
python3 ./scripts/ssh-unix-ops.py \
  exec \
  --host user@example-host \
  --cwd /path/to/repo <<'REMOTE'
pwd
git status --short
find . -maxdepth 2 -type f | sort | head -n 50
REMOTE
```

## Get machine-readable doctor output

```bash
python3 ./scripts/ssh-unix-ops.py \
  doctor \
  --host user@example-host \
  --json
```

## Read a file whose path contains spaces or quotes

```bash
python3 ./scripts/ssh-unix-ops.py \
  read \
  --host user@example-host \
  --path "/path/with spaces/and 'quotes'.txt"
```

## Diff proposed content before overwrite

```bash
cat <<'CONTENT' | python3 ./scripts/ssh-unix-ops.py \
  diff \
  --host user@example-host \
  --remote-path /srv/app/example.conf \
  --stdin
PORT=8080
LOG_LEVEL=debug
CONTENT
```

## Read through a symlink only when you mean it

```bash
python3 ./scripts/ssh-unix-ops.py \
  read \
  --host user@example-host \
  --path /path/to/link.conf \
  --follow-symlinks
```

## Back up a remote config file before editing

```bash
python3 ./scripts/ssh-unix-ops.py \
  backup \
  --host user@example-host \
  --path /srv/app/example.conf
```

## Restore from a backup

```bash
python3 ./scripts/ssh-unix-ops.py \
  restore \
  --host user@example-host \
  --path /srv/app/example.conf \
  --from-backup /srv/app/example.conf.20260402T120000Z.bak
```

## Upload generated content directly to a remote file

```bash
cat <<'CONTENT' | python3 ./scripts/ssh-unix-ops.py \
  write \
  --host user@example-host \
  --path /tmp/example.txt \
  --verify-sha256
hello
CONTENT
```

## Upload an existing local file

```bash
python3 ./scripts/ssh-unix-ops.py \
  upload \
  --host user@example-host \
  --local-path ./build/output.bin \
  --remote-path /tmp/output.bin \
  --verify-sha256
```

## Download a remote artifact

```bash
python3 ./scripts/ssh-unix-ops.py \
  download \
  --host user@example-host \
  --remote-path /var/log/app.log \
  --local-path ./downloads/app.log \
  --make-parents \
  --verify-sha256
```

## Emit machine-readable transfer status

```bash
python3 ./scripts/ssh-unix-ops.py \
  upload \
  --host user@example-host \
  --local-path ./build/output.bin \
  --remote-path /tmp/output.bin \
  --verify-sha256 \
  --json
```

## Compare file hashes

```bash
python3 ./scripts/ssh-unix-ops.py sha256 --host user@example-host --remote-path /tmp/output.bin
python3 ./scripts/ssh-unix-ops.py sha256 --local-path ./build/output.bin
python3 ./scripts/ssh-unix-ops.py sha256 --host user@example-host --remote-path /tmp/output.bin --json
```

## Upload a local directory tree via tar-over-SSH

This is a merge/extract transfer, not an exact sync and not an atomic swap.

```bash
python3 ./scripts/ssh-unix-ops.py \
  upload-tree \
  --host user@example-host \
  --local-path ./dist \
  --remote-path /srv/app/dist
```

## Download a remote directory tree via tar-over-SSH

This extracts into the local destination directory and defaults to safer `--no-same-owner` tar extraction.

```bash
python3 ./scripts/ssh-unix-ops.py \
  download-tree \
  --host user@example-host \
  --remote-path /srv/app/dist \
  --local-path ./downloads/dist
```

## Compare a remote tree to a local tree

```bash
python3 ./scripts/ssh-unix-ops.py \
  tree-diff \
  --host user@example-host \
  --remote-path /srv/app/dist \
  --local-path ./dist \
  --checksum
```

## Apply multiple exact replacements

```bash
python3 ./scripts/ssh-unix-ops.py \
  replace \
  --host user@example-host \
  --path /tmp/example.txt <<'JSON'
{
  "edits": [
    {"old": "hello\n", "new": "hello world\n"},
    {"old": "PORT=3000", "new": "PORT=8080", "expected_count": 1}
  ]
}
JSON
```

Machine-readable status:

```bash
python3 ./scripts/ssh-unix-ops.py \
  replace \
  --host user@example-host \
  --path /tmp/example.txt \
  --json <<'JSON'
{
  "edits": [
    {"old": "hello\n", "new": "hello world\n"}
  ]
}
JSON
```

## Run through a jump host or custom SSH settings

```bash
python3 ./scripts/ssh-unix-ops.py \
  exec \
  --host user@example-host \
  --ssh-option ProxyJump=bastion.example.net \
  --ssh-option ServerAliveInterval=30 <<'REMOTE'
hostname
REMOTE
```

## Fallback when bash is missing

```bash
python3 ./scripts/ssh-unix-ops.py \
  exec \
  --host user@example-host \
  --shell sh <<'REMOTE'
set -eu
pwd
REMOTE
```

## Service-native verification after config edits

```bash
python3 ./scripts/ssh-unix-ops.py \
  exec \
  --host user@example-host <<'REMOTE'
nginx -t
systemctl reload nginx
REMOTE
```
