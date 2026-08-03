# Pi Extension Publishing Workflow

Use for Pi package preparation, release, publish, install, or update verification. Runtime hooks/tools/UI/providers still follow the main skill.

## Authorization boundary

Preparation is not permission to mutate external state.

- Without an explicit release/publish request, stop after local validation, dry-run packaging, and a release-ready report.
- Commit, tag, push, GitHub Release creation, npm publish, deployment, and credential reads each require user authorization that covers that action.
- Audits are read-only. Delete or rewrite local files only when the requested preparation scope authorizes working-tree edits; otherwise report cleanup findings.
- Stop before an ambiguous branch, tag, registry scope, package name, version, account, or repository.
- Use the shell-preloaded `NPM_TOKEN`; if it is missing, source `~/.secrets` only inside the isolated publish subshell. Never use `set -a`, and never expose the temporary auth config to npm lifecycle scripts.

## Current source of truth

Resolve `PI_ROOT` from the active `pi` command as shown in `SKILL.md`, then fully read:

- `$PI_ROOT/docs/packages.md`
- `$PI_ROOT/docs/extensions.md`
- `$PI_ROOT/docs/security.md` when project trust matters
- matching package examples such as `examples/extensions/with-deps/package.json`
- crossed `CHANGELOG.md` entries when Pi support changed

Confirm current CLI shape with `pi install --help`, `pi update --help`, `pi list --help`, `pi config --help`, and `pi --version`.

## Package contract

Prefer conventional publishable directories:

```text
extensions/
skills/
prompts/
themes/
```

Or declare only shipped paths in `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Do not publish `.pi/` as the primary package layout. It is project-local state/config unless a thin tracked wrapper is intentional.

Package rules:

- Include the `pi-package` keyword when the package should be discoverable and eligible for the Pi package gallery.
- Put imported Pi core packages in `peerDependencies` with `"*"`: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox`.
- Put required third-party runtime libraries in `dependencies`, not `devDependencies`.
- Put Pi resource packages referenced through `node_modules/...` in both `dependencies` and `bundledDependencies`.
- Do not store mutable data, caches, or generated artifacts inside managed Git package checkouts; Pi may reset and clean them during update.
- Optional package-gallery previews use `pi.video` (MP4) or `pi.image` (PNG/JPEG/GIF/WebP); video wins when both exist.

## Preparation gate

Run steps 2-8 in one persistent Bash process; their fenced blocks are sequential fragments that share variables and the cleanup trap. Keep `set -e` active so any failed gate stops preparation.

1. Inspect repo hygiene:

   ```bash
   git status --short --ignored
   git ls-files .pi
   git check-ignore -v .pi .DS_Store
   ```

   When working-tree cleanup is in scope, remove confirmed accidental tracked `.pi/` state, secrets, eval results, screenshots, temp exports, generated junk, or desktop artifacts without touching unrelated local work. In a read-only audit, report them instead.

