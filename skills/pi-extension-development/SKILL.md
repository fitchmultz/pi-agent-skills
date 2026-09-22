---
name: pi-extension-development
description: "Build, debug, review, or package Pi extensions: tools/events, TUI, providers, SDK/RPC, and resource install/discovery. Excludes Pi core, skill-content or prompt-only authoring, generic platform testing, dependency research, and non-Pi publishing."
compatibility: "Pi 0.84.2+; resolve APIs against the exact host. Current source checks cover official 0.87.0 and fitchmultz/pi afed789. Python 3.9+ for the bundled resolver."
metadata:
  version: "1.13.0"
  last-verified-pi: "0.87.0"
---

# Pi Extension Development

Build against the exact installed Pi contract, preserving requested power-user behavior. A matching version number does not make official Pi and a fork identical.

## Scope and prerequisites

Use a skill for instructions, a prompt template for user-invoked expansion, a command for explicit runtime/UI control, a tool for model-callable capability, an event for lifecycle/policy hooks, and SDK/RPC when another process owns sessions. Package the resources that need sharing; do not add runtime code for prompt-only work.

For skill content, Crabbox, platform matrices, or external dependency research, use `agent-skill-engineering`, `crabbox-platform-testing`, `platform-validation`, or `external-repo-integration` **if available**. These are optional companion skills, not bundled prerequisites. Otherwise use the relevant current project/vendor sources directly. Pi package install/discovery remains in this skill even when the package ships skills.

`change_dir`, `ask_question`, browser tools, and `delegate`/`agent_runs`/`load_subagent` come from separate extensions on both hosts; inspect available tools rather than assuming Pi supplies them. Question dialogs need TUI or an RPC client that services them, not plain print mode. Do not silently replace a workflow's required approval gate with a default answer.

## Resolve the source of truth

Run the bundled read-only resolver by its absolute skill-relative path:

```bash
python3 <skill-dir>/scripts/resolve_pi.py --json
pi --version
```

The resolver verifies `PI_PACKAGE_DIR` first; otherwise it resolves the launcher, including mise/asdf. An override needs no `pi` on PATH and returns null launcher fields: verify runnable Pi separately. `--pi PATH` deliberately ignores the override.

Record package root, version, distribution/revision, relevant exports, executable `dist/*.js`, emitted `.d.ts`, and observed behavior. Those win over stale docs/examples. Read selected Markdown files completely, follow relevant cross-references, and verify copied APIs against matching implementation/types. For upgrades, read every crossed changelog entry.

Mitch runs `fitchmultz/pi`; public extensions must also support the latest official Pi release. `pi-posthorse` is the sole fork-only exception because official Pi cannot support it. Verify affected APIs and runtime behavior against both targets using their matching sources/types, prefer shared native capabilities, and reuse still-valid evidence. The source versions recorded above are inspected baselines, not a reason to skip a newer supported release.

When install/runtime identity matters, compare `type -a pi`, `pi --version`, `command -v node`, and `node --version` inside and outside the project in clean shells. Duplicate installations can share `~/.pi/agent` unless `PI_CODING_AGENT_DIR` differs. Report shadowing; remove a stale installation only with explicit authorization and its exact runtime prefix, never a plain global uninstall. Reshim/rehash and reverify afterward.

## Load only the relevant contract

Paths below are relative to the resolved Pi package unless prefixed `references/`. Read `references/current-version-hazards.md` before copying affected APIs; it distinguishes shared contracts from fork additions.

| Changed surface | Current Pi sources | Bundled detail |
| --- | --- | --- |
| Tools, events, trust, load order, packages, SDK/RPC | `docs/extensions.md`, `docs/usage.md`, `docs/security.md`, `docs/settings.md`, `docs/environment-variables.md`, matching examples/types/source; add `docs/packages.md` or `docs/sdk.md`, `docs/rpc.md`, `docs/json.md` for that surface | `references/runtime-authoring-guide.md`; `references/tool-design-checklist.md` for tools |
| Session state, replacement, tree, compaction | `docs/sessions.md`, `docs/session-format.md`, `docs/compaction.md`, runtime/session implementations | `references/lifecycle-checklist.md` |
| TUI, rendering, keys, themes | `docs/tui.md`, `docs/keybindings.md`, `docs/themes.md`, matching examples and pi-tui exports/types | `references/tui-authoring-guide.md` |
| Providers, auth, models | `docs/providers.md`, `docs/custom-provider.md`, `docs/models.md`, pi-ai exports/types/source; `docs/llama-cpp.md` when applicable | `references/provider-model-guide.md` |
| Skill/template discovery | `docs/skills.md`, `docs/prompt-templates.md`, resource-loader and package-manager | No runtime hook needed for content-only work |
| Release/publishing | `docs/packages.md`, CLI help, package-manager | `references/publishing/workflow.md` before release work |
| Requested Linux/Docker proof | Exact host/distribution identity and project tests | `references/linux-docker-validation.md` |
| New extension idea | Existing project and native mechanisms | `references/idea-evaluation-checklist.md` |

