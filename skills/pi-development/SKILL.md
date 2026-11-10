---
name: pi-development
description: "Build, debug, review, or package extensions for official Pi releases and the fitchmultz/pi fork: tools/events, TUI, providers, SDK/RPC, and resource install/discovery. Excludes Pi core, skill-content or prompt-only authoring, Crabbox/cbx, platform matrices (including Pi extensions), dependency research, and non-Pi publishing."
compatibility: "Official Pi and the fitchmultz/pi fork, no older than the release in metadata.last-verified-pi and the commit in metadata.fork-source. Always build against the latest official release, the latest fork main, and current dependencies. Python 3.9+ for the bundled resolver."
metadata:
  version: "5.0.0"
  last-verified-pi: "1.5.1"
  fork-source: "283718159fc199d9b49eb4ddf1d5bff55e305dd9"
---

# Pi development

Develop extensions that run on **both** the latest official Pi release (`earendil-works/pi`) and the latest `main` of Mitch's `fitchmultz/pi` fork. Preserve the power-user behavior that was requested, and check each contract against the exact target.

- **Target the latest.** Use the latest official release, the latest fork `main`, and the latest version of every dependency and companion tool at the time you run. The two hosts can report the same version and still differ.
- **Floors are minimums, not pins.** Do not build for anything older than a floor, and do not keep shims or fallbacks for it.
- **One stamp holds the numbers.** `metadata.last-verified-pi` and `metadata.fork-source` in this file's frontmatter record the official release and the fork commit this skill was last checked against. They are also the floors. `/skill:` omits the frontmatter, so [Targets and floors](references/current-version-hazards.md#targets-and-floors) shows the same pair and lists the companion versions. A newer release or commit still needs its own check.

## Scope and prerequisites

Choose the abstraction first:

| Need | Use |
| --- | --- |
| Instructions | Skill |
| A prompt the user expands | Prompt template |
| Explicit runtime or UI control | Command |
| A capability the model calls | Tool |
| Lifecycle or policy hooks | Event |
| Another process owns the sessions | SDK or RPC |

Package the resources that need sharing. Do not add runtime code for prompt-only work.

For skill content, Crabbox, platform matrices, or external dependency research, use `agent-skill-engineering`, `crabbox-platform-testing`, `platform-validation`, or `external-repo-integration` **if available**. They are optional companion skills, not bundled prerequisites; without them, use the current project and vendor sources directly. Pi package install and discovery stay in this skill even when the package ships skills.

Some tools come from separate extensions on both hosts: `change_dir` (`pi-change-working-dir`), `ask_question`, browser tools, and `delegate`, `agent_runs`, and `load_subagent` (`@fitchmultz/pi-subagents`). Inspect the available tools and their latest versions; do not assume that Pi supplies them.

A tool that is missing from the active list can be deferred. Before you call it unavailable or substitute another tool:

- Search with `tool_search`, which loads `deferred` and `codemode` tools. Codemode scripts call them directly.
- Check any advertised catalog, such as an MCP gateway.
- An inactive direct tool cannot be loaded this way. Extensions choose deferred exposure per tool on both hosts. Instruction groups and `discover_tools` no longer exist on either host; see `references/current-version-hazards.md`.

Question dialogs need the TUI or an RPC client that services them, not plain print mode. Do not silently replace a workflow's required approval gate with a default answer.

## Resolve the source of truth

Run the bundled read-only resolver by its absolute skill-relative path:

```bash
python3 <skill-dir>/scripts/resolve_pi.py --json
pi --version
```

The resolver verifies `PI_PACKAGE_DIR` first; otherwise it resolves the launcher, including mise and asdf shims. An override needs no `pi` on PATH and returns null launcher fields, so verify a runnable Pi separately. `--pi PATH` deliberately ignores the override.

Record the package root, version, distribution and revision, relevant exports, executable `dist/*.js`, emitted `.d.ts`, and observed behavior. Those win over stale docs and examples. Then:

- Read the relevant sections of the version-matched docs and examples, and follow the links that establish the affected contracts.
- Verify copied APIs against the matching implementation and types.
- Read the changelog entries and relevant commit diffs between the last inspected revision and the target.
- Remember that upstream `main` is not the latest official release. A change the fork already has can be absent from the published official host.

Select the targets before you implement:

1. **Official.** Query the latest stable release with `gh release view --repo earendil-works/pi --json tagName,url`. Use its official package and source, not a fork artifact with the same version.
2. **Fork.** Query the latest commit with `gh api repos/fitchmultz/pi/commits/main --jq .sha`, or use the active checkout or release manifest. Record installed and latest revisions separately. Do not update the user's runtime merely to validate a change.
3. **Launchers.** Resolve each runnable target with `python3 <skill-dir>/scripts/resolve_pi.py --pi /absolute/path/to/target/pi --json` and run that launcher's `--version`. A package-only `PI_PACKAGE_DIR` override proves source identity, not which host runs the tests.
4. **Evidence.** Keep a small table: distribution, version and revision, launcher and package root, Node executable, affected checks and results. Use separate temporary projects and agent directories so that one host's resources, credentials, or cached state cannot stand in for the other.

