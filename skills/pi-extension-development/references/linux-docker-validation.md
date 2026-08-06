# Linux Docker Validation for Pi Extensions

## Purpose

Provide a reusable local Docker pattern for Linux validation of pi extension packages when the user asks for Linux testing, cross-platform readiness, or a Linux release gate.

This is **not mandatory for every pi extension change**. Use it when Linux behavior is part of the acceptance criteria, release readiness, package/install validation, or explicit user request.

## Outcome

A good Linux Docker validation pass proves, from a clean Linux userspace, that:

- the package installs and loads through pi's package mechanism
- project tests or smoke tests pass on Linux
- required external CLIs are present and visible on `PATH`
- pi can discover the expected extension resources, commands, and tools
- model-driven smokes use the extension naturally when that is part of the product goal
- logs and session JSONL are saved as local evidence

## Non-goals

- Do not make Linux Docker validation a universal requirement for every pi extension edit.
- Do not publish, tag for a registry, or push these validation images anywhere.
- Do not replace native macOS validation when the user's real environment is macOS.
- Do not use Docker as proof of Windows support.

## Recommended project-local files

Prefer adding a small, reusable harness to each pi extension repo that needs Linux validation:

- `scripts/linux-smoke.mjs` or `scripts/pi-linux-smoke.mjs`
- `docker/linux-smoke.Dockerfile` or `docker/pi-linux-smoke.Dockerfile`
- `tmp/linux-smoke/` or another gitignored artifact directory for logs/session JSONL

Keep this harness project-local because each extension has different binaries, package layout, smoke prompts, and pass/fail gates.

## Container baseline

Default to a current Debian/Ubuntu-style Linux image with a modern Node runtime, for example:

```Dockerfile
FROM node:24-bookworm

ARG PI_VERSION
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash ca-certificates curl git jq python3 python3-pip unzip xz-utils \
    build-essential pkg-config \
  && rm -rf /var/lib/apt/lists/*

RUN test -n "$PI_VERSION" \
  && npm install -g --ignore-scripts "@earendil-works/pi-coding-agent@$PI_VERSION"
```

Add extension-specific runtime dependencies after that. For semantic-code extensions, typical tools are:

```Dockerfile
# Go + gopls, Rust + rust-analyzer, uv + ty, ast-grep.
# Prefer official install paths or distro packages that behave like real Linux users would install.
```

Pass the active host Pi version with `docker build --build-arg PI_VERSION="$(pi --version)" ...` so Linux validates the same contract inspected during development. Pin other tools only when the product contract requires it; otherwise use current stable installers plus logged `--version` checks.

## Secrets and local-only image policy

For local-only validation, pass model API keys only to a dedicated model-only container after a credential-free build/package/install gate has produced the image or artifact state it consumes. The credentialed container must not run `npm ci`, install/pack/publish commands, or package/dependency lifecycle scripts.

Model-only shape:

```bash
set -e
: "${MODEL_PROVIDER:?Set the verified provider ID}"
: "${MODEL_ID:?Set MODEL_ID with its provider prefix}"
: "${MODEL_CREDENTIAL_NAME:?Set the reviewed credential variable mapped to MODEL_PROVIDER}"
[[ "$MODEL_ID" == "$MODEL_PROVIDER/"* ]]
[[ -n ${!MODEL_CREDENTIAL_NAME:-} ]] || { printf '%s is unset\n' "$MODEL_CREDENTIAL_NAME" >&2; exit 1; }
docker run --rm \
  --env "$MODEL_CREDENTIAL_NAME" \
  --volume "$PWD:/workspace:ro" \
  --volume "$PWD/tmp/linux-smoke:/artifacts" \
  --workdir /artifacts/project \
  pi-extension-linux-smoke:local \
  node /workspace/scripts/linux-smoke.mjs --model-only --model "$MODEL_ID"
```

Rules:

- Do not put API keys in `Dockerfile` `ENV`, `ARG`, `RUN`, labels, or copied files.
- Do not `COPY ~/.secrets` into the image.
- Do not echo secrets into logs.
- Do not push or publish the local validation image.
- Load only the required variables into the host environment and pass those names to `docker run`; do not source/export an entire secrets file into the harness process.
- Review the exact provider/model-to-credential mapping, model-only entrypoint, and extension code before forwarding a key; both processes can read that key by design.
- Reject credential-bearing project `.npmrc` files before package/dependency code; use sanitized staging or a separately authorized private-registry phase.

