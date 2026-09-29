---
name: ssh-unix-ops
description: "Operate on Linux, macOS, or WSL2 hosts over SSH: commands, inspection, exact text edits, transfer, backup/restore, and diff/hash checks. Not local-only work, browser UI, cloud APIs, native Windows admin, privilege setup, or large exact syncs; use only for SSH preflight/verification around those workflows."
license: MIT
compatibility: "Local: OpenSSH, Python 3, and tar. Remote: SSH access to a Linux, macOS, or WSL2 host. bash, python3, and tar unlock the full workflow; sh-only fallback is supported for basic command execution."
metadata:
  version: 0.3.0
  release-stage: public-beta
---

# SSH Unix Ops

## Goal

Operate on SSH-accessible Linux, macOS, or WSL2 hosts with inspect-before-mutate discipline, narrow file primitives, rollback points, and fresh verification evidence. This is a bundled instruction skill for official Pi and the `fitchmultz/pi` fork, not a runtime extension or a native SSH tool.

## Trigger contract

Use when the task needs SSH-based Unix-like host work: remote command execution, file inspection, exact text edits, upload/download, backup/restore, diff/hash checks, tree comparison, or WSL2 path guidance.

Do not use for local-only work, browser/UI flows, cloud-provider APIs, remote Windows administration, root/sudo policy setup, or large exact delete-syncs unless SSH inspection or verification is only a small part of the task.

## Default workflow

1. Identify the host, user, target paths, and allowed side effects. An inspection request is read-only; this skill does not grant remote-write, deployment, destructive-action, privilege, or credential-change authority. Follow the user's explicit authorization or applicable standing policy without asking again for covered actions.
2. Run `doctor` once per host/session when prerequisites or OS family are unknown.
3. Inspect before mutation with `read`, `diff`, `tree-diff`, or `exec`.
4. Back up important remote files before `write`, `replace`, risky uploads, or restore tests.
5. Use the narrowest helper command that fits; avoid hand-built nested SSH quoting for file work.
6. Verify immediately after every mutation with `read`, `diff`, `sha256`, `tree-diff`, or service-native validation.
7. Report exact files/paths changed, commands run, validation output, and rollback path when one exists.

## Helper command map

Resolve `<skill-dir>` from the loaded `SKILL.md` location, not the project's working directory. Invoke through the host's available shell tool; no fork-only API is required:

```bash
python3 <skill-dir>/scripts/ssh-unix-ops.py --help
python3 <skill-dir>/scripts/ssh-unix-ops.py <command> --help
```

Reference examples use `./scripts/...` relative to this skill directory. Local transfer paths refer to the actual shell working directory; remote paths refer to the SSH host. Prefer absolute paths when that distinction matters.

- Probe host facts, OS family, and prereqs: `doctor`
- Run remote commands or validation scripts: `exec`
- Read remote text: `read`
- Preview remote-vs-local text: `diff`
- Create rollback copy: `backup`
- Restore from rollback copy: `restore`
- Replace a full remote file from stdin: `write`
- Apply exact text edits: `replace`
- Upload/download one file: `upload`, `download`
- Hash one local or remote file: `sha256`
- Merge/extract a directory tree: `upload-tree`, `download-tree`
- Compare local and remote trees: `tree-diff`

Use `rsync` or a deployment-specific workflow instead of `upload-tree` for large exact syncs, deletion semantics, resumable transfer, or atomic release promotion.

## Safety boundaries

- Preserve SSH host-key checking by default. If first-contact trust or auth fails, stop and surface the exact blocker.
- Do not embed passwords, tokens, or secrets in SSH command strings.
- The helper runs noninteractively with `BatchMode=yes` unless the user explicitly changes SSH policy.
- The helper has no built-in sudo escalation. For privileged paths, agree on access separately before file primitives.
- `read` and `diff` are text-oriented; use `download` and `sha256` for binary-sensitive work.
- Single-file operations are memory-buffered; avoid them for very large artifacts.
- Single-file primitives refuse final-component symlinks unless a read-style command explicitly uses `--follow-symlinks`; mutation targets must be regular files or absent. These checks do not protect against symlinked parent directories or concurrent path changes. Use trusted directories and coordinate concurrent writers.
- `backup` is a same-host rollback copy, not durable off-host backup.
- Tree transfers are merge/extract operations, not atomic exact syncs; they do not inherit the single-file symlink checks. Use trusted source trees and destinations, inspect conflicts first, and do not extract untrusted remote archives into valuable local directories.
- Atomic single-file replacement is not a multi-file transaction or metadata-preserving deployment. Verify required ownership, ACLs, extended attributes, and service behavior separately.
- Use `doctor --json` to distinguish Linux, macOS, WSL2, BSD, and unknown hosts before making platform-specific claims.
- If `doctor` reports a non-Unix-like host, do not claim Unix-like validation. Use only generic SSH helper checks or switch to a better-matched skill.

## Degraded mode

- No `bash`: use `exec --shell sh`; note that `pipefail` is unavailable.
- No remote `python3`: limit work to `exec`/shell-only inspection or stop; helper file primitives require Python.
- No `tar`: tree transfer commands are unavailable.
- WSL2: prefer Linux-native paths such as `/home/...`; avoid active work under `/mnt/c/...` unless required.

## Available scripts

- `scripts/ssh-unix-ops.py` — main helper for safe SSH commands, file operations, transfer, backup, restore, diff, and hash.
- `scripts/self-test.sh --host user@example-host [--workdir /tmp/ssh-unix-ops-self-test-NAME]` — end-to-end helper smoke/integration test against a reachable SSH host.
- `tests/negative-tests.sh --host user@example-host` — refusal and JSON-output checks.
- `evals/trigger-evals.json` and `evals/evals.json` — local skill trigger/output review corpora.

## Reference loading

- Read `references/command-reference.md` when choosing command syntax or exit-code meaning.
- Read `references/ssh-trust-and-auth.md` when auth, host keys, SSH config, ProxyJump, or trust prompts matter.
- Read `references/wsl2-notes.md` before editing a WSL2 host or paths under `/mnt/c`.
- Read `references/recipes.md` for a concrete repeated flow such as config edit, tree transfer, or rollback.
- Read `references/friction-findings.md` when debugging quoting, shell, tar, or transfer failure modes.
- Read `references/excellence-rubric.md` for a final quality review of high-risk remote work.

## Validation

For skill/package changes, run `npm test`, `npm run smoke`, and `npm run pack:check` from the pi-agent-skills repository root. The offline suite runs the existing helper checks with a local transport substitute; it does not prove SSH authentication, host-key policy, networking, or a different remote OS.

For actual SSH integration evidence, use an explicitly authorized disposable host/scratch directory:

```bash
<skill-dir>/scripts/self-test.sh --host user@example-host
<skill-dir>/tests/negative-tests.sh --host user@example-host
```

The self-test writes remote scratch files and removes its work directory on success; after failure, inspect and clean up the exact printed scratch path. Do not run it against a valuable pre-existing directory. Report host-backed checks as unrun when no suitable target is authorized.

For remote operations, completion requires fresh evidence from the target host: pre-change inspection where relevant, mutation command output, post-change verification, and rollback info for risky edits.

## Stop rules

Stop when the requested remote operation is verified or a real blocker is clear: auth/trust failure, missing prerequisites, unsafe privilege model, unclear destructive side effect, missing backup for risky edits, or failed validation. Do not keep mutating after a failed verification until the rollback or repair path is explicit.
