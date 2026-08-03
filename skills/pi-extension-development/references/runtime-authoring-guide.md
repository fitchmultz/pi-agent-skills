# Runtime Authoring Guide

Use for detailed pi extension design after reading `SKILL.md` and resolving the active installed implementation and emitted types. Treat docs/examples as leads, not contracts.

## Evidence to gather

Before changing runtime code, record:

- installed pi version, exact package root, relevant implementation and emitted types, and safe CLI/runtime probes
- crossed changelog entries plus complete relevant docs/examples from that same active package root
- existing extension/package files inspected
- chosen abstraction and rejected alternatives
- validation command or manual flow that proves the feature works

For core runtime work, start with `dist/core/extensions/types.d.ts`, `loader.js`, `runner.js`, `resource-loader.d.ts/js`, and `agent-session-runtime.d.ts`; add the matching tool, session, package, RPC, provider-composer, model-runtime, usage-totals, or settings implementation for the changed surface.

## Extension power model

Pi keeps the core small and expects workflow-specific behavior to live in extensions, skills, prompt templates, and packages. Advanced extensions are first-class, including:

- built-in tool overrides and custom renderers
- remote/sandboxed tool backends
- persistent or interactive shells
- subagents and autonomous follow-up messages
- dynamic tools/providers/tool activation
- input/context/system-prompt/provider-payload rewriting
- custom compaction/tree/session flows
- overlays, games, custom editors, widgets, footers, and message renderers

Do not water down a requested power-user workflow merely because it is capable. Make scope, provenance, lifecycle, cancellation, and non-interactive behavior explicit.

## Abstraction rules

- Skill: instructions only; no runtime hook.
- Prompt template: slash prompt expansion only.
- Command: explicit user action, session/runtime/UI control, reload/session replacement.
- Tool: model-callable structured capability.
- Event hook: observe, block, or mutate lifecycle/tool/context/provider behavior.
- UI/TUI: richer user interaction, rendering, overlays, editor/footer/status/widgets.
- SDK/runtime: another app/process owns pi sessions.
- Package: share/install resources across machines/projects.

Prefer commands for explicit user control paths and tools for model-autonomous capability.

Prompt templates remain the right abstraction for slash prompt expansion. Current templates support positional defaults like `${1:-7}`, all-argument defaults `${@:-default}` / `${ARGUMENTS:-default}`, and `${@:N}` / `${@:N:L}` slicing; do not create extension code just to support optional prompt arguments.

## Project trust model

Project trust is an input-loading gate, not a sandbox and not a per-tool permission system. It controls whether pi loads trust-gated project-local settings/resources/packages/extensions and project `.agents/skills`. Current pi does not trust-gate `AGENTS.md` or `CLAUDE.md` context files; disable them with `--no-context-files` / `noContextFiles` if needed. Do not weaken powerful extension patterns by default just because project trust exists; instead make the extension's authority, provenance, mode behavior, and opt-in scope explicit.

Trust-requiring project inputs are:

- `settings.json`, `extensions`, `skills`, `prompts`, `themes`, `SYSTEM.md`, or `APPEND_SYSTEM.md` under the project config dir (`CONFIG_DIR_NAME`, default `.pi`)
- `.agents/skills` in the current working directory or an ancestor

A bare `.pi` directory is not enough. Trusting a project can load project config resources, missing project packages, project-local extensions, project package-managed extensions, and project `.agents/skills`. Declining trust skips those protected resources. Saved decisions live in `~/.pi/agent/trust.json`; the closest saved current-directory or parent-directory decision applies.

Non-interactive modes (`-p`, `--mode json`, `--mode rpc`) do not prompt. Without a saved decision they use global `defaultProjectTrust`: `"ask"` (default) and `"never"` ignore trust-gated resources, while `"always"` trusts them. `--approve/-a` and `--no-approve/-na` override project trust for one run. `pi config` and package commands use the same trust flow. `/trust` saves a future decision, including an immediate-parent trust option, but does not reload the current session.

The `project_trust` event runs before trust-gated project resources load. User/global extensions, CLI `-e` extensions, and SDK `extensionFactories` participate; trust-gated project extensions do not. A handler returns `{ trusted: "yes" | "no" | "undecided", remember?: boolean }`; the first yes/no decision wins. If all handlers return `undecided`, saved decisions apply, then `defaultProjectTrust` controls whether pi asks, trusts, or declines by default. The trust context is limited to `cwd`, `mode`, `hasUI`, and select/confirm/input/notify UI helpers. Guard prompts with `ctx.hasUI`; in non-UI modes use an explicit policy, preferably risk-on when that matches the developer workflow.