2. Align `package.json`, README, license, changelog, package version, resource paths, dependency classes, repository metadata, and install commands. Inspect project `.npmrc`, scoped registry settings, and `publishConfig` without printing credential values. If `.npmrc` contains auth material, do not run project code in place; use a sanitized staging copy/container. Reject any `publishConfig.registry`, access, or tag that conflicts with the explicitly authorized npm release.

   ```bash
   set -e
   NODE_BIN="$(command -v node)"
   NPM_BIN="$(command -v npm)"
   PI_BIN="$(command -v pi)"
   if command -v mise >/dev/null 2>&1; then
     [[ "$NODE_BIN" != *"/mise/shims/"* ]] || NODE_BIN="$(mise which node)"
     [[ "$NPM_BIN" != *"/mise/shims/"* ]] || NPM_BIN="$(mise which npm)"
     [[ "$PI_BIN" != *"/mise/shims/"* ]] || PI_BIN="$(mise which pi)"
   fi
   if command -v asdf >/dev/null 2>&1; then
     [[ "$NODE_BIN" != *"/.asdf/shims/"* && "$NODE_BIN" != *"/asdf/shims/"* ]] || NODE_BIN="$(asdf which node)"
     [[ "$NPM_BIN" != *"/.asdf/shims/"* && "$NPM_BIN" != *"/asdf/shims/"* ]] || NPM_BIN="$(asdf which npm)"
     [[ "$PI_BIN" != *"/.asdf/shims/"* && "$PI_BIN" != *"/asdf/shims/"* ]] || PI_BIN="$(asdf which pi)"
   fi
   safe_path="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$(dirname "$PI_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

   if [[ -f .npmrc ]] && grep -Eiq '^[[:space:]]*([^#;=]*:)?(_auth(token)?|_password|password|username|token|otp|certfile|keyfile)[[:space:]]*=|^[[:space:]]*([^#;=]*:)?registry[[:space:]]*=[[:space:]]*[^[:space:]]*://[^/@[:space:]]+(:[^/@[:space:]]*)?@' .npmrc; then
     printf 'project .npmrc contains credential material; use sanitized staging\n' >&2
     exit 1
   fi
   "$NODE_BIN" -e '
   const fs = require("node:fs");
   const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
   const config = p.publishConfig ?? {};
   function inspect(value, depth = 0) {
     if (!value || typeof value !== "object") return;
     for (const [key, child] of Object.entries(value)) {
       if (/auth|password|username|token|otp|certfile|keyfile/i.test(key)) throw new Error("credential-shaped publishConfig key");
       if (/registry$/i.test(key) && !(depth === 0 && key === "registry")) throw new Error("scoped/nested publishConfig registry is not allowed");
       inspect(child, depth + 1);
     }
   }
   inspect(config);
   if (config.registry && config.registry.replace(/\/+$/, "") !== "https://registry.npmjs.org") throw new Error("unexpected publishConfig.registry");
   console.log(JSON.stringify({ registry: config.registry ?? null, access: config.access ?? null, tag: config.tag ?? null }));
   '
   ```

3. Create an allowlisted preparation environment. A temporary `HOME`, isolated user/global npm config, pinned public registry, and `env -i` keep auto-loaded credentials, `BASH_ENV`, shell startup files, npm auth, SSH agents, and unrelated process state out of project/dependency code. Project `.npmrc` remains visible because these checks run in the repo, so the review in step 2 is mandatory:

   ```bash
   clean_home="$(mktemp -d)"
   cleanup() { [[ -z ${clean_home:-} ]] || rm -rf -- "$clean_home"; }
   trap cleanup EXIT
   umask 077
   user_npmrc="$clean_home/user.npmrc"
   global_npmrc="$clean_home/global.npmrc"
   : > "$user_npmrc"
   : > "$global_npmrc"
   clean_env=(
     env -i
     HOME="$clean_home"
     PATH="$safe_path"
     TMPDIR="${TMPDIR:-/tmp}"
     USER="${USER:-pi-release}"
     LANG="${LANG:-C}"
     CI=1
     NPM_CONFIG_USERCONFIG="$user_npmrc"
     NPM_CONFIG_GLOBALCONFIG="$global_npmrc"
     NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
     NPM_CONFIG_CACHE="$clean_home/.npm"
     GIT_CONFIG_GLOBAL=/dev/null
     GIT_CONFIG_NOSYSTEM=1
   )
   ```

   Do not execute untrusted code merely because the environment is scrubbed; use a sandbox/container for that.

4. Prefix the repo's actual test, type-check, lint/format, build, reviewed build/prepack, and runtime commands with `"${clean_env[@]}"`. Inspect lifecycle scripts first:

   ```bash
   "${clean_env[@]}" "$NPM_BIN" pkg get scripts
   # "${clean_env[@]}" "$NPM_BIN" test
   # "${clean_env[@]}" "$NPM_BIN" run typecheck
   # "${clean_env[@]}" "$NPM_BIN" run build
   ```

5. Inspect the exact publish payload without lifecycle hooks:

   ```bash
   "${clean_env[@]}" "$NPM_BIN" publish --dry-run --ignore-scripts

   pack_json="$clean_home/pack.json"
   "${clean_env[@]}" "$NPM_BIN" pack --json --ignore-scripts --pack-destination "$clean_home" > "$pack_json"
   tarball="$clean_home/$("${clean_env[@]}" "$NODE_BIN" -e '
   const fs = require("node:fs");
   const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
   if (result.length !== 1 || !result[0].filename) throw new Error("expected one packed tarball");
   process.stdout.write(result[0].filename);
   ' "$pack_json")"
   [[ -f "$tarball" ]] || { printf 'packed tarball not found: %s\n' "$tarball" >&2; exit 1; }
   ```

   If the package truly requires publish lifecycle hooks, review the exact hooks and stop for explicit approval before allowing them to run with registry credentials.

