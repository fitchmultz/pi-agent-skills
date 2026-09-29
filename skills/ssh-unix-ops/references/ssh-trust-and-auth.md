# SSH Trust and Auth Policy

A high-quality remote automation workflow is not only about quoting and file safety; it is also about trust boundaries.

## Default posture

Use the most restrictive practical SSH posture by default:
- rely on existing SSH config when available
- prefer key-based auth
- preserve host key checking
- surface trust decisions instead of silently bypassing them

## Rules

### 1) Do not disable host verification silently

Avoid ad-hoc options like these unless the user explicitly requests them:

```bash
-o StrictHostKeyChecking=no
-o UserKnownHostsFile=/dev/null
```

These trade convenience for MITM exposure and should be treated as explicit risk decisions.

### 2) Prefer SSH config over per-command sprawl

If a host requires `ProxyJump`, `IdentityFile`, or keepalive tuning, prefer encoding that in SSH config. Use repeated `--ssh-option` flags only when the task needs command-local overrides.

### 3) Stop on first-contact trust prompts

If SSH reaches a host for the first time and presents a host key prompt, stop and surface:
- the hostname/IP
- the key fingerprint or exact prompt
- that trust confirmation is required

### 4) Keep credentials out of command strings

Avoid embedding secrets in shell commands or environment exports passed through SSH. Prefer SSH keys, agent forwarding only when necessary, and remote secret stores that already exist on the host.

### 5) Use separate policies for separate environments

Production, personal lab, and ephemeral throwaway hosts may justify different SSH policies. State the tradeoff explicitly instead of silently broadening trust.

## Practical use with this skill

Pass explicit SSH policy like this:

```bash
python3 ./scripts/ssh-unix-ops.py \
  exec \
  --host user@example-host \
  --ssh-option StrictHostKeyChecking=yes \
  --ssh-option ServerAliveInterval=30 <<'REMOTE'
hostname
REMOTE
```

## Escalation guidance

If the user asks to weaken trust checks:
1. acknowledge the risk
2. do it only for that task or command
3. avoid normalizing the weaker policy in the skill docs or defaults
