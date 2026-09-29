# SSH Unix Ops Quickstart

A human-friendly quickstart for the `ssh-unix-ops` skill.

## What this is for

Use this skill when you need to treat a remote Unix-like host like a safe working environment instead of building fragile one-off `ssh "..."` command strings.

## Command selection at a glance

| If you need to... | Use |
|---|---|
| inspect host facts, OS family, and prerequisites | `doctor` |
| run remote commands or validation scripts | `exec` |
| inspect a remote text file | `read` |
| preview a text change before writing | `diff` |
| create a rollback point | `backup` |
| replace a whole file | `write` |
| apply exact text edits | `replace` |
| roll back from a backup | `restore` |
| transfer one file | `upload` / `download` |
| verify file integrity | `sha256` |
| transfer a directory tree one-off | `upload-tree` / `download-tree` |
| compare local vs remote trees | `tree-diff` |

## Install it

This skill is maintained in the [pi-agent-skills bundle](../../README.md), for both official Pi and the `fitchmultz/pi` fork:

```bash
pi install git:github.com/fitchmultz/pi-agent-skills
```

Use `/skill:ssh-unix-ops` for explicit invocation, or let Pi select it for SSH host work. Avoid installing a second standalone copy with the same skill name. The archived source is historical; make future changes in `skills/ssh-unix-ops` in this repository. See [maintaining skills](../../docs/maintaining-skills.md) for package validation and delivery policy.

## Quality gates

This package now includes:
- `scripts/self-test.sh` for end-to-end SSH integration validation
- `tests/negative-tests.sh` for dedicated negative-path coverage
- `evals/trigger-evals.json` for should-trigger / should-not-trigger invocation review
- `evals/evals.json` for output-quality review of safe-operation responses and boundary cases
- offline helper coverage and packed-skill discovery through the bundle's `npm test`

Real SSH tests require an authorized disposable target. Offline tests substitute only the transport, not the helper file operations; they do not establish remote-host compatibility. Examples below run from this skill directory; from a project, use the helper's absolute path instead.

It is especially useful for:
- reading remote files
- editing remote text files safely
- uploading or downloading files
- backing up and restoring remote configs
- comparing local and remote content before changing anything
- moving directory trees over SSH without hand-rolled quoting

## Operating limits you should know first

- **No built-in sudo escalation.** The examples assume the SSH user can already read/write the target paths.
- **Single-file reads/writes/transfers are memory-buffered.** Use `rsync`, `scp`, or tree-transfer workflows for larger payloads.
- **`read` and `diff` are text-oriented.** For binary-sensitive work, prefer `download` and `sha256`.
- **Single-file symlink checks are limited to the final path component.** Read-style commands require `--follow-symlinks`; mutation targets refuse symlinks and special files. Parent paths, concurrent writers, and tree extraction require trusted directories and separate inspection.
- **`backup` is a rollback copy, not a durable backup system.**
- **`upload-tree` and `download-tree` are merge/extract operations.** They are not atomic and they are not exact syncs.
- **SSH runs noninteractively by default.** The helper uses `BatchMode=yes` so prompts fail fast instead of hanging.

## The golden path

For most config/code tasks, use this sequence:

1. **Probe** the host
2. **Preview** the current content
3. **Back up** the target file
4. **Mutate** with a narrow primitive
5. **Verify** immediately
6. **Restore** if needed

## 1) Probe the host

```bash
python3 ./scripts/ssh-unix-ops.py doctor --host user@example-host
```

## 2) Read or diff before changing anything

Read a file:

```bash
python3 ./scripts/ssh-unix-ops.py \
  read \
  --host user@example-host \
  --path /srv/app/example.conf
```

Preview a proposed overwrite:

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

## 3) Back up before mutation

```bash
python3 ./scripts/ssh-unix-ops.py \
  backup \
  --host user@example-host \
  --path /srv/app/example.conf
```

Save the printed backup path.

## 4) Mutate safely

Replace the entire file:

```bash
cat <<'CONTENT' | python3 ./scripts/ssh-unix-ops.py \
  write \
  --host user@example-host \
  --path /srv/app/example.conf \
  --verify-sha256
PORT=8080
LOG_LEVEL=debug
CONTENT
```

Or apply exact edits only:

```bash
python3 ./scripts/ssh-unix-ops.py \
  replace \
  --host user@example-host \
  --path /srv/app/example.conf <<'JSON'
{
  "edits": [
    {"old": "LOG_LEVEL=info\n", "new": "LOG_LEVEL=debug\n"}
  ]
}
JSON
```

## 5) Verify immediately

```bash
python3 ./scripts/ssh-unix-ops.py \
  read \
  --host user@example-host \
  --path /srv/app/example.conf
```

For stronger verification:

```bash
python3 ./scripts/ssh-unix-ops.py \
  sha256 \
  --host user@example-host \
  --remote-path /srv/app/example.conf
```

## 6) Restore if the change was wrong

```bash
python3 ./scripts/ssh-unix-ops.py \
  restore \
  --host user@example-host \
  --path /srv/app/example.conf \
  --from-backup /srv/app/example.conf.20260402T120000Z.bak
```

## Machine-readable output

The following commands support `--json` for agent- or script-friendly output:
- `doctor` — includes `platform.family` (`linux`, `macos`, `wsl2`, `bsd`, or `unknown`) so agents avoid Linux-only assumptions on macOS/BSD
- `write`
- `replace`
- `upload`
- `download`
- `backup`
- `restore`
- `sha256`

Example:

```bash
python3 ./scripts/ssh-unix-ops.py \
  doctor \
  --host user@example-host \
  --json
```

## Common file transfer tasks

Upload one file:

```bash
python3 ./scripts/ssh-unix-ops.py \
  upload \
  --host user@example-host \
  --local-path ./local.conf \
  --remote-path /tmp/local.conf \
  --verify-sha256
```

Download one file:

```bash
python3 ./scripts/ssh-unix-ops.py \
  download \
  --host user@example-host \
  --remote-path /var/log/app.log \
  --local-path ./downloads/app.log \
  --make-parents \
  --verify-sha256
```

Upload a directory tree:

```bash
python3 ./scripts/ssh-unix-ops.py \
  upload-tree \
  --host user@example-host \
  --local-path ./dist \
  --remote-path /srv/app/dist
```

Download a directory tree:

```bash
python3 ./scripts/ssh-unix-ops.py \
  download-tree \
  --host user@example-host \
  --remote-path /srv/app/dist \
  --local-path ./downloads/dist
```

## Exit-code contract

- `0` = success
- `1` = semantic difference only (`diff`, `tree-diff`)
- `2` = usage error or refused unsafe operation
- `3` = operational failure after validation started
- Other nonzero values can propagate from SSH or the remote command.

## Rules of thumb

- Prefer `exec` for commands and `read`/`write`/`replace` for files.
- Prefer `diff` before `write`.
- Prefer `backup` before risky changes.
- Prefer `upload-tree`/`download-tree` for one-off tree transfers.
- Prefer `rsync` for large exact-sync jobs.
- Prefer `/home/...` over `/mnt/c/...` on WSL2 for active work.
- Pass `--follow-symlinks` only when you intentionally want read-style commands to follow a symlink target.
- Do not disable SSH host-key checking unless explicitly required.

## Maintenance

The original MIT license, helper, references, integration scripts, and evaluation corpora are retained. Helper 0.3.1 fixes login-profile output corrupting tree downloads and honors `--encoding` for stdin diffs. Bundle maintenance replaces the archive's standalone release workflow; do not publish this package to npm. Instruction changes are recorded in the repository changelog, independently of the helper's `--version`.

## Further reference

- [Command reference](references/command-reference.md)
- [Recipes](references/recipes.md)
- [Bundle maintenance](../../docs/maintaining-skills.md)

## Get command help

```bash
python3 ./scripts/ssh-unix-ops.py --help
python3 ./scripts/ssh-unix-ops.py write --help
python3 ./scripts/ssh-unix-ops.py tree-diff --help
```