6. Verify the packed artifact from a fresh temporary project. Use an npm `file:` source so Pi exercises managed npm installation and dependency behavior; a raw tarball path is only one extension file, and an absolute source directory only proves linked local-resource loading:

   ```bash
   package_name="$("${clean_env[@]}" "$NODE_BIN" -p 'require(process.argv[1]).name' "$PWD/package.json")"
   package_source="npm:${package_name}@file:${tarball}"
   mkdir -p "$clean_home/smoke"
   (
     set -e
     cd "$clean_home/smoke"
     "${clean_env[@]}" "$PI_BIN" install -l --approve "$package_source"
     "${clean_env[@]}" "$PI_BIN" list --approve
   )
   ```

   Add a separate absolute-directory smoke only when linked local development is part of the contract. Add a `--no-approve` check only when ignored trust-gated project inputs are part of the contract. Context files are separate from project trust.

7. Verify expected resources through their real surface: RPC `get_commands`, `pi --list-models "$PROVIDER_ID"` after validating `PROVIDER_ID`, command/tool execution, resource listing/config, or TUI inspection as applicable. `pi config -l` starts in project overrides; Tab switches global/project scopes.

8. Remove the clean environment (`cleanup; trap - EXIT`), report release readiness, and stop unless external mutation was explicitly requested.

## Explicit release flow

Run only the authorized actions, in order, and verify each before continuing:

1. Commit the exact release files.
2. Create annotated tag `v<version>` at the intended commit.
3. Create and inspect one retained release artifact from that clean tagged commit with the shell below.
4. Push the intended branch and tag.
5. Create the GitHub Release from the matching changelog entry.
6. Publish the exact retained artifact with the intended registry/account/package/version.

Do not repack after step 3. Run the artifact-preparation shell before any push, release creation, or npm credential read. Set `AUTHORIZED_GIT_COMMIT`, `AUTHORIZED_GIT_TAG`, `AUTHORIZED_NPM_NAME`, `AUTHORIZED_NPM_VERSION`, `AUTHORIZED_NPM_TAG`, and `AUTHORIZED_NPM_ACCESS` (`default`, `public`, or `restricted`) from the explicit release authorization.