Later extension contexts expose `ctx.isProjectTrusted()`, which reflects the effective trust decision including temporary CLI overrides and defaultProjectTrust, not just saved `trust.json` state. Use it when project-local config or assets should respect pi trust. If an installed/global/CLI/inline extension intentionally treats its own project config as developer-trusted by default, document that risk-on policy and honor explicit opt-outs instead of silently weakening the capability.

## Load and registration lifecycle

Factory-safe operations are:

- `pi.on(...)`
- `pi.registerTool(...)`
- `pi.registerCommand(...)`
- `pi.registerShortcut(...)`
- `pi.registerFlag(...)`
- `pi.registerMessageRenderer(...)` and `pi.registerEntryRenderer(...)`
- `pi.registerProvider(...)` queued behavior, including legacy `(id, config)` and Pi 0.82 native complete-provider forms; factory-time `unregisterProvider(name)` only cancels pending same-name registrations and cannot remove an existing or built-in provider before core binding
- `pi.getFlag(...)` for registered defaults only; parsed CLI values are applied after resource loading
- `pi.exec(...)`; await it from an async factory only when the result must exist before `session_start`, and count it as startup work

Read `pi.getFlag()` from `session_start`, commands, tools, or events when runtime behavior depends on CLI-provided values.

Session-bound action methods are not initialized during factory load and should run from `session_start`, commands, tools, or events:

- `sendMessage`, `sendUserMessage`, `appendEntry`
- `setSessionName`, `setLabel`
- `getActiveTools`, `getAllTools`, `setActiveTools`, `getCommands`
- model/thinking setters/getters

`registerProvider()` is special: during initial load it queues registrations until the runner binds core services; after binding, register/unregister takes effect immediately. Use an async factory for startup work that must complete before `session_start`, resource discovery, or `pi --list-models`.

## Discovery, load order, and collisions

- Before project trust resolves, user/global extensions, CLI `-e` extensions, and SDK inline factories load; trust-gated project resources are omitted. Context files load later and independently of the trust decision.
- After trust resolves, base resource precedence is project settings entries, project auto-discovery, user settings entries, user auto-discovery, then package resources. Explicit CLI `-e` extensions are prepended and therefore win first-registration collisions; SDK inline factories are appended last.
- Directory discovery is one level deep: direct `.ts/.js`, subdir `index.ts/js`, or package `pi.extensions` entries.
- Cross-extension tool and flag collisions are first-wins. Repeated legacy same-name provider configs merge defined top-level fields in load order, including an empty `models` array, but each fragment validates independently. A native complete-provider registration discards same-id legacy state and replaces prior native ownership; switching back starts fresh from the incoming legacy fragment. Do not mix forms or ownership across extensions unless the order is intentional and tested.
- Same-extension re-registration with the same tool name replaces that extension’s prior definition.
- Commands with duplicate names are all preserved and exposed with numeric suffixes like `/review:1` and `/review:2`.
- Message and entry renderers are first-wins across extensions by `customType`; same-extension re-registration replaces its own renderer.
- Shortcut collisions with reserved app keys are skipped; non-reserved built-in conflicts warn and the extension shortcut can win. Cross-extension shortcut collisions warn and last-wins.

Use `sourceInfo` on tools/commands/resources for provenance rather than guessing from names or paths.

## Runtime mutation is allowed

Do not overuse `/reload` as a generic hammer.

Supported dynamic behavior:

- `pi.registerTool()` after startup refreshes tools immediately.
- `pi.setActiveTools()` can switch active built-in/extension/custom tools at runtime. A tool that makes a purely additive active-tool change records the additions on its result so supported Anthropic and OpenAI Responses models, plus Kimi OpenAI-compatible models configured for native deferred loading, can defer definitions at that load point. Register all candidates first, keep the loader active, and omit prompt snippets/guidelines from lazily loaded tools when prefix stability matters because their system-prompt changes can still invalidate the prefix. Removals and replacements use the normal fallback.
- `registerProvider()` and `unregisterProvider()` take effect immediately after initial binding. Before binding, unregister only removes pending same-name registrations. After binding, it removes a previously dynamic registration and restores any overridden built-in models; it cannot remove an unregistered built-in provider. Re-registration follows the form-switch/legacy-merge rules above, but `/reload` does not automatically prune a conditional provider whose registration disappeared or changed ids.
- `pi.getCommands()` and `pi.getAllTools()` expose current slash/tool surfaces with provenance.
- Commands/events can send steering/follow-up messages or inject custom messages when that is the workflow.

