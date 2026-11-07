---
name: pi-development
description: "Build, debug, review, or package extensions for official Pi releases and the fitchmultz/pi fork: tools/events, TUI, providers, SDK/RPC, and resource install/discovery. Excludes Pi core, skill-content or prompt-only authoring, Crabbox/cbx, platform matrices (including Pi extensions), dependency research, and non-Pi publishing."
compatibility: "Pi 1.5.0+ (official release) and fitchmultz/pi fork (commit ea5fe4563fd15e7b630fa33c776865a1e30c7acb or newer); always resolve and build to the current latest official release, latest fork HEAD, and latest dependency versions. Python 3.9+ for the bundled resolver."
metadata:
  version: "4.1.0"
  last-verified-pi: "1.5.0"
  official-source: "f9a26365568127461c47a07a37dcb42c140a3ac5"
  fork-source: "e3cabf1de0775895e2b2086729dbbe65ed3f426f"
---

# Pi development

Develop for **both** the current latest official Pi release (`earendil-works/pi`) and the current latest commit HEAD of Mitch's `fitchmultz/pi` fork, preserving requested power-user behavior and checking each exact target contract.

The minimum supported baselines are official Pi **`1.5.0`** (`f9a26365568127461c47a07a37dcb42c140a3ac5`) and `fitchmultz/pi` **`1.5.0`** commit **`ea5fe4563fd15e7b630fa33c776865a1e30c7acb`**. The [version hazards reference](references/current-version-hazards.md) distinguishes these floors from the latest inspected revisions and post-release contracts. Treat the floors as minimums, never as static pins:
- Never build for or keep compatibility shims/fallbacks for anything older than official Pi `1.5.0`, anything older than fork commit `ea5fe4563fd15e7b630fa33c776865a1e30c7acb`, or older versions of referenced packages/tools.
- Always check and target the **latest** official Pi release, the **latest** `fitchmultz/pi` commit HEAD, and the **latest** versions of all dependencies and companion tools at the time you run. A matching version number does not make official Pi and the fork identical.

## Scope and prerequisites

Use a skill for instructions, a prompt template for user-invoked expansion, a command for explicit runtime/UI control, a tool for model-callable capability, an event for lifecycle/policy hooks, and SDK/RPC when another process owns sessions. Package the resources that need sharing; do not add runtime code for prompt-only work.

For skill content, Crabbox, platform matrices, or external dependency research, use `agent-skill-engineering`, `crabbox-platform-testing`, `platform-validation`, or `external-repo-integration` **if available**. These are optional companion skills, not bundled prerequisites. Otherwise use the relevant current project/vendor sources directly. Pi package install/discovery remains in this skill even when the package ships skills.

`change_dir` (`pi-change-working-dir`, floor `0.6.0+`), `ask_question`, browser tools, and `delegate`/`agent_runs`/`load_subagent` (`@fitchmultz/pi-subagents`, floor `0.52.6+`) come from separate extensions on both hosts; inspect available tools and their latest versions rather than assuming Pi supplies them. If an integration is absent from the active tool list, inspect any advertised discovery catalog before declaring it unavailable or substituting another tool. The `fitchmultz/pi` fork's `discover_tools` (`builtin:instruction-groups`) collects extension-owned groups synchronously through `pi:instruction-groups` at session start; see `docs/instruction-groups.md` and `references/current-version-hazards.md`. Keep complete official-host instructions/exposure when unmanaged; no user-maintained settings inventory. Enabling a group executes no integration action, restores only previously selected tools for a later turn, and is distinct from provider-native tool search or an extension's MCP gateway. Question dialogs need TUI or an RPC client that services them, not plain print mode. Do not silently replace a workflow's required approval gate with a default answer.

## Resolve the source of truth

Run the bundled read-only resolver by its absolute skill-relative path:

```bash
python3 <skill-dir>/scripts/resolve_pi.py --json
pi --version
```

The resolver verifies `PI_PACKAGE_DIR` first; otherwise it resolves the launcher, including mise/asdf. An override needs no `pi` on PATH and returns null launcher fields: verify runnable Pi separately. `--pi PATH` deliberately ignores the override.

Record package root, version, distribution/revision, relevant exports, executable `dist/*.js`, emitted `.d.ts`, and observed behavior. Those win over stale docs/examples. Read relevant sections of version-matched docs and examples, follow links needed to establish the affected contracts, and verify copied APIs against matching implementation/types. Read crossed changelog entries and relevant commit diffs since the last inspected revision. Upstream `main` is not the latest official release: a change already integrated into the fork can still be absent from the published official host.

Mitch runs `fitchmultz/pi`; extensions must support **both** the latest official Pi release and the latest `fitchmultz/pi` commit HEAD. `pi-posthorse` uses public retain-none compaction on official Pi `1.5.0+`; it is not a fork-only exception. Verify affected APIs and runtime behavior against both latest targets using their matching sources/types, prefer shared native capabilities, and reuse still-valid evidence. The source versions recorded in frontmatter identify inspected sources, not a reason to skip a newer release or commit.