```bash
(
  set -e
  : "${AUTHORIZED_GIT_COMMIT:?Set the explicitly authorized release commit}"
  : "${AUTHORIZED_GIT_TAG:?Set the explicitly authorized annotated git tag}"
  : "${AUTHORIZED_NPM_NAME:?Set the explicitly authorized npm package name}"
  : "${AUTHORIZED_NPM_VERSION:?Set the explicitly authorized npm version}"
  : "${AUTHORIZED_NPM_TAG:?Set the explicitly authorized npm dist-tag}"
  : "${AUTHORIZED_NPM_ACCESS:?Set default, public, or restricted}"
  [[ "$AUTHORIZED_NPM_ACCESS" =~ ^(default|public|restricted)$ ]] || { printf 'invalid authorized npm access\n' >&2; exit 1; }
  [[ "$AUTHORIZED_GIT_TAG" == "v$AUTHORIZED_NPM_VERSION" ]] || { printf 'git tag/version mismatch\n' >&2; exit 1; }

  package_dir="$PWD"
  actual_git_commit="$(git -C "$package_dir" rev-parse HEAD)"
  tag_git_commit="$(git -C "$package_dir" rev-parse "$AUTHORIZED_GIT_TAG^{commit}")"
  tag_object_type="$(git -C "$package_dir" cat-file -t "$AUTHORIZED_GIT_TAG")"
  [[ "$actual_git_commit" == "$AUTHORIZED_GIT_COMMIT" && "$tag_git_commit" == "$AUTHORIZED_GIT_COMMIT" && "$tag_object_type" == tag ]] || { printf 'release commit/tag mismatch\n' >&2; exit 1; }
  [[ -z "$(git -C "$package_dir" status --porcelain=v1 --untracked-files=all)" ]] || { printf 'working tree changed after release commit/tag\n' >&2; exit 1; }
  registry="https://registry.npmjs.org/"
  NODE_BIN="$(command -v node)"
  NPM_BIN="$(command -v npm)"
  PI_BIN="$(command -v pi)"
  if command -v mise >/dev/null 2>&1; then
    [[ "$NODE_BIN" != *"/mise/shims/"* ]] || NODE_BIN="$(mise which node)"
    [[ "$NPM_BIN" != *"/mise/shims/"* ]] || NPM_BIN="$(mise which npm)"
    [[ "$PI_BIN" != *"/mise/shims/"* ]] || PI_BIN="$(mise which pi)"
  fi
  if command -v asdf >/dev/null 2>&1; then
    [[ "$NODE_BIN" != *"/.asdf/shims/"* && "$NODE_BIN" != *"/asdf/shims/"* ]] || NODE_BIN="$(asdf which node)"
    [[ "$NPM_BIN" != *"/.asdf/shims/"* && "$NPM_BIN" != *"/asdf/shims/"* ]] || NPM_BIN="$(asdf which npm)"
    [[ "$PI_BIN" != *"/.asdf/shims/"* && "$PI_BIN" != *"/asdf/shims/"* ]] || PI_BIN="$(asdf which pi)"
  fi
  safe_path="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$(dirname "$PI_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  umask 077
  temp_root="${TMPDIR:-/tmp}"
  publish_home="$(mktemp -d "${temp_root%/}/pi-release.XXXXXX")"
  # shellcheck disable=SC2034 # Read by the EXIT trap.
  cleanup_release_artifact=1
  trap '(( cleanup_release_artifact == 0 )) || rm -rf -- "$publish_home"' EXIT
  base_npmrc="$publish_home/base.npmrc"
  global_npmrc="$publish_home/global.npmrc"
  : > "$base_npmrc"
  : > "$global_npmrc"

  base_env=(
    env -i
    HOME="$publish_home"
    PATH="$safe_path"
    TMPDIR="${TMPDIR:-/tmp}"
    USER="${USER:-pi-release}"
    LANG="${LANG:-C}"
    CI=1
    NPM_CONFIG_USERCONFIG="$base_npmrc"
    NPM_CONFIG_GLOBALCONFIG="$global_npmrc"
    NPM_CONFIG_REGISTRY="$registry"
    NPM_CONFIG_CACHE="$publish_home/.npm"
    GIT_CONFIG_GLOBAL=/dev/null
    GIT_CONFIG_NOSYSTEM=1
  )

  # shellcheck disable=SC2016 # JavaScript is intentionally single-quoted.
  "${base_env[@]}" "$NODE_BIN" -e '
  const fs = require("node:fs");
  const [path, name, version, registry, tag, access] = process.argv.slice(1);
  const p = JSON.parse(fs.readFileSync(path, "utf8"));
  const config = p.publishConfig ?? {};
  function inspect(value, depth = 0) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (/auth|password|username|token|otp|certfile|keyfile/i.test(key)) throw new Error("credential-shaped publishConfig key");
      if (/registry$/i.test(key) && !(depth === 0 && key === "registry")) throw new Error("scoped/nested publishConfig registry is not allowed");
      inspect(child, depth + 1);
    }
  }
  inspect(config);
  const actual = {
    name: p.name,
    version: p.version,
    registry: (config.registry ?? "https://registry.npmjs.org/").replace(/\/+$/, ""),
    tag: config.tag ?? "latest",
    access: config.access ?? "default",
  };
  const expected = { name, version, registry: registry.replace(/\/+$/, ""), tag, access };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`release identity mismatch: ${JSON.stringify({ actual, expected })}`);
  console.log(JSON.stringify(actual));
  ' "$package_dir/package.json" "$AUTHORIZED_NPM_NAME" "$AUTHORIZED_NPM_VERSION" "$registry" "$AUTHORIZED_NPM_TAG" "$AUTHORIZED_NPM_ACCESS"

  cd "$publish_home"
  pack_json="$publish_home/pack.json"
  "${base_env[@]}" "$NPM_BIN" pack "$package_dir" --json --ignore-scripts --pack-destination "$publish_home" > "$pack_json"
  tarball="$publish_home/$("${base_env[@]}" "$NODE_BIN" -e '
  const fs = require("node:fs");
  const [path, name, version] = process.argv.slice(1);
  const result = JSON.parse(fs.readFileSync(path, "utf8"));
  if (result.length !== 1 || result[0].name !== name || result[0].version !== version || !result[0].filename || !Array.isArray(result[0].files)) {
    throw new Error("packed artifact identity or file manifest mismatch");
  }
  process.stdout.write(result[0].filename);
  ' "$pack_json" "$AUTHORIZED_NPM_NAME" "$AUTHORIZED_NPM_VERSION")"
  [[ -f "$tarball" ]] || { printf 'packed tarball not found: %s\n' "$tarball" >&2; exit 1; }
  "${base_env[@]}" "$NODE_BIN" -e '
  const fs = require("node:fs");
  const [result] = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  console.log(JSON.stringify({ name: result.name, version: result.version, filename: result.filename, files: result.files.map(({ path, size, mode }) => ({ path, size, mode })) }, null, 2));
  ' "$pack_json"

  tarball_sha256="$("${base_env[@]}" "$NODE_BIN" -e '
  const fs = require("node:fs");
  const crypto = require("node:crypto");
  process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));
  ' "$tarball")"

  mkdir -p "$publish_home/smoke"
  (
    cd "$publish_home/smoke"
    "${base_env[@]}" PI_OFFLINE=1 "$PI_BIN" install -l --approve "npm:${AUTHORIZED_NPM_NAME}@file:${tarball}"
    "${base_env[@]}" PI_OFFLINE=1 "$PI_BIN" list --approve
  )
  post_smoke_sha256="$("${base_env[@]}" "$NODE_BIN" -e '
  const fs = require("node:fs");
  const crypto = require("node:crypto");
  process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));
  ' "$tarball")"
  [[ "$post_smoke_sha256" == "$tarball_sha256" ]] || { printf 'release tarball changed during install smoke\n' >&2; exit 1; }
  artifact_id="$("${base_env[@]}" "$NODE_BIN" -p 'require("node:crypto").randomUUID()')"
  printf '%s\n' "$artifact_id" > "$publish_home/.pi-release-artifact"
  "${base_env[@]}" "$NODE_BIN" -e '
  const fs = require("node:fs");
  const [path, artifactId, name, version, registry, tag, access, gitCommit, gitTag, filename, sha256] = process.argv.slice(1);
  fs.writeFileSync(path, JSON.stringify({ artifactId, name, version, registry, tag, access, gitCommit, gitTag, filename, sha256 }, null, 2) + "\n", { mode: 0o600 });
  ' "$publish_home/release-evidence.json" "$artifact_id" "$AUTHORIZED_NPM_NAME" "$AUTHORIZED_NPM_VERSION" "${registry%/}" "$AUTHORIZED_NPM_TAG" "$AUTHORIZED_NPM_ACCESS" "$actual_git_commit" "$AUTHORIZED_GIT_TAG" "${tarball##*/}" "$tarball_sha256"
  # shellcheck disable=SC2034 # Read by the EXIT trap.
  cleanup_release_artifact=0
  printf 'RELEASE_ARTIFACT_DIR=%s\nRELEASE_TARBALL_SHA256=%s\nRELEASE_GIT_COMMIT=%s\nRELEASE_GIT_TAG=%s\n' "$publish_home" "$tarball_sha256" "$actual_git_commit" "$AUTHORIZED_GIT_TAG"
)
```

