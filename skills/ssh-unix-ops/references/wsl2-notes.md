# WSL2 Notes

These notes matter when the remote Unix-like host is actually WSL2 on Windows.

## What was observed

On the probed host:
- `/mnt/c` is mounted as a Windows-backed filesystem (`9p` / `v9fs`)
- `wslpath` is available for Windows↔Linux path conversion
- Linux permission semantics on `/mnt/c` are not reliable in the same way they are on `/home`
- a test file created under `/mnt/c/Users/Public/...` reported mode `777` even after `chmod 600`

## Operational guidance

### Prefer Linux-native paths for active work

For repos, config edits, temp files, and scripts, prefer:
- `/home/...`
- `/tmp/...`
- other Linux-native mount points

Avoid doing routine edit/build/test loops in:
- `/mnt/c/...`
- `/mnt/d/...`
- other Windows-backed drvfs/9p mounts

Why:
- permission metadata can differ from normal Linux expectations
- file watching and IO can behave differently
- tools that rely on Unix ownership/mode semantics may misbehave

### Treat `/mnt/c` as an interoperability boundary

Use Windows-mounted paths mainly for:
- exchanging files with Windows applications
- grabbing artifacts that must be visible to Windows
- one-off imports/exports

### Be cautious with chmod/chown assumptions

On Windows-backed mounts:
- `chmod` may not behave as expected
- executable bits and strict mode checks may not reflect Linux-native semantics
- backup/restore workflows that depend on exact mode preservation may not be meaningful

### Convert paths explicitly when crossing Windows/WSL boundaries

Examples:

```bash
wslpath 'C:\Users\Example\Desktop'
wslpath -w /home/example/project
```

### Quote Windows paths carefully

Windows paths introduce backslashes, spaces, and colons. Do not inline them casually inside SSH command strings. Prefer stdin-fed scripts and explicit conversion with `wslpath`.

## Recommended policy for agents

1. If the task can live under `/home`, keep it there.
2. If the task must touch `/mnt/c`, call out the filesystem caveat.
3. Verify permissions and executability behavior explicitly instead of assuming.
4. Prefer `upload`/`download` or tar/rsync workflows over hand-built copy commands.