This is not about pretending local Docker is a hardened secret boundary. It is about keeping the harness boring, reusable, and hard to accidentally leak.

## Host-side script responsibilities

The project script should own orchestration so future agents do not hand-roll Docker commands. Invoke each phase through an allowlisted environment; `env -i` and a temporary `HOME` prevent `BASH_ENV`, shell startup files, npm config, SSH agents, and unrelated host credentials from reaching the orchestrator or its package-phase children:

```bash
set -e
if [[ -f .npmrc ]] && grep -Eiq '^[[:space:]]*([^#;=]*:)?(_auth(token)?|_password|password|username|token|otp|certfile|keyfile)[[:space:]]*=|^[[:space:]]*([^#;=]*:)?registry[[:space:]]*=[[:space:]]*[^[:space:]]*://[^/@[:space:]]+(:[^/@[:space:]]*)?@' .npmrc; then
  printf 'project .npmrc contains credential material; use sanitized staging or an explicitly authorized private-registry phase\n' >&2
  exit 1
fi
NODE_BIN="$(command -v node)"
if command -v mise >/dev/null 2>&1 && [[ "$NODE_BIN" == *"/mise/shims/"* ]]; then
  NODE_BIN="$(mise which node)"
elif command -v asdf >/dev/null 2>&1 && [[ "$NODE_BIN" == *"/.asdf/shims/"* || "$NODE_BIN" == *"/asdf/shims/"* ]]; then
  NODE_BIN="$(asdf which node)"
fi
safe_path="$(dirname "$NODE_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
host_home="$(mktemp -d)"
trap 'rm -rf -- "$host_home"' EXIT
umask 077
user_npmrc="$host_home/user.npmrc"
global_npmrc="$host_home/global.npmrc"
: > "$user_npmrc"
: > "$global_npmrc"
host_env=(
  env -i
  HOME="$host_home"
  PATH="$safe_path"
  TMPDIR="${TMPDIR:-/tmp}"
  USER="${USER:-pi-smoke}"
  LANG="${LANG:-C}"
  CI=1
  NPM_CONFIG_USERCONFIG="$user_npmrc"
  NPM_CONFIG_GLOBALCONFIG="$global_npmrc"
)
"${host_env[@]}" "$NODE_BIN" scripts/linux-smoke.mjs --build --no-model
: "${MODEL_PROVIDER:?Set the verified provider ID}"
: "${MODEL_ID:?Set MODEL_ID with its provider prefix}"
: "${MODEL_CREDENTIAL_NAME:?Set the reviewed credential variable mapped to MODEL_PROVIDER}"
[[ "$MODEL_ID" == "$MODEL_PROVIDER/"* ]]
credential_value="${!MODEL_CREDENTIAL_NAME:-}"
[[ -n "$credential_value" ]] || { printf '%s is unset\n' "$MODEL_CREDENTIAL_NAME" >&2; exit 1; }
"${host_env[@]}" "$MODEL_CREDENTIAL_NAME=$credential_value" \
  "$NODE_BIN" scripts/linux-smoke.mjs --model-only --model "$MODEL_ID"
rm -rf -- "$host_home"
trap - EXIT
```

If the local Docker transport needs a variable such as `DOCKER_HOST`, add only that reviewed non-secret variable to `host_env`. Recommended flags:

```bash
"$NODE_BIN" scripts/linux-smoke.mjs --help
"$NODE_BIN" scripts/linux-smoke.mjs --build
"$NODE_BIN" scripts/linux-smoke.mjs --no-model
"$NODE_BIN" scripts/linux-smoke.mjs --model-only --model <verified-model>
"$NODE_BIN" scripts/linux-smoke.mjs --keep-container
```

Responsibilities:

1. Verify Docker is available and capture the active `pi --version`.
2. Build a local-only image with that `PI_VERSION` and a deterministic tag such as `<package>-linux-smoke:local`.
3. Create a fresh artifact directory and print its path.
4. Run build, tests, package, and Pi install/resource checks in a credential-free container; persist the prepared image or artifact state needed by runtime smokes.
5. If live-model proof is requested, start a second model-only container from that prepared state and forward only the required credential names. Run no package manager or lifecycle command there.
6. Mount source read-only where practical and artifacts read-write at `/artifacts`.
7. Exit non-zero when any required gate fails.
8. Write a short summary JSON with separate package-gate and model-smoke status plus artifact paths.