Stop here. Inspect the printed file manifest, install/resource evidence, git commit/tag, package identity, registry, npm tag, and access. Only after this gate, push the authorized branch/tag and create the matching GitHub Release. Then pass the retained artifact directory and SHA-256 into the publication shell with the same authorized git commit/tag and the authorized `npm whoami` account.

For npm authentication, use the `NPM_TOKEN` already loaded from `~/.secrets`. If it is unexpectedly absent, source that file only inside the publish subshell. Do not use `set -a`. Publish without lifecycle hooks so package scripts cannot read the temporary auth config; the subshell removes that config immediately on success, failure, or shell exit.

```bash
(
  set -e
  : "${RELEASE_ARTIFACT_DIR:?Set the inspected release artifact directory}"
  : "${RELEASE_TARBALL_SHA256:?Set the inspected tarball SHA-256}"
  : "${AUTHORIZED_GIT_COMMIT:?Set the same authorized release commit}"
  : "${AUTHORIZED_GIT_TAG:?Set the same authorized annotated git tag}"
  : "${AUTHORIZED_NPM_ACCOUNT:?Set the explicitly authorized npm account from npm whoami}"
  : "${AUTHORIZED_NPM_NAME:?Set the explicitly authorized npm package name}"
  : "${AUTHORIZED_NPM_VERSION:?Set the explicitly authorized npm version}"
  : "${AUTHORIZED_NPM_TAG:?Set the explicitly authorized npm dist-tag}"
  : "${AUTHORIZED_NPM_ACCESS:?Set default, public, or restricted}"
  [[ "$AUTHORIZED_NPM_ACCESS" =~ ^(default|public|restricted)$ ]] || { printf 'invalid authorized npm access\n' >&2; exit 1; }
  [[ "$AUTHORIZED_GIT_TAG" == "v$AUTHORIZED_NPM_VERSION" ]] || { printf 'git tag/version mismatch\n' >&2; exit 1; }

  umask 077
  registry="https://registry.npmjs.org/"
  secrets_file="$HOME/.secrets"
  NODE_BIN="$(command -v node)"
  NPM_BIN="$(command -v npm)"
  if command -v mise >/dev/null 2>&1; then
    [[ "$NODE_BIN" != *"/mise/shims/"* ]] || NODE_BIN="$(mise which node)"
    [[ "$NPM_BIN" != *"/mise/shims/"* ]] || NPM_BIN="$(mise which npm)"
  fi
  if command -v asdf >/dev/null 2>&1; then
    [[ "$NODE_BIN" != *"/.asdf/shims/"* && "$NODE_BIN" != *"/asdf/shims/"* ]] || NODE_BIN="$(asdf which node)"
    [[ "$NPM_BIN" != *"/.asdf/shims/"* && "$NPM_BIN" != *"/asdf/shims/"* ]] || NPM_BIN="$(asdf which npm)"
  fi
  safe_path="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  artifact_dir="$(env -i PATH="$safe_path" "$NODE_BIN" -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "$RELEASE_ARTIFACT_DIR")"
  temp_root="$(env -i PATH="$safe_path" "$NODE_BIN" -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "${TMPDIR:-/tmp}")"
  [[ "${artifact_dir%/*}" == "$temp_root" && "${artifact_dir##*/}" == pi-release.* ]] || { printf 'unexpected release artifact path: %s\n' "$artifact_dir" >&2; exit 1; }

  evidence_json="$artifact_dir/release-evidence.json"
  marker_path="$artifact_dir/.pi-release-artifact"
  pack_json="$artifact_dir/pack.json"
  # shellcheck disable=SC2016 # JavaScript is intentionally single-quoted.
  tarball="$(env -i PATH="$safe_path" "$NODE_BIN" -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const crypto = require("node:crypto");
  const [evidencePath, markerPath, packPath, artifactDir, name, version, registry, tag, access, gitCommit, gitTag, expectedHash] = process.argv.slice(1);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const marker = fs.readFileSync(markerPath, "utf8").trim();
  const result = JSON.parse(fs.readFileSync(packPath, "utf8"));
  const expected = { name, version, registry: registry.replace(/\/+$/, ""), tag, access, gitCommit, gitTag };
  for (const [key, value] of Object.entries(expected)) if (evidence[key] !== value) throw new Error(`release evidence ${key} mismatch`);
  if (!marker || evidence.artifactId !== marker) throw new Error("release artifact marker mismatch");
  if (result.length !== 1 || result[0].name !== name || result[0].version !== version || result[0].filename !== evidence.filename) throw new Error("release pack identity mismatch");
  const tarball = path.join(artifactDir, evidence.filename);
  if (path.dirname(tarball) !== artifactDir) throw new Error("release tarball escaped artifact directory");
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(tarball)).digest("hex");
  if (actualHash !== evidence.sha256 || actualHash !== expectedHash) throw new Error("release tarball hash changed");
  process.stdout.write(tarball);
  ' "$evidence_json" "$marker_path" "$pack_json" "$artifact_dir" "$AUTHORIZED_NPM_NAME" "$AUTHORIZED_NPM_VERSION" "$registry" "$AUTHORIZED_NPM_TAG" "$AUTHORIZED_NPM_ACCESS" "$AUTHORIZED_GIT_COMMIT" "$AUTHORIZED_GIT_TAG" "$RELEASE_TARBALL_SHA256")"
  artifact_id="$(env -i PATH="$safe_path" "$NODE_BIN" -p 'require(process.argv[1]).artifactId' "$evidence_json")"
  [[ ! -e "$artifact_dir/.npmrc" ]] || { printf 'unexpected project .npmrc in release artifact directory\n' >&2; exit 1; }

  cd "$artifact_dir"
  auth_npmrc="$artifact_dir/auth.npmrc"
  trap 'rm -f -- "$auth_npmrc"' EXIT
  if [[ -z ${NPM_TOKEN:-} ]]; then
    # shellcheck disable=SC1090 # The fixed user secrets path is resolved at runtime.
    source "$secrets_file"
  fi
  : "${NPM_TOKEN:?NPM_TOKEN is missing from the shell and ~/.secrets}"
  printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$auth_npmrc"
  unset NPM_TOKEN
  publish_env=(
    env -i
    HOME="$artifact_dir"
    PATH="$safe_path"
    TMPDIR="${TMPDIR:-/tmp}"
    USER="${USER:-pi-release}"
    LANG="${LANG:-C}"
    CI=1
    NPM_CONFIG_USERCONFIG="$auth_npmrc"
    NPM_CONFIG_GLOBALCONFIG="$artifact_dir/global.npmrc"
    NPM_CONFIG_REGISTRY="$registry"
    NPM_CONFIG_CACHE="$artifact_dir/.npm"
    GIT_CONFIG_GLOBAL=/dev/null
    GIT_CONFIG_NOSYSTEM=1
  )
  publish_args=(publish "$tarball" --registry="$registry" --tag="$AUTHORIZED_NPM_TAG" --ignore-scripts)
  [[ "$AUTHORIZED_NPM_ACCESS" == default ]] || publish_args+=(--access="$AUTHORIZED_NPM_ACCESS")
  actual_account="$("${publish_env[@]}" "$NPM_BIN" whoami --registry="$registry")"
  [[ "$actual_account" == "$AUTHORIZED_NPM_ACCOUNT" ]] || { printf 'npm account mismatch: expected %s, got %s\n' "$AUTHORIZED_NPM_ACCOUNT" "$actual_account" >&2; exit 1; }
  "${publish_env[@]}" "$NPM_BIN" "${publish_args[@]}"

  rm -f -- "$auth_npmrc"
  trap - EXIT
  [[ -f "$marker_path" && "$(cat "$marker_path")" == "$artifact_id" ]] || { printf 'release artifact marker changed; preserve and investigate\n' >&2; exit 1; }
  printf 'RELEASE_ARTIFACT_DIR=%s\n' "$artifact_dir"
)
```

