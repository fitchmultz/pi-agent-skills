# Version and Distribution Hazards

## Evidence and support policy

Support is maintained **only** for the latest official Pi release (**`1.4.0`**) and the latest `fitchmultz/pi` fork (**`1.4.0`**), plus the latest versions of referenced companion packages. Do not maintain compatibility branches, shims, or legacy fallbacks for earlier Pi releases or older dependency versions.

| Distribution | Version / exact source | Evidence boundary |
| --- | --- | --- |
| Official Pi (`earendil-works/pi`) | `1.4.0` / [`4a080252f06caf63a525d7873c5d94d3c23887e0`](https://github.com/earendil-works/pi/tree/4a080252f06caf63a525d7873c5d94d3c23887e0) | Published `@earendil-works/*` `1.4.0` npm cohort (`pi-coding-agent`, `pi-agent-core`, `pi-ai`, `pi-tui`, `pi-chord`, `pi-telemetry`, `pi-codemode`, `pi-mcp`, and companion `pi-durable`), public SDK `dist/index.js`, declarations, and schemas |
| `fitchmultz/pi` fork | `1.4.0` / [`9e0674ef667e90a63a5fb64f18fbb476cd1b8a3f`](https://github.com/fitchmultz/pi/tree/9e0674ef667e90a63a5fb64f18fbb476cd1b8a3f) | Immutable installed fork release and `main` HEAD (`1.4.0-fork.9e0674ef667e`), verified against [`FORK.md`](https://github.com/fitchmultz/pi/blob/9e0674ef667e90a63a5fb64f18fbb476cd1b8a3f/FORK.md), SDK exports, and bundled CLI |

Host runtime baselines:
- All eight core `@earendil-works/*` packages and `@earendil-works/pi-durable` are **`1.4.0`**.
- Bundled TypeBox is **`1.3.27`**. Companions may be nested under `pi-coding-agent/node_modules`; resolve from the selected SDK, not the consumer root.
- Node engine floor is **`>=24.21.0`** (qualified on **Node `24.22.2`** and **npm `12.2.1`**).
- Companion extension and tool baselines: `@fitchmultz/pi-subagents` **`0.52.6`**, `pi-change-working-dir` **`0.6.0`**, `@biomejs/biome` **`2.6.4`**.

The `fitchmultz/pi` `1.4.0` fork's [revision-matched `FORK.md`](https://github.com/fitchmultz/pi/blob/9e0674ef667e90a63a5fb64f18fbb476cd1b8a3f/FORK.md) owns the fork-specific inventory:
- Process restart (`pi restart`, `/restart`, `builtin:restart`, `docs/restart.md`)
- Detached background shell commands (`background_command`, `builtin:background-commands`)
- Instruction groups (`discover_tools`, `pi:instruction-groups`, `builtin:instruction-groups`, `docs/instruction-groups.md`)
- Structured JSON selection for `Read` (`json.path`, `json.fields` on `createReadToolDefinition`/`createReadTool`)
- Compact activity view (`compactView: boolean | "hybrid"`)
- Fork binary self-update (`pi update --fork`)
- Android Termux interactive support
- Complete native working-session state (`workingSessionState` on `AgentSession`/`SessionManager`, RPC `get_working_session_state`, `docs/working-session.md`) and managed-host coordinator (`createManagedHostCoordinator`, `bindManagedAgentSession`, `ManagedExtensionCommandExecution`, `ManagedSessionTurnResponse`)
- Isolated credential refresh (`isolatedCredentialRefresh`)
- Fallback credential chains (`withFallbackAuthStorage`, `FallbackAuthLocation`, `FallbackAuthStorageHandle`, `FallbackAuthStorageOptions`)
- Performance diagnostics (`PI_PERF_WARN_MS`)
- Passive extension event tracing (`PI_TRACE_EXTENSION_EVENTS_FILE`)
- Cloudflare AI Gateway Claude model ID canonicalization and retained correctness fixes (including native exact-Astra Ultrafast cost estimates gated by terminal tier confirmation; source/offline checks do not establish live billing)

Resolve installed and intended revisions separately, then consult that revision's `FORK.md` and emitted exports. Keep live resources/settings/runtime untouched during isolated qualification; matching `1.4.0` version strings do not identify matching artifacts.

## Portable session and lifecycle contracts

- Use `DefaultResourceLoader`, `createAgentSession`, `SessionManager`, `ModelRuntime`/`ModelRegistry`, and `AgentSessionRuntime` for ordinary extensions and hosts. `CreateAgentSessionOptions.tools` is a **name array**; definitions belong in `customTools`. A supplied resource loader must be reloaded by its owner. SDK sessions do not automatically load CLI builtins; add their factories and call `session.bindExtensions()` when needed.
- `SessionManager` owns finalized provider context. SDK owners append/navigate through it then `session.refreshContext()`, or create a session with a populated manager. Assigning `session.agent.state.messages` is not a supported context rewrite. Extensions get a read-only manager: use public message/append APIs or boundary drafts, not private casts.
- `message_end` is dispatched **before** the message is appended. Use its authoritative message value for message-local work; don't assume it is already in `getBranch()`. `turn_end` resolves persisted assistant/tool-result IDs, composes drafts across handlers, then commits **after** handlers finish. Preserve earlier proposals with `{ entries: [...event.entries, draft] }`.
- `custom` drafts persist non-model state; `custom_message` adds model content; `context_edit` changes/omits active-branch content without erasing raw history, usage or UI; `compaction` with `firstKeptEntryId: null` retains none of the preceding conversation while carrying current system/tool state. Do not request unconditional continuation: the preview must contain runnable context or queued input.
- `agent_end` finishes one low-level loop, not retries, compaction recovery or queued continuations. `agent_before_settle` is the final actionable boundary; `agent_settled` is notification-only and defers newly scheduled work until handlers finish. Use `AgentSession.waitForIdle()`/command-context idle, never low-level `session.agent.waitForIdle()`, for final local completion. Extension-owned detached jobs still have their own completion contract. Avoid awaiting a run's idle from a handler that run is waiting for.
- `context` receives conversation without system messages; the host restores prompt/tools. `context_with_system` owns the full output: preserve the leading system declaration at index zero and later tool updates in their positions. Request-local transformations do not persist context edits. `before_agent_start.systemPromptOptions` is mutable, `systemPrompt` is readonly; continuations do not rerun that hook and forced prompts can replace system-only decoration.
- After committed `newSession`/`fork`/`switchSession`, old `pi`/`ctx` actions and getters are stale. Capture plain data first and do session-bound follow-up only with `withSession(freshCtx)`. After `await ctx.reload()`, return; reload has no fresh-context callback. Both official `1.4.0` and the `1.4.0` fork clear factory caches and reinitialize resources on reload.
- Runtime replacement aborts/settles outgoing work, awaits `session_shutdown`, tears down host UI and disposes before creating the replacement. Factory failure does not restore the disposed old runtime. Rebind subscriptions through `runtime.setRebindSession`; synchronous host UI teardown uses `setBeforeSessionInvalidate`. Direct `session.dispose()` is synchronous invalidation/abort/listener cleanup, not the awaited shutdown lifecycle of `runtime.dispose()`.
- Committed replacement and interactive `/tree` abort/persist active work; programmatic navigation rejects while active. Later unstarted sequential siblings may remain unmatched after abort: wait for final idle if balanced history is required; never fabricate tool results. Preserve legacy saved-session recovery when removing obsolete runtime paths.

`pi-posthorse` is **portable on official `1.4.0`** through public retain-none compaction and lifecycle boundaries. Do not declare a blanket fork-only exception or require checkpoint APIs for ordinary rollover. Validate prompt/tool retention, queued input, errors, threshold/overflow, resume and legacy journal recovery.

## Tools, concurrency and policy

- Tools run in parallel by default; preflight is ordered, completion events follow finish order and persisted results follow assistant source order. Key state by `toolCallId`. Any `executionMode: "sequential"` sibling serializes the whole batch, not only that resource.
- `withFileMutationQueue(path, fn)` covers the whole same-file read/modify/write window and releases on failure. It is **process-local**, resolves existing realpaths but uses a lexical path for missing files, and is not a multi-file transaction or cross-process lock. Keep batch planning/rollback, symlink safety and external ownership where required.
- `prepareArguments` precedes validation; mutable `tool_call.input` follows it and is not revalidated. Preserve schema/trust invariants yourself. A blocked call's `terminate` suppresses follow-up only when all finalized sibling results terminate. Changing active tools is not a promise of revoking already-preflighted sibling references.
- Tool-context `ctx.executeTool()` uses validation/hooks/permissions, child IDs and `parentToolCallId`. Unknown/blocked/throwing calls resolve `isError: true`, not rejection. Nested-call records are bounded metadata, not durable raw results; usage aggregates onto the parent, so don't count twice. Raw tool execution bypasses this boundary. Late updates after settlement are ignored.
- Native exposure is a policy choice: direct is callable while active; model-only is never nested-callable; codemode/deferred are callable whenever registered even if inactive; hidden is unreachable. `defaultActive: false` is not deferred exposure. Namespace/annotations and `prepareLoadout` do not enforce permissions or instruction-before-effect gates.
- Preserve `isError`, meaningful content and top-level usage. An output schema promises successful `structuredContent`. Content replacement drops old structured content unless supplied consistently; do not leak stale machine-readable secrets after redaction.
- `defaultTools` reload enables newly added defaults without overriding explicit `tools`/`noTools`; do not delete necessary resume restoration without exercising that SDK path. `sendUserMessage` expands commands/skills/templates only with `expandPromptTemplates: true`; context-only `sendMessage({ triggerTurn: false })` is not steering.

## Current fork boundaries (`fitchmultz/pi` `1.4.0`)

The fork's discovery builtin (`builtin:instruction-groups`) emits `pi:instruction-groups` **synchronously during `session_start`** with `{ register(group), isManaged() }`. A group is `{ name, description, tools, instructions(ctx) }`; `discover_tools` accepts optional `enable: string[]`. Register synchronously with extension-owned tool names/instructions. Enabling restores only previously selected tools for a subsequent turn: optional/excluded/hidden tools stay restricted, and same-assistant discovery/action calls are blocked even in sequential execution. Read `docs/instruction-groups.md` for readiness, positional declarations and branch/compaction recovery. Preserve complete official prompt-section/tool exposure and existing instruction/approval gates when the collector is absent or unmanaged. Native BM25 `tool_search`, provider-native search and MCP gateways are different mechanisms, not substitutes for group instructions.

Read JSON selection (`json.path`, `json.fields`) belongs to core `createReadToolDefinition` on the fork, so native cwd wrappers inherit it. `compactView` is a global `boolean | "hybrid"` setting, default off; preserve the user's selection and do not invent renderer properties from its name. Restart (`builtin:restart`) and detached background commands (`builtin:background-commands`, `background_command`) are builtin extensions using public lifecycle APIs. Native working-session state (`workingSessionState`, RPC `get_working_session_state`), managed-host coordination (`createManagedHostCoordinator`, `bindManagedAgentSession`), isolated credential refresh (`isolatedCredentialRefresh`), and fallback auth (`withFallbackAuthStorage`) are fork-only additions in `1.4.0`; do not import them unconditionally in extensions that target official Pi `1.4.0`. `pi update --fork` is runtime delivery, not extension update, and needs explicit cutover authority.

## Published configuration schemas (`1.4.0` official and fork)

Both official Pi `1.4.0` and `fitchmultz/pi` `1.4.0` publish configuration schemas under the `pi-coding-agent` package root (repository prefix `packages/coding-agent/`):

| Document | Schema path |
| --- | --- |
| Themes | `schemas/theme.schema.json` |
| Keybindings | `schemas/keybindings.schema.json` |
| Models | `schemas/models.schema.json` |
| Settings | `schemas/settings.schema.json` |

Editor URLs use `https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/schemas/<name>.schema.json`; theme metadata must not point into `src/modes/interactive/theme/`. Pi does not fetch `$schema` URLs to load configuration. Use the host's shipped schema and native loader for acceptance.

- Themes reject extra top-level fields and unknown `colors`/`export` keys. Put reusable custom colors in `vars`, use documented export backgrounds, and resolve missing/circular variable references through the native loader. Names cannot contain `/`; `system` is reserved. Optional scrollbar/search/`thinkingMax` tokens retain native fallbacks; do not duplicate a token inventory or add needless colors.
- Key values use the native `KeyId` spelling and case, including `pageUp`/`pageDown`, with lowercase `ctrl`, `shift`, `alt`, `super` modifiers, no duplicates, and valid base keys. Examples: `ctrl+shift+x`, `alt++`; not `Ctrl+X`, `option+x`, or `ctrl+ctrl+x`. Extension-owned action names remain allowed; schema validation is not a global action-name allowlist.
- `models.json` definitions and overrides require supplied `contextWindow` and `maxTokens` to be positive numbers. Zero is not “unlimited”; omit optional values or supply verified positive limits.
- Validation enforces positive integer image dimensions/byte/count limits, JPEG quality of 1–100, and positive supplied prompt-cache lifetimes.
- Settings allow extension-owned keys. Do not make Pi's schemas a strict validator for unrelated extension configuration. When adapting a fork settings schema, retain `compactView: boolean | "hybrid"` and existing resource filters.

## SDK, JSON and RPC traps

- Inspect exported interfaces over stale SDK prose: no `continueSession` option; `SettingsManager.create(cwd, agentDir?, options?)` is positional; `SessionManager.list(cwd)` selects a project, `listAll()` all normal projects, and its optional string is a custom session directory. Resources use `sourceInfo`, not obsolete `source`/location fields.
- JSON starts with a `type: "session"` header. Header/entry timestamps are ISO strings, message timestamps milliseconds; compaction uses `firstKeptEntryId`. Wire `message_update` is delta-only, unlike in-process events. Accumulate by content index until authoritative `message_end`; cumulative usage may be zero until completion.
- Parse incremental UTF-8, split only LF, accept trailing CR and flush EOF. Node readline also splits Unicode separators valid inside JSON strings. Do not pass all stdout through as a successful assistant answer; inspect the final assistant's stop reason, process result and cancellation.
- RPC input receipts distinguish **started/queued/handled**. Handled means no new run; queued is not completion. Install listeners before prompt, inspect disposition and clean up listeners on every path. Official `RpcClient.waitForIdle`/`collectEvents` await a **future** settled event; `promptAndWait` installs first but ignores handled disposition and can timeout on a handled command.
- `get_available_thinking_levels` returns `{ data: { levels } }`; the client unwraps it. Re-query after model changes. `get_commands` uses `sourceInfo`. Direct RPC bash honors `user_bash`, emits correlated `bash_execution_update`, and accepts raw `excludeFromContext: true`; the bundled client bash helper doesn't expose that option.
- Native bash injects session/model/reasoning variables unless `exposeSessionEnvironment: false`; user-entered `!`/`!!` do not. Use explicit physical Node and `env -i` with isolated HOME/agentDir for tests, rather than inherited `PI_*` state or mise/asdf shims that fail under a private HOME.

## Models, classifiers, codemode, and providers (`1.4.0`)

- Ordinary `pi-ai` ESM root has types, `StringEnum`, streams/utilities, `createModels`/`createProvider`, not global `getModel`/`stream` dispatch. Use extension `ctx.modelRegistry` or standalone `ModelRuntime`; isolated `createModels()` does not load every provider/config automatically. `ModelRegistry` is supported; it has no `completeSimple`, so use `streamSimple(...).result()`.
- Jiti maps root `pi-ai` to the `/compat` superset and can mask invalid root imports. Validate real ESM/types **and** bundled extension loading. Npm `/api/*` exports do not prove Jiti subpath resolution; where the actual host alias misresolves a needed factory, use one explicit supported `/compat` factory, not a custom resolver or root-global routing architecture.
- Runtime dispatch resolves request auth/baseURL/headers/env. Header-only, OAuth and ambient auth may have no API-key string: do not require/extract/echo a key before registry calls. Scope is a selection snapshot, not authorization; empty `ctx.scopedModels` is unrestricted. Preserve explicit evaluation selection/effort and paid-call authority.
- Native setup-abort can return `stopReason: "error"` with an abort message; retain cancellation classification. Provider hooks report failures but dispatch continues, so they are not fail-closed security gates. Auxiliary registry calls do not automatically become session usage: return usage on the outer tool result.
- Preserve `ModelsRequestTransforms` and `ProviderHeaders` null deletion markers. Refresh returns `ModelsRefreshResult`; inspect aborted/errors. Auth mutations establish local consistency, not remote refresh. Propagate OAuth refresh signals; never log credentials.
- `createProvider({ fetchModels })` owns publication; handwritten refresh reads immutable `context.stored` and generation-checked `context.publish({ persist, update })`. Persistence failure prevents paired mutation. Legacy model lists replace catalogs; native providers still receive `models.json` overlays. Current streams receive `TranscriptContext`: use current system/tool helpers, emit exactly one terminal event, preserve usage, partial-call validity and abort.
- Built-in `1.4.0` providers include `google-gemini-cli` (`gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash` via `google-cloud-code-assist`) and `minimax-cn`.
- In `1.4.0` `codemode`, `models.classify(model, { state, questions, images })` supports optional `images` (`ImageContent[]` with `{ type: "image", data, mimeType }`) for classifiers with `"image"` in `model.input`. Current `cloudflare-workers-ai` classifiers are `@cf/cloudflare/clef` (27B, 65,536 context, `["text", "image"]`), `@cf/cloudflare/clef-omni` (multimodal, 64,000 context on `cloudflare-workers-ai` and 65,536 on OpenRouter `cloudflare/clef-omni`, `["text", "image"]`), and `@cf/cloudflare/clef-flash` (9B, 24,576 context, `["text", "image"]`). Codemode bounds total concurrent worker threads across the process with `PI_CODEMODE_MAX_WORKERS` (default `min(availableParallelism(), 4)`). Missing-member reads on `tools` throw, so use `"name" in tools`, not `typeof tools.name`.

## TUI and `@earendil-works/pi-agent-core` `1.4.0`

Use supplied host TUI, never a second terminal/render loop. **Fullscreen is the `1.4.0` default**; also test regular mode, narrow/wide/CJK, resizing, focus, keyboard/mouse, cancellation, done and disposal. `ctx.hasUI` includes RPC; custom components require `ctx.mode === "tui"`. Use `tui.queryTerminalColors()` (`TerminalColors`, `TerminalColorScheme`, `parseTerminalColorSchemeReport`), not removed standalone color-scheme/background query helpers. Extend `CustomEditor` and forward unhandled keys to `super.handleInput`; use configured keybindings. Close custom UI through `done`, not hiding a handle and abandoning its promise.

In `@earendil-works/pi-tui` `1.4.0` (both official and fork), public cursor APIs are `renderFakeCursor(text)` and `CURSOR_MARKER` (along with `compositeTuiLine` and `stripTerminalSequences`). Place `CURSOR_MARKER` immediately before a cursor cell wrapped with `renderFakeCursor(text)`, emitting the position marker only when focused. With hardware cursor off, the TUI resolves fake-cursor markers to reverse video; with hardware cursor on, the focused marked fake cursor loses reverse video while its text remains and unfocused fake cursors stay visible. Prefer native `Input`/`CustomEditor` so the host owns cursor behavior.

`@earendil-works/pi-agent-core` `1.4.0` exports only `Agent`, `agentLoop`/`agentLoopContinue`, `streamProxy`, and agent types. **Ordinary extensions use `pi-coding-agent` SDK/SessionManager/runtime or stdio RPC**. Only explicitly durable requirements warrant `@earendil-works/pi-durable` (`1.4.0`) and its separate storage contract.

## Source map (`1.4.0`)

Official `1.4.0` (`4a080252f06caf63a525d7873c5d94d3c23887e0`) and fork `1.4.0` (`9e0674ef667e90a63a5fb64f18fbb476cd1b8a3f`):
- `packages/coding-agent/{CHANGELOG.md,schemas/*.schema.json,docs/{sdk,extensions,sessions,session-format,rpc,tui,packages,codemode,mcp}.md,src/{index.ts,core/{sdk,agent-session,agent-session-runtime,session-manager,model-runtime,model-registry,key-id-schema,keybindings-schema,model-config,settings-schema}.ts,core/extensions/{types,loader,runner}.ts,core/tools/file-mutation-queue.ts,modes/interactive/theme/{theme-schema,theme}.ts,modes/rpc/{rpc-client,rpc-mode,rpc-types}.ts}}`
- `packages/agent/{CHANGELOG.md,package.json,src/index.ts}`
- `packages/ai/{package.json,src/{index,compat,models}.ts,src/providers/model-schema.ts}`
- `packages/tui/{CHANGELOG.md,src/{index,tui,terminal,terminal-colors,components/editor,components/input,utils}.ts}`
- Fork-only repository paths (`9e0674ef667e90a63a5fb64f18fbb476cd1b8a3f`): `FORK.md`, `packages/coding-agent/docs/{instruction-groups,restart,working-session}.md`, `packages/coding-agent/src/extensions/{instruction-groups,restart,background-commands}/`, `packages/coding-agent/src/core/{managed-host-coordinator,working-session-state,auth-storage-fallback}.ts`.