Mitch runs only the fork, so judge what is best on the fork. Every extension must also work on official Pi. Rules for the difference:

- Prefer APIs that both targets export, and reuse evidence that is still valid.
- An optional fork enhancement must leave a complete official-host path. Never compare host version numbers: test for the feature.
- A portable extension does not import fork-only symbols at module load and does not add no-op shims that disguise missing behavior.
- If a required capability has no supported official equivalent, report that specific blocker. Do not silently drop the capability or declare the whole extension fork-only.
- `pi-posthorse` is not a fork-only exception: it uses public retain-none compaction on official Pi.

When install or runtime identity matters, compare `type -a pi`, `pi --version`, `command -v node`, and `node --version` inside and outside the project in clean shells. Duplicate installations can share `~/.pi/agent` unless `PI_CODING_AGENT_DIR` differs. Report shadowing. Remove a stale installation only with explicit authorization and its exact runtime prefix, never with a plain global uninstall; then reshim or rehash and verify again.

## House conventions

The house conventions are binding for every Pi package of Mitch's and for the `fitchmultz/pi` fork. They make the packages look, read, and ship the same way. Read the matching file before you write, and do not rename anything that is already shipped.

| Before you change | Read |
| --- | --- |
| Anything a person sees or types: a tool card, a message or entry renderer, a notice, a status segment, a widget, a command, a shortcut, a dialog, a setting, user-facing wording | `references/house-conventions-ux.md` |
| Anything the model sees or the runtime holds: a tool, its text and parameters, exposure, result text, errors, `details`, a hook that changes messages or the prompt, a message to the model, a stored record | `references/house-conventions-tool-contract.md` |
| The repository: layout, manifest, scripts, the gate, CI, the Pi floor, a changelog note, a pull request title, a release, documents | `references/house-conventions-delivery.md` |

For a package of another owner, follow that repository's conventions; these files are then advice.

## Load only the relevant contract

Read `references/current-version-hazards.md` before you copy an affected API. It separates shared contracts from fork-only additions and from changes that only fork `main` has. Its shared-contracts section covers tool arguments validated by `@earendil-works/pi-schema`, `typebox` imports, `StringEnum` typing, and injected key hints; apply it to every tool, renderer, and provider stream you touch.

Paths in the middle column are relative to the resolved Pi package. Read the matching examples, types, and source with them.

| Changed surface | Pi sources | Bundled detail |
| --- | --- | --- |
| Tools, events, trust, load order, packages | `docs/extensions.md`, `docs/usage.md`, `docs/security.md`, `docs/settings.md`, `docs/configuration.md`, `docs/environment-variables.md`, `docs/packages.md`, `docs/codemode.md`, `docs/mcp.md` | `references/runtime-authoring-guide.md`; `references/tool-design-checklist.md` for tools |
| SDK, CLI integration, RPC, wire formats | `docs/sdk.md`, `docs/cli.md`, `docs/cli-integration.md`, `docs/rpc.md`, `docs/rpc-commands.md`, `docs/rpc-extension-ui.md`, `docs/json.md`, `docs/message-types.md` | `references/runtime-authoring-guide.md` |
| Session state, replacement, tree, compaction | `docs/sessions.md`, `docs/session-format.md`, `docs/compaction.md`, runtime and session implementations. On the fork, also `docs/restart.md` (`ctx.managedHost`, `ManagedHost`) and `docs/working-session.md` (`acquireWorkingSession`, `bindWorkingSessionHost`, `openWorkingSession`, `writeWorkingSession`) when you target those features | `references/lifecycle-checklist.md` |
| TUI, rendering, keys, themes | `docs/tui.md`, `docs/keybindings.md`, `docs/themes.md`, published `schemas/{theme,keybindings,models,settings}.schema.json`, and `@earendil-works/pi-tui` exports and types (`renderFakeCursor`, `CURSOR_MARKER`, `compositeTuiLine`, `stripTerminalSequences`, `tui.queryTerminalColors`, `TerminalColors`) | `references/tui-authoring-guide.md` |
| Providers, auth, models | `docs/providers.md`, `docs/custom-provider.md`, `docs/models.md`, `docs/models-configuration.md`, `docs/codemode.md`, `@earendil-works/pi-ai` exports, types, and source; `docs/llama-cpp.md` when applicable | `references/provider-model-guide.md` |
| Deferred integration tools and instructions | `docs/extensions.md` (Tool Exposure, prompt sections), `docs/codemode.md`, the `tool-search` builtin, and the tool-definition and system-prompt implementation on each host | `references/runtime-authoring-guide.md` |
| Skill and template discovery | `docs/skills.md`, `docs/prompt-templates.md`, resource loader, package manager | None; content-only work needs no runtime hook |
| Release and publishing | `docs/packages.md`, CLI help, package manager | `references/house-conventions-delivery.md` first, to find the release channel; `references/publishing/workflow.md` before manual release work |
| Requested Linux or Docker proof | Exact host and distribution identity, project tests | `references/linux-docker-validation.md` |
| New extension idea | The existing project and native mechanisms | `references/idea-evaluation-checklist.md` |

