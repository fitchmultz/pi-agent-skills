# SSH Friction Findings

These are the high-value failure modes observed while probing Unix-like hosts over SSH.

Default fix: use `scripts/ssh-unix-ops.py` instead of ad-hoc `ssh "..."`. It encodes the guardrails below: forced noninteractive SSH, forced shell for scripts, path-as-data file primitives, atomic single-file replacement, explicit final-component symlink checks, and `doctor --json` platform classification (`linux`, `macos`, `wsl2`, `bsd`, `unknown`). Parent paths and concurrent writers must remain trusted; tree transfers have separate limits.

## 1) Remote login shell differences break assumptions

A host may drop you into `zsh`, not `bash`.

Observed failure pattern:
- running `ssh host 'echo *.txt'` in an empty directory failed under zsh with `no matches found`
- the same command under forced bash printed the literal glob, which is often what automation expects before a later command handles it

Countermeasure:
- use `exec`, which forces `bash -seu -o pipefail` by default
- use `exec --shell sh` only when `doctor` shows bash is unavailable

## 2) Double-quoted SSH commands leak local expansion

Observed failure pattern:
- `ssh host "printf '%s\n' $HOME"` printed the **local** `$HOME`, not the remote one

Countermeasure:
- use `exec` stdin scripts or helper arguments
- do not interpolate variables into double-quoted SSH strings

## 3) Single quotes in remote paths are quote traps

Observed failure pattern:
- a path like `single'quote.txt` caused `ssh host "cat '/path/single'quote.txt'"` to fail with unmatched quotes

Countermeasure:
- use `read`, `write`, `replace`, `backup`, `restore`, `upload`, `download`, or `sha256`
- pass paths as helper arguments instead of hand-building shell quoting

## 4) Nested heredocs inside SSH strings are brittle

Observed failure pattern:
- embedding Python inside `ssh host "python3 - <<'PY' ..."` broke as soon as the payload contained certain quote combinations

Countermeasure:
- use `exec` for stdin-fed remote scripts
- use file primitives for Python-backed path-safe operations instead of nested heredocs

## 5) Pipelines hide failures without pipefail

Observed failure pattern:
- `false | true` returned success unless `set -o pipefail` was enabled

Countermeasure:
- use `exec` default shell mode, which runs `bash -seu -o pipefail`

## 6) Naive redirection risks partial writes

Observed failure pattern:
- direct `cat > file` style writes are easy, but they are not atomic and are easy to misuse in multi-step edits

Countermeasure:
- `write`, `replace`, `upload`, and `download` flush/fsync the temporary file before atomic replacement
- `restore` copies the backup to a temporary file and replaces the destination, but does not fsync it
- none of these operations fsync the parent directory; atomic replacement alone is not a crash-durability guarantee

## 7) `scp` path syntax is another quoting trap

Observed failure pattern:
- once remote paths contain spaces or quotes, `scp local host:/path` syntax becomes easy to misquote because the destination embeds SSH transport and remote path parsing in one token

Countermeasure:
- for single-file workflows, use `upload`/`download`, which treat paths as data
- reserve `scp`/`rsync` for transfer cases the helper intentionally does not solve

## 8) WSL2 Windows mounts do not behave like normal Linux filesystems

Observed failure pattern:
- on the probed WSL2 host, `/mnt/c` was a Windows-backed `9p`/`v9fs` mount
- a file created under `/mnt/c/Users/Public/...` still reported mode `777` after `chmod 600`

Countermeasure:
- run `doctor --json` and check `platform.family == "wsl2"`
- prefer Linux-native paths such as `/home/...` for active code/config work
- treat `/mnt/c` as an interoperability boundary, not the default workspace
- verify permissions explicitly instead of assuming Unix semantics

## 9) Interactive SSH prompts can hang automation

Observed failure pattern:
- password prompts, passphrase prompts, and first-contact trust prompts can block unattended agent runs indefinitely when SSH is allowed to prompt interactively

Countermeasure:
- helper commands default SSH to `BatchMode=yes` so failures surface immediately instead of hanging
- keep host-key verification strict and treat trust prompts as explicit operator decisions

## 10) Symlinks create surprising safety gaps unless policies are explicit

Observed failure pattern:
- read-style operations often follow symlinks by default while temp-file-and-rename mutation workflows replace the symlink itself

Countermeasure:
- single-file read-style commands refuse final-component symlinks by default
- pass `--follow-symlinks` only for intentional read/hash/download/backup sources
- single-file mutation commands refuse symlink and special-file targets, but do not guard parent symlinks or concurrent path changes
- tree transfers use tar merge/extraction, not these single-file checks; use trusted source trees and destinations

## Practical conclusion

For repeatable agent work on remote Unix-like hosts, the safest defaults are:
- force a known shell
- ship scripts over stdin
- use Python for path-safe file operations
- preview with diffs before mutation when practical
- back up important files before editing
- use atomic single-file replacement where supported; do not treat tree transfers as atomic or exact syncs
- fail fast instead of waiting on SSH prompts
- make symlink policy explicit instead of implicit
- make exact edits fail loudly when match counts drift
- prefer Linux-native filesystems over Windows mounts on WSL2