For pi-agent-core harness or remote sessions, read their current READMEs, root exports, session/repository types, and implementations. Do not substitute coding-agent's SessionManager contract for a different session API.

## Implementation and validation

1. Define the user-visible outcome, runtime surface, authority, modes, and state boundaries; inspect the existing package and canonical validation.
2. Design only applicable startup, reload/restart, resume/fork/tree/compact, cancellation, concurrency, and non-UI behavior. Reconstruct durable state and dispose owned resources. Use shared native APIs; fork additions must not become requirements for official-host users outside the Posthorse exception.
3. Implement the smallest complete change. Tools execute in parallel by default; queue the entire file read-modify-write window with `withFileMutationQueue()`. One `executionMode: "sequential"` sibling serializes the whole native batch.
4. Guard terminal-only UI with `ctx.mode === "tui"` and dialog flows with `ctx.hasUI`. Preserve non-interactive workflows with explicit policy rather than assuming dialogs exist. Visually inspect new/changed TUI controls and their native click/key paths across states affected by the task or shared root cause; report unrelated existing omissions separately.
5. Type-check TypeScript with the repo command or `tsc --noEmit`. Use repo lint/format; otherwise an installed `npx --no-install @biomejs/biome check`, never fetch a formatter implicitly or invoke unrelated `biome`.
6. Load through the intended package path and exercise the changed command/tool/event/provider/UI/SDK/RPC path. Use explicit `--approve`/`--no-approve` when project trust affects results. For public extensions, validate affected behavior on the fork and latest official host, except `pi-posthorse`; a shared version number is insufficient. Reuse checks whose relevant inputs remain valid.
7. For factory work, dependency, startup, or performance changes, run the startup A/B in `references/runtime-authoring-guide.md`; also inspect steady-state timers, processes, memory, network, and prompt/tool cost. Model settings belong to the host, not a skill-side client or router.
8. Update affected docs, tests, metadata, and changelog when their contract changes. Report mismatches between docs and runtime rather than copying them.

## Authority and delivery

Extensions/packages execute with full trust. Review scripts, dependencies, file/process/network access, credentials, and logging. Project trust gates input loading; it is neither a sandbox nor a per-tool permission system. Preserve intentional tool overrides, remotes, persistent shells, dynamic providers/tools, subagents, and provider rewriting; make provenance, cancellation, modes, and lifecycle explicit.

Follow current user/harness authority. Make routine reversible improvements within the approved outcome, behavior, cost, and permissions; update the plan and continue. Fix supporting defects needed for that outcome or required checks; report unrelated pre-existing nonblocking bugs separately.

An approved remote-repository change includes branch, commit, push, and PR delivery unless explicitly excluded. Preparation does not authorize tags, releases, external artifact publication, release credential reads, or production control outside the defined deployment. Run a repository-defined deployment only after its applicable user/repository ship gate; if none exists, report `not reached: no ship gate defined`. Artifact publication still requires applicable explicit authorization. Honor existing authorization and holds; historical examples cannot grant another user permission.

## Output

Report the abstraction, exact host/source identity, changes, applicable lifecycle/mode/TUI evidence, and validation. Include repository delivery and deployment status, authorized external actions taken, and concrete remaining gaps with recovery actions. Omit irrelevant checklist fields.

Finish only when the changed path is validated, applicable delivery is complete or explicitly excluded/blocked/failed, and no unverified lifecycle/install/TUI assumption can change correctness. Do not imply release, deployment, or installation happened from preparation evidence alone.