Stop if inspection evidence, `npm whoami`, package identity, version, tag, branch, or dry-run contents differ from the authorized release. If publication is cancelled, remove the credential-free artifact directory after retaining any required evidence. After successful publication, preserve `RELEASE_ARTIFACT_DIR` until exact-version verification succeeds; it contains no auth file and anchors the inspected manifest/hash.

## Post-release verification

Verify public release/install/update behavior through another clean environment pinned to the same registry. Verify the exact immutable npm version before trusting `latest`:

```bash
(
  set -e
  : "${AUTHORIZED_NPM_NAME:?Set the published package name}"
  : "${AUTHORIZED_NPM_VERSION:?Set the published immutable version}"
  : "${RELEASE_ARTIFACT_DIR:?Set the preserved published artifact directory}"
  registry="https://registry.npmjs.org/"
  NODE_BIN="$(command -v node)"
  NPM_BIN="$(command -v npm)"
  PI_BIN="$(command -v pi)"
  if command -v mise >/dev/null 2>&1; then
    [[ "$NODE_BIN" != *"/mise/shims/"* ]] || NODE_BIN="$(mise which node)"
    [[ "$NPM_BIN" != *"/mise/shims/"* ]] || NPM_BIN="$(mise which npm)"
    [[ "$PI_BIN" != *"/mise/shims/"* ]] || PI_BIN="$(mise which pi)"
  fi
  if command -v asdf >/dev/null 2>&1; then
    [[ "$NODE_BIN" != *"/.asdf/shims/"* && "$NODE_BIN" != *"/asdf/shims/"* ]] || NODE_BIN="$(asdf which node)"
    [[ "$NPM_BIN" != *"/.asdf/shims/"* && "$NPM_BIN" != *"/asdf/shims/"* ]] || NPM_BIN="$(asdf which npm)"
    [[ "$PI_BIN" != *"/.asdf/shims/"* && "$PI_BIN" != *"/asdf/shims/"* ]] || PI_BIN="$(asdf which pi)"
  fi
  safe_path="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$(dirname "$PI_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  verify_home="$(mktemp -d)"
  verify_complete=0
  cleanup_verify() {
    if (( verify_complete )); then
      rm -rf -- "$verify_home"
    else
      printf 'POST_RELEASE_EVIDENCE_DIR=%s\n' "$verify_home" >&2
    fi
  }
  trap cleanup_verify EXIT
  umask 077
  user_npmrc="$verify_home/user.npmrc"
  global_npmrc="$verify_home/global.npmrc"
  : > "$user_npmrc"
  : > "$global_npmrc"
  verify_env=(
    env -i
    HOME="$verify_home"
    PATH="$safe_path"
    TMPDIR="${TMPDIR:-/tmp}"
    USER="${USER:-pi-release}"
    LANG="${LANG:-C}"
    CI=1
    NPM_CONFIG_USERCONFIG="$user_npmrc"
    NPM_CONFIG_GLOBALCONFIG="$global_npmrc"
    NPM_CONFIG_REGISTRY="$registry"
    NPM_CONFIG_CACHE="$verify_home/.npm"
    GIT_CONFIG_GLOBAL=/dev/null
    GIT_CONFIG_NOSYSTEM=1
  )
  mkdir -p "$verify_home/project"
  cd "$verify_home/project"
  "${verify_env[@]}" "$PI_BIN" install -l --approve "npm:${AUTHORIZED_NPM_NAME}@${AUTHORIZED_NPM_VERSION}" > "$verify_home/pi-install.log" 2>&1
  "${verify_env[@]}" "$PI_BIN" list --approve > "$verify_home/pi-list.log" 2>&1
  "${verify_env[@]}" "$NPM_BIN" view "${AUTHORIZED_NPM_NAME}@${AUTHORIZED_NPM_VERSION}" version readme keywords license author --json --registry="$registry" > "$verify_home/npm-version.json" 2> "$verify_home/npm-version.err"
  "${verify_env[@]}" "$NPM_BIN" view "$AUTHORIZED_NPM_NAME" dist-tags.latest --json --registry="$registry" > "$verify_home/npm-latest.json" 2> "$verify_home/npm-latest.err"

  # Run only when the public Git URL is a documented install path:
  # "${verify_env[@]}" "$PI_BIN" install -l --approve https://github.com/<owner>/<repo>
  # "${verify_env[@]}" "$PI_BIN" list --approve

  # Run only when one-package update behavior is part of the release gate:
  # "${verify_env[@]}" "$PI_BIN" update --extension "npm:${AUTHORIZED_NPM_NAME}" --approve

  artifact_dir="$(env -i PATH="$safe_path" "$NODE_BIN" -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "$RELEASE_ARTIFACT_DIR")"
  temp_root="$(env -i PATH="$safe_path" "$NODE_BIN" -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "${TMPDIR:-/tmp}")"
  [[ "${artifact_dir%/*}" == "$temp_root" && "${artifact_dir##*/}" == pi-release.* ]]
  [[ -f "$artifact_dir/.pi-release-artifact" && -f "$artifact_dir/release-evidence.json" && -f "$artifact_dir/pack.json" ]]
  env -i PATH="$safe_path" "$NODE_BIN" -e '
  const evidence = require(process.argv[1]);
  const [name, version] = process.argv.slice(2);
  if (evidence.name !== name || evidence.version !== version) throw new Error("release evidence identity mismatch before cleanup");
  ' "$artifact_dir/release-evidence.json" "$AUTHORIZED_NPM_NAME" "$AUTHORIZED_NPM_VERSION"
  rm -rf -- "$artifact_dir"
  verify_complete=1
)
```

Exact npm versions are pinned and skipped by package updates. A real update gate must preserve a separate clean project installed from unpinned `npm:${AUTHORIZED_NPM_NAME}` while the previous release is still latest, then run `pi update --extension "npm:${AUTHORIZED_NPM_NAME}" --approve` after publication and assert the installed version changed to `AUTHORIZED_NPM_VERSION`. Do not present an update command against the exact-version project above as proof.

Use `pi update --all --approve` only when the intended gate includes Pi and every package. Bare `pi update` updates Pi itself, not installed packages. Private registry/Git verification needs a separately authorized, narrowly scoped credential flow; do not reintroduce the full host environment.

If immutable-version verification fails after publication, stop, preserve the artifact and verification logs, and report the exact published version. Do not unpublish, deprecate, or republish without separate explicit authorization.

## Done

Preparation is done when package shape, dry-run payload, local install, resource discovery, trust behavior, docs, metadata, and validation agree. Release is done only when every explicitly authorized external action and exact-version post-release check succeeds; report any unperformed action as unperformed, not implied complete.