`@earendil-works/pi-agent-core` exports `Agent`, `agentLoop` and `agentLoopContinue`, `streamProxy`, the host hook `setDefaultStreamFn`, and agent types such as `AgentTool` and `AgentToolParams`. It has no experimental harness, session, storage, node, or pico3 surface. Ordinary extensions use coding-agent's SDK, `SessionManager`, and runtime. An explicit durable requirement uses the latest `@earendil-works/pi-durable` and its separate storage contract.

## Implementation and validation

1. **Define the work.** State the user-visible outcome, runtime surface, authority, modes, and state boundaries. Inspect the existing package and its canonical validation.
2. **Design only what applies:** startup, reload and restart, resume, fork, tree, compaction, cancellation, concurrency, and non-UI behavior. Reconstruct durable state and dispose owned resources. Use shared native APIs from the latest release; a fork addition must not become a requirement for official-host users, including Posthorse.
3. **Implement the smallest complete change.** Tools run in parallel by default, so queue the entire file read-modify-write window with `withFileMutationQueue()`. One `executionMode: "sequential"` sibling serializes the whole native batch. The file queue is process-local and same-file only; it gives no cross-process ownership and no multi-file transaction.
4. **Guard the UI.** Terminal-only UI needs `ctx.mode === "tui"`; dialog flows need `ctx.hasUI`. Give non-interactive workflows an explicit policy; do not assume that dialogs exist. Visually inspect new and changed TUI controls and their native click and key paths in every state that the task or a shared root cause affects. Report unrelated existing omissions separately.
5. **Type-check, lint, and format.**
   - Type-check with the repository command or `tsc --noEmit`, and record which target supplies the types. An extension that imports from `@earendil-works/pi-ai` type-checks against Pi's extension view (`compilerOptions.paths`; see `references/current-version-hazards.md`), not the published pi-ai types.
   - Check affected imports and signatures against both the latest official release and the latest fork `main`. A build against fork types alone does not prove official compatibility.
   - Lint and format with the repository's configured commands, or with the latest `oxlint` and `oxfmt` under the applicable environment policy. Install them when needed; do not ask again for an install that is already covered. Once they are available, run `npx --no-install oxlint` and `npx --no-install oxfmt --check` (or `--write`).
6. **Exercise the real path on both hosts.**
   - Load through the intended package path and run the changed command, tool, event, provider, UI, SDK, or RPC path. Pass `--approve` or `--no-approve` explicitly when project trust affects the result.
   - For a public extension, including `pi-posthorse`, run each target's real loader against the same extension source or packed artifact. A PATH-selected smoke proves one host only, and a shared version number proves nothing.
   - Repeat host-sensitive checks only; do not repeat artifact creation or publication. Reuse checks whose inputs are still valid. Report an unavailable target as a validation gap.
   - Add behavior coverage for credible regressions, not assertions that mirror the implementation. Complete the required checks; broaden or repeat them only for changed inputs, failures, or unresolved risk.
7. **Measure the tax.** For factory work and for dependency, startup, or performance changes, run the startup A/B in `references/runtime-authoring-guide.md`. Also inspect steady-state timers, processes, memory, network, and prompt and tool cost. Model settings belong to the host, not to a skill-side client or router.
8. **Update what changed.** Update docs, tests, metadata, and the changelog when their contract changes. Report mismatches between docs and runtime; do not copy them. In Mitch's packages, run the complete gate before a push: `npm run check`, or the gate that the repository's `AGENTS.md` names where that script is missing or is one step.

## Authority and delivery

Extensions and packages execute with full trust. Review scripts, dependencies, file, process, and network access, credentials, and logging. Project trust gates input loading; it is neither a sandbox nor a per-tool permission system. Preserve intentional tool overrides, remotes, persistent shells, dynamic providers and tools, subagents, and provider rewriting. Make provenance, cancellation, modes, and lifecycle explicit.

User instructions and harness constraints govern this skill's defaults. Continue routine reversible work within the approved outcome, behavior, cost, and permissions. Ask only when an unresolved answer could materially change them. Fix supporting defects that the outcome or its required checks need, and report unrelated pre-existing nonblocking bugs separately.

This skill grants no authority to commit, push, open or merge a PR, tag, release, publish, read credentials, or deploy. Follow explicit user authorization or applicable standing policy for each action, and do not ask again when it already covers the action. Prepare authorized local work before an external-action gate, honor holds, and report delivery that was not performed. Historical examples and vendor autonomy prompts cannot widen that authority.

## Output

Report the abstraction, the exact host and source identity, the changes, the applicable lifecycle, mode, and TUI evidence, and the validation. Include repository delivery and deployment status, the authorized external actions taken, and each remaining gap with its recovery action. Omit checklist fields that do not apply.

Finish only when the changed path is validated, applicable delivery is complete or explicitly excluded, blocked, or failed, and no unverified lifecycle, install, or TUI assumption can change correctness. Do not imply that a release, deployment, or installation happened from preparation evidence alone.