Select the targets before implementing:

- Query the current latest stable official release (`gh release view --repo earendil-works/pi --json tagName,url`, floor `1.5.0+`) and use that latest official version for implementation and validation. Use its official package/source, not a fork artifact with the same version.
- Query the current latest `fitchmultz/pi` commit HEAD (`gh api repos/fitchmultz/pi/commits/main --jq .sha`, floor `ea5fe4563fd15e7b630fa33c776865a1e30c7acb` or newer) or active checkout/release manifest. Record installed versus latest revisions separately; do not update the user's runtime merely to validate a change.
- Resolve each runnable target with `python3 <skill-dir>/scripts/resolve_pi.py --pi /absolute/path/to/target/pi --json` and run that launcher's `--version`. A package-only `PI_PACKAGE_DIR` override proves source identity, not which host will execute tests.
- Keep a small evidence table: distribution, version/revision, launcher/package root, Node executable, affected checks/results. Use separate temporary projects and agent directories so one host's resources, credentials, or cached state cannot stand in for the other.

Prefer APIs exported by both latest targets. Optional fork enhancements must leave a complete official-host path; inspect actual capabilities rather than branching on the shared version string. Do not import fork-only symbols at module load in a portable extension or add no-op shims that disguise missing behavior. If a required capability has no supported official equivalent, report that specific blocker rather than silently dropping it or declaring the whole extension fork-only.

When install/runtime identity matters, compare `type -a pi`, `pi --version`, `command -v node`, and `node --version` inside and outside the project in clean shells. Duplicate installations can share `~/.pi/agent` unless `PI_CODING_AGENT_DIR` differs. Report shadowing; remove a stale installation only with explicit authorization and its exact runtime prefix, never a plain global uninstall. Reshim/rehash and reverify afterward.

## Load only the relevant contract

Paths below are relative to the resolved Pi package unless prefixed `references/`. Read `references/current-version-hazards.md` before copying affected APIs; it distinguishes shared contracts from fork additions at the `1.5.0`+ floor. Its Pi 1.5.0 contracts section covers tool arguments validated by `@earendil-works/pi-schema`, `typebox` imports, `StringEnum` typing and injected key hints; apply it to every tool, renderer and provider stream you touch.

| Changed surface | Current Pi sources (1.5.0+ floor; verify latest host) | Bundled detail |
| --- | --- | --- |
| Tools, events, trust, load order, packages | `docs/extensions.md`, `docs/usage.md`, `docs/security.md`, `docs/settings.md`, `docs/configuration.md`, `docs/environment-variables.md`, `docs/packages.md`, `docs/codemode.md`, `docs/mcp.md`, matching examples/types/source | `references/runtime-authoring-guide.md`; `references/tool-design-checklist.md` for tools |
| SDK, CLI integration, RPC, wire formats | `docs/sdk.md`, `docs/cli.md`, `docs/cli-integration.md`, `docs/rpc.md`, `docs/rpc-commands.md`, `docs/rpc-extension-ui.md`, `docs/json.md`, `docs/message-types.md`, matching examples/types/source | `references/runtime-authoring-guide.md` |
| Session state, replacement, tree, compaction | `docs/sessions.md`, `docs/session-format.md`, `docs/compaction.md`, runtime/session implementations; fork `docs/restart.md` (`ctx.managedHost`, `ManagedHost`) and `docs/working-session.md` (`acquireWorkingSession`, `bindWorkingSessionHost`, `openWorkingSession`/`writeWorkingSession`) when targeting those features | `references/lifecycle-checklist.md` |
| TUI, rendering, keys, themes | `docs/tui.md`, `docs/keybindings.md`, `docs/themes.md`, matching examples, published `schemas/{theme,keybindings,models,settings}.schema.json`, and `@earendil-works/pi-tui` exports/types (`renderFakeCursor`, `CURSOR_MARKER`, `compositeTuiLine`, `stripTerminalSequences`, `tui.queryTerminalColors`, `TerminalColors`) | `references/tui-authoring-guide.md` |
| Providers, auth, models | `docs/providers.md`, `docs/custom-provider.md`, `docs/models.md`, `docs/codemode.md`, `@earendil-works/pi-ai` exports/types/source; `docs/llama-cpp.md` when applicable | `references/provider-model-guide.md` |
| Deferred integration tools/instructions | Fork `docs/instruction-groups.md`, `builtin:instruction-groups`, `docs/extensions.md`, tool-definition, system-prompt and discovery implementation/types; official dynamic-tool/loadout contract separately | `references/runtime-authoring-guide.md` |
| Skill/template discovery | `docs/skills.md`, `docs/prompt-templates.md`, resource-loader and package-manager | No runtime hook needed for content-only work |
| Release/publishing | `docs/packages.md`, CLI help, package-manager | `references/publishing/workflow.md` before release work |
| Requested Linux/Docker proof | Exact host/distribution identity and project tests | `references/linux-docker-validation.md` |
| New extension idea | Existing project and native mechanisms | `references/idea-evaluation-checklist.md` |