Use `--no-model` for fast package/tool validation when live model calls are unnecessary or credentials are unavailable. Use live model mode when agent adoption, tool descriptions, prompt snippets, or model-visible behavior are under test.

## Credential-free package gate

Do not pass model credentials to this container. A strong Linux pass usually includes:

```bash
set -e
node --version
npm --version
pi --version

# Extension-specific external tools, when applicable.
ast-grep --version
ty --version
gopls version
rust-analyzer --version

npm ci
npm run ci
npm pack --dry-run --json
pack_json=/artifacts/npm-pack.json
npm pack --json --pack-destination /artifacts > "$pack_json"
package_name="$(node -p 'require("./package.json").name')"
packed_tarball="/artifacts/$(node -e '
const fs = require("node:fs");
const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (result.length !== 1 || !result[0].filename) throw new Error("expected one packed tarball");
process.stdout.write(result[0].filename);
' "$pack_json")"
[[ -f "$packed_tarball" ]]

# Prepare project-local package state on the persistent artifact volume.
mkdir -p /artifacts/project
cd /artifacts/project
pi install -l --approve "npm:${package_name}@file:${packed_tarball}"
```

Use explicit `--approve` / `--no-approve` in container smokes so the result does not depend on the image's global `defaultProjectTrust` setting. Persist the prepared install/image state needed by the next phase.

## Credentialed model-only gate

Only after the credential-free gate passes, verify runtime behavior with Pi from the prepared state. This phase may execute the extension under test with the model credential, but it must not run package or dependency lifecycle scripts. Examples:

- list or inspect loaded package resources when the repo has a helper for that
- invoke manual commands such as `/doctor`-style commands in print/json mode when supported
- run a fresh pi session with the extension loaded and confirm expected tools/commands are exposed
- run a small number of real model smokes when adoption matters

For model smokes, use a currently verified model and sessionful runs so JSONL can be inspected later:

```bash
# Run from /artifacts/project so Pi uses the credential-free prepared install.
: "${MODEL_ID:?Set MODEL_ID to a currently verified model ID}"
: "${THINKING_LEVEL:?Set THINKING_LEVEL to one supported by MODEL_ID}"
: "${SMOKE_PROMPT:?Set SMOKE_PROMPT to a realistic adoption task}"
pi --model "$MODEL_ID" --thinking "$THINKING_LEVEL" \
  --mode json \
  --approve \
  --session-dir /artifacts/sessions \
  -p "$SMOKE_PROMPT"
```

Pi 0.84.0 direct Kimi K3 routes expose `low`, `high`, and `max`. Still derive the smoke level from current model metadata rather than a model name. For Qwen Token Plan, map only `QWEN_TOKEN_PLAN_API_KEY` or `QWEN_TOKEN_PLAN_CN_API_KEY` for the selected route into the model-only phase.

Do not use `--no-session` for adoption smokes when session JSONL is useful evidence.

## Adoption-smoke pass/fail semantics

When the extension exposes model-callable tools, a live model smoke should check more than "the command exited".

Capture and inspect:

- model id and prompt
- first relevant tool choice
- whether extension tools were invoked naturally
- whether built-in shell/read/grep tools were chosen first for work the extension is supposed to cover
- validation errors and retries
- final answer honesty about degraded/partial evidence

Treat these as extension bugs to investigate when the product goal depends on natural use:

- the model ignores a clearly relevant custom tool
- the model chooses broad shell/grep/read paths before the extension for the intended task
- the model hits avoidable schema validation errors
- the model cannot tell what the tool is for from descriptions or prompt snippets

Remediate through pi-native surfaces first: tool `description`, `promptSnippet`, `promptGuidelines`, schemas, renderers, commands/help, lifecycle hooks, and agent-awareness guidance.

## Artifacts

Write enough evidence to make the Linux gate reviewable without re-running immediately:

```text
artifacts/
  summary.json
  versions.txt
  npm-ci.log
  npm-run-ci.log
  npm-pack.json
  pi-install.log
  doctor.json
  sessions/
    <pi session jsonl files>
```

Do not commit artifact directories unless the project explicitly tracks golden fixtures. Add them to `.gitignore` when needed.

## Documentation updates

When adding a Linux Docker harness to a repo, update the project source of truth:

- README validation or platform-support section
- release/readiness plan if one exists
- AGENTS.md only for project-specific durable rules, not transient logs
- changelog when the harness changes user-visible release readiness or validation claims

Use clear readiness language. If Linux validation has not passed, say that it has not passed. If it passes, cite the script command and artifact path.