Use `/reload` or `ctx.reload()` for source/resource reload, not for ordinary dynamic state.

## Lifecycle and state

Design for boundaries that apply:

- project trust before trust-gated project startup inputs
- startup and `/reload`
- `/new`, `/resume`, `/fork`, `/clone`, `/tree`
- compaction and branch summaries
- model/thinking changes
- interactive, RPC, JSON, and print modes
- SDK runtime replacement and `AgentSessionRuntime.importFromJsonl()`
- cwd changes whose project trust is unresolved

Best practices:

- Keep module state reconstructable.
- Store branch-aware state in tool result `details` when the state follows tool actions. Keep nested-model `Usage` in the result's top-level `usage`, not inside `details`, so session totals include it.
- Store non-model session state with `pi.appendEntry(customType, data)`. Pair it with `pi.registerEntryRenderer()` when persisted state needs interactive transcript UI without entering model context.
- Rehydrate from `ctx.sessionManager.getBranch()` in `session_start`; handle `session_tree` when branch navigation changes meaning and `session_info_changed` when the displayed session name drives UI/state.
- Use `agent_end` for per-low-level-run inspection. Use `agent_settled` or `AgentSession.waitForIdle()` for final notifications, host idle transitions, and cleanup that must wait until retries, overflow compaction/retry, summarization retries, and queued continuations finish. RPC clients needing final completion should also wait for `agent_settled`, not `agent_end`. Handle `summarization_retry_*` when UI or hosts surface compaction/branch-summary retry progress.
- Clean up timers, watchers, handles, subprocesses, raw terminal listeners, and UI loops in `session_shutdown` and component `dispose()`.
- After `ctx.reload()`, treat the command handler as terminal: `await ctx.reload(); return;`.
- Pi 0.80.9 rejects persisted non-root `ctx.fork()` paths when the session file has not been written yet, which is the usual path before the first assistant response. Treat that clear unsaved-session error as expected validation and do not run replacement cleanup or success behavior after it. A root-level `position: "before"` fork can still create a parented session without opening the old file.
- `session_before_compact` and `session_compact` expose `reason` and `willRetry`; branch custom summaries, UI, and retry cleanup on those fields instead of guessing from prompt text. Return provider `usage` from custom compaction and branch-summary work so it is persisted and billed in full-session stats.
- Current pi may reuse imported modules for same-directory session switches while preserving fresh extension instances and lifecycle events; top-level module state can outlive a session switch, so reset per-session state in the factory/session hooks.
- In `withSession`, use only the fresh replacement context. Do not use captured old `ctx`, session-bound `pi` methods, or `SessionManager` objects.

## SDK runtime replacement

When embedding pi with `AgentSessionRuntime`:

- `runtime.session` changes after `newSession`, `switchSession`, `fork`, clone, or `importFromJsonl()`.
- Subscriptions are session-bound; unsubscribe and resubscribe after replacement.
- Use `runtime.setRebindSession(async (session) => ...)` as the single rebind path for extensions and host event plumbing after successful replacement; do not also call the binder manually. Cancelled replacements do not rebind.
- Use `runtime.setBeforeSessionInvalidate(() => ...)` for synchronous host UI teardown after `session_shutdown` handlers finish but before old extension contexts become stale.
- Replacement tears down and disposes the old session before creating the new runtime. If creation fails, the old session is not recoverable; the host must rebuild or exit rather than continue with stale state.
- If extensions are enabled, ensure replacement sessions call the same extension-binding path as the initial session.
- If the host uses `DefaultResourceLoader` directly, pass `reload({ resolveProjectTrust })` when trust-gated project inputs should be considered.
- `SettingsManager.create(cwd, agentDir, { projectTrusted })` requires `cwd` and controls whether project settings participate; global `defaultProjectTrust` controls unresolved fallback behavior.
- Use `SessionManager.list(cwd)` for one project's default session directory and `SessionManager.listAll()` for the normal all-project tree; a string passed to `listAll()` is a custom session directory, not a cwd.
- Current `loadProjectContextFiles({ cwd, agentDir })` loads `AGENTS.md`/`CLAUDE.md` independently of project trust. Use `noContextFiles` or a custom loader override to suppress context files.
- For SDK hosts/tests, `DefaultResourceLoader` supports `extensionFactories`, `extensionsOverride`, `skillsOverride`, `promptsOverride`, `themesOverride`, `agentsFilesOverride`, `systemPromptOverride`, and `appendSystemPromptOverride`. Prefer these over temp files/custom loaders for deliberate replacement, and document that overrides bypass normal discovery semantics. When inline factory provenance matters, pass `{ name, factory } satisfies InlineExtension`; bare factories remain valid.
- `PromptOptions.preflightResult(false)` means prompt preflight rejected before acceptance; failures after acceptance surface through normal events/messages.
- `SettingsManager` setters enqueue async writes; call `flush()` for a durability boundary and `drainErrors()` to report I/O errors.
- `ModelRuntime.create()` restores cached catalogs but performs network refresh only with `allowModelNetwork: true`. `refresh()` reloads `models.json` then rebuilds providers/catalogs. Pi interactive/RPC startup triggers a separate background refresh; `/model` uses `refresh()` so edited `models.json` is picked up; print mode, `--list-models`, and ordinary SDK hosts stay cache-only unless they call `refresh()`.

## Events and mutation

- Pi 0.82.0 exports `AgentSessionEvent`, `AgentSessionEventListener`, and concrete agent/message/tool-execution lifecycle event types from the package root. Import them instead of copying event unions from prose docs.
- `input` runs after extension commands are checked and before skill/template expansion. Transforms chain; `handled` short-circuits.
- `before_agent_start` can inspect `systemPromptOptions` and chain system-prompt changes.
- `context` receives a deep copy of messages for provider-call context shaping.
- `before_provider_headers` mutates assembled outbound headers in place: a string adds/overrides and `null` removes. Return values are ignored, and provider-internal retries reuse the resulting headers without rerunning the hook. Do not log auth headers or remove required auth/transport headers accidentally.
- `before_provider_request` mutates provider payloads after serialization; these changes are not reflected by `ctx.getSystemPrompt()`.
- `after_provider_response` observes response status and headers before stream consumption; use it for response diagnostics rather than stream parsing.
- `tool_call` can block and may mutate `event.input`; no revalidation runs after mutation.
- `tool_result` can patch `content`, `details`, `isError`, or top-level `usage`; handlers chain in load order. Preserve existing usage when patching.
- `message_end` replacements must keep the same role.

Use hidden prompt/input/provider mutation deliberately. It is valid power-user functionality, but make the behavior inspectable and bounded.

## Package and dependency rules

Read `docs/packages.md` before changing package layout or release guidance.

