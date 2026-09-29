# Command Reference

This reference is optimized for agents and operators who need quick command selection without reading the full quickstart.

## Exit codes

The helper uses a simple contract:
- `0` = success
- `1` = semantic difference only (`diff`, `tree-diff`)
- `2` = usage error or refused unsafe operation
- `3` = operational failure after validation started (for example checksum mismatch or missing local dependency)
- other non-zero = remote command / SSH failure propagated through

## Command summary

| Command | Use it for | Mutates? | JSON? | Notes |
|---|---|---:|---:|---|
| `doctor` | Probe host facts, platform family, and prerequisites | No | Yes | Best first step per host/session |
| `exec` | Run remote commands/scripts safely | Maybe | No | Defaults to `bash -seu -o pipefail` |
| `read` | Read a remote text file | No | No | Refuses symlinks unless `--follow-symlinks` |
| `diff` | Preview remote-vs-local text changes | No | No | Exit `1` means “different” |
| `backup` | Create rollback copy of remote file | Yes | Yes | Rollback copy, not durable backup |
| `write` | Replace full remote file from stdin | Yes | Yes | Atomic temp-file + rename |
| `replace` | Apply exact text edits to remote file | Yes | Yes | Fails on drift/overlap |
| `restore` | Restore remote file from rollback copy | Yes | Yes | Refuses symlink/special-file targets |
| `upload` | Send one local file to remote | Yes | Yes | Atomic on remote side |
| `download` | Fetch one remote file locally | Yes | Yes | Atomic on local side |
| `sha256` | Hash one local or remote file | No | Yes | Good for integrity checks |
| `upload-tree` | Merge local tree into remote dir | Yes | No | Not atomic, not exact sync |
| `download-tree` | Extract remote tree into local dir | Yes | No | Not atomic, not exact sync |
| `tree-diff` | Compare remote and local trees | No | No | Exit `1` means “different” |

## Selection guide

Choose commands like this:

- Need host facts, OS family, or prerequisites → `doctor`
- Need to run commands / grep / validate services → `exec`
- Need to inspect a file before changing it → `read` or `diff`
- Need to replace a whole file → `write`
- Need a narrow exact edit → `replace`
- Need a rollback point first → `backup`
- Need to undo a change → `restore`
- Need one-file transfer → `upload` / `download`
- Need integrity verification → `sha256`
- Need one-off directory transfer → `upload-tree` / `download-tree`
- Need exact large-scale sync → use `rsync` instead of tree-transfer commands

## Safety defaults

- SSH runs with `BatchMode=yes` by default
- `doctor --json` reports `platform.family` as `linux`, `macos`, `wsl2`, `bsd`, or `unknown` so agents avoid Linux-only assumptions on macOS/BSD
- Single-file read-style commands refuse final-component symlinks unless explicitly told otherwise
- Single-file mutation commands refuse symlink and special-file targets; parent symlinks and concurrent path changes are not guarded
- Tree transfer commands are merge/extract helpers, not deployment-sync tools or guarded single-file operations; use trusted sources and destinations
- For privileged paths, solve access separately; the helper does not include built-in sudo escalation