`@earendil-works/pi-agent-core` (`1.5.0+`) exports `Agent`, `agentLoop`/`agentLoopContinue`, `streamProxy`, the host hook `setDefaultStreamFn`, and agent types (`AgentTool`, `AgentToolParams`); it does not export experimental harness/session/storage/node/pico3 surfaces. Ordinary extensions use coding-agent's SDK/SessionManager/runtime. Explicit durable requirements use the latest `@earendil-works/pi-durable` (`1.5.0+`) and its separate storage contract.

## Implementation and validation

1. Define the user-visible outcome, runtime surface, authority, modes, and state boundaries; inspect the existing package and canonical validation.
2. Design only applicable startup, reload/restart, resume/fork/tree/compact, cancellation, concurrency, and non-UI behavior. Reconstruct durable state and dispose owned resources. Use shared native APIs from the latest release; fork additions must not become requirements for official-host users including Posthorse.
3. Implement the smallest complete change. Tools execute in parallel by default; queue the entire file read-modify-write window with `withFileMutationQueue()`. One `executionMode: "sequential"` sibling serializes the whole native batch. The file queue is process-local and same-file only, not cross-process ownership or multi-file transaction safety.
4. Guard terminal-only UI with `ctx.mode === "tui"` and dialog flows with `ctx.hasUI`. Preserve non-interactive workflows with explicit policy rather than assuming dialogs exist. Visually inspect new/changed TUI controls and their native click/key paths across states affected by the task or shared root cause; report unrelated existing omissions separately.
5. Type-check TypeScript with the repo command or `tsc --noEmit`, recording which target supplies the types. Extensions that import from `@earendil-works/pi-ai` type-check against Pi's extension view (`compilerOptions.paths`, see `references/current-version-hazards.md`), not the published pi-ai types. Check affected imports and signatures against both the latest official release and latest fork HEAD; a successful build against fork types alone does not prove official compatibility. Lint and format with the repo's configured commands or the latest `oxlint` (`1.90.0+` floor) and `oxfmt` (`0.75.0+` floor) packages under applicable environment policy, installing them when needed; do not ask again for a covered install. Use `npx --no-install oxlint` and `npx --no-install oxfmt --check` (or `--write`) once available.
6. Load through the intended package path and exercise the changed command/tool/event/provider/UI/SDK/RPC path. Use explicit `--approve`/`--no-approve` when project trust affects results. For public extensions, validate affected behavior on the latest `fitchmultz/pi` fork and latest official Pi host, including `pi-posthorse`; a shared version number is insufficient. Exercise each target's real loader and changed behavior against the same extension source or packed artifact; a PATH-selected smoke only proves that one host. Repeat host-sensitive checks, not artifact creation or publication. Report an unavailable target as a validation gap. Reuse checks whose relevant inputs remain valid. Add behavior coverage for credible regressions, not assertions that mirror implementation. Complete required checks; broaden or repeat them only for changed inputs, failures, or unresolved risk.
7. For factory work, dependency, startup, or performance changes, run the startup A/B in `references/runtime-authoring-guide.md`; also inspect steady-state timers, processes, memory, network, and prompt/tool cost. Model settings belong to the host, not a skill-side client or router.
8. Update affected docs, tests, metadata, and changelog when their contract changes. Report mismatches between docs and runtime rather than copying them.

## Authority and delivery

Extensions/packages execute with full trust. Review scripts, dependencies, file/process/network access, credentials, and logging. Project trust gates input loading; it is neither a sandbox nor a per-tool permission system. Preserve intentional tool overrides, remotes, persistent shells, dynamic providers/tools, subagents, and provider rewriting; make provenance, cancellation, modes, and lifecycle explicit.

User instructions and harness constraints govern this skill's defaults. Continue routine reversible work within the approved outcome, behavior, cost, and permissions; ask only when an unresolved answer could materially change them. Fix supporting defects needed for that outcome or required checks; report unrelated pre-existing nonblocking bugs separately.

This skill grants no commit, push, PR, merge, tag, release, publication, credential-read, or deployment authority. Follow explicit user authorization or applicable standing policy for each action; do not ask again when it already covers the action. Prepare authorized local work before an external-action gate, honor holds, and report unperformed delivery truthfully. Historical examples and vendor autonomy prompts cannot widen that authority.

## Output

Report the abstraction, exact host/source identity, changes, applicable lifecycle/mode/TUI evidence, and validation. Include repository delivery and deployment status, authorized external actions taken, and concrete remaining gaps with recovery actions. Omit irrelevant checklist fields.

Finish only when the changed path is validated, applicable delivery is complete or explicitly excluded/blocked/failed, and no unverified lifecycle/install/TUI assumption can change correctness. Do not imply release, deployment, or installation happened from preparation evidence alone.