- Prefer conventional top-level `extensions/`, `skills/`, `prompts/`, `themes/` or explicit `pi` manifest paths.
- Runtime third-party dependencies belong in `dependencies`, even if they are heavy sandbox/client SDKs required by the feature.
- Do not rely on devDependencies at runtime.
- Imported pi core packages belong in `peerDependencies` with `"*"`: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`.
- Other pi packages used as bundled resources must be in both `dependencies` and `bundledDependencies`, with manifest paths into `node_modules/...`.
- `npmCommand` may route installs through wrappers/package managers such as `mise`, `asdf`, `bun`, or `pnpm`; do not assume bare `npm`.
- Project package settings and missing project package installs participate only after project trust. Package commands accept `--approve` / `--no-approve` for one-command trust behavior, and global `defaultProjectTrust` controls unresolved fallback behavior.
- `pi config` starts in global scope; `pi config -l` starts in project overrides and Tab switches scopes. `pi config --help` is safe and non-interactive.
- Managed git package checkouts may be reset/cleaned during update. Do not store mutable user data inside them.
- Use `pi install -l --approve` for project-local install checks that should not mutate global settings when the check must read/write project package settings.
- Use `pi update --extension <source> --approve` for one-package update verification that should include project package settings.

## RPC mode gotchas

- RPC uses LF-delimited JSONL. Parse streaming UTF-8 with `StringDecoder` or an equivalent incremental decoder; split only on `\n`, accept an optional trailing `\r`, and process a final unterminated record at EOF. Do not use Node `readline`, which also splits on Unicode separators valid inside JSON strings.
- RPC `get_entries` and `get_tree` expose session entries/tree snapshots; prefer them over scraping session JSONL when a live RPC client needs state.
- RPC `get_commands` returns canonical provenance in `sourceInfo`; do not parse legacy top-level `location` or `path` fields from prose docs.
- RPC `bash` output enters LLM context on the next prompt, not immediately. Raw `RpcCommand` supports `excludeFromContext: true`; bundled `RpcClient.bash(command)` exposes no option, so use the raw protocol or a custom client for private host-side output. Direct RPC bash streams `bash_execution_update` events (`id?`, `delta`) correlated with the request.
- Built-in and factory bash tools set `PI_SESSION_ID`, optional `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, and `PI_REASONING_LEVEL` from the current session/model at command start.
- Bundled `RpcClient.waitForIdle()` subscribes only for a future `agent_settled`; calling it after settlement is not a state query and can wait for another run. Subscribe before prompting or use `promptAndWait()`, which installs collection first.
- Raw `get_available_thinking_levels` returns `{ data: { levels } }`; bundled `RpcClient.getAvailableThinkingLevels()` returns the unwrapped array. Query again after model changes instead of caching a global set.
- In RPC, `ctx.hasUI === true` for dialog/fire-and-forget extension UI, but terminal-only methods such as `custom()`, working row controls, footer/header/editor replacement, themes, and tools-expanded controls degrade or no-op. Guard terminal UI with `ctx.mode === "tui"`.

## Startup tax measurement

Measure startup tax with a wall-clock A/B that loads only the extension under test. `--list-models` triggers extension factory load and provider registration, then exits without a model turn, so it needs no auth. For full interactive startup timing, source inspection confirms `PI_STARTUP_BENCHMARK=1 PI_TIMING=1 pi --offline -ne [-e ./extension.ts]` initializes the TUI, prints timing groups, and exits.

```bash
# Baseline: discovery off, no extension. Search term matches nothing to keep output tiny.
for i in 1 2 3; do /usr/bin/time -p pi --list-models zzznomatch --offline -ne >/dev/null; done
# With the extension isolated (-ne disables discovery, -e adds only this one):
for i in 1 2 3; do /usr/bin/time -p pi --list-models zzznomatch --offline -ne -e ./extension.ts >/dev/null; done
```

- `--offline` removes update/network variance; `-ne` isolates the single `-e` extension from other discovered extensions.
- Take the **min** `real` of several runs per side and report each range; do not call a delta meaningful unless it exceeds the observed run-to-run spread.
- Use a no-op extension as a loader-floor control when the threshold matters. A non-trivial factory delta means startup work should move behind a command/tool/lazy cache, or into an async factory only when the result must be ready before `session_start`/`--list-models`.
- For steady-state tax (not just startup), separately watch long-lived timers/watchers/subprocesses, memory/cache growth, network calls, and always-on prompt/tool bloat.

## Validation menu

Pick validation that proves the changed contract:

- type-check (`tsc --noEmit` or repo script) as a required gate for any TypeScript change; tests for extension code
- `pi -e ./extension.ts` quick runtime load
- auto-discovered location plus `/reload` for hot-reload behavior
- command invocation in TUI for commands/UI
- print/JSON/RPC mode for non-interactive contracts, including current-model thinking-level discovery for RPC hosts
- session flows: `/new`, `/resume`, `/fork`, `/clone`, `/tree`, `/compact` when lifecycle matters; verify top-level usage survives tool, compaction, and branch-summary persistence when nested model calls are in scope
- dynamic tool/provider mutation without `/reload` when that is the feature; test static/cached startup, background refresh, and conditional-registration removal for the provider form in scope
- `pi install -l --approve <source>`, `pi list --approve`, `pi list --no-approve`, resource inspection/config, package flow for packages
- project-trust flow in a temp project with `.pi/` or `.agents/skills` when trust-gated project inputs matter; separately verify `AGENTS.md`/`CLAUDE.md` context loading or `--no-context-files` when context behavior matters
- visual inspection/screenshot for user-facing TUI changes

## Done

Runtime work is done only when the abstraction is correct, the active implementation and emitted types support it, lifecycle and mode behavior are intentional, TUI UX is excellent where applicable, and validation evidence matches the success claim.
