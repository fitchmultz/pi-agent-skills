# Lifecycle Checklist

Use when state, persistence, reload, session metadata, tree navigation, fork/resume, compaction, SDK/RPC runtime replacement, dynamic runtime mutation, or UI cleanup matters.

## Boundaries to check

- project trust before trust-gated project inputs load (project config resources/packages/extensions and project `.agents/skills`; not AGENTS.md/CLAUDE.md context files)
- extension factory load vs bound runtime
- startup and each low-level `agent_end`
- final-idle `agent_settled` / `AgentSession.waitForIdle()` / `ExtensionCommandContext.waitForIdle()` after retries, compaction/summarization retry, and queued continuations; never low-level `session.agent.waitForIdle()`
- dynamic tool/provider registration after startup, including native-provider replacement and removal
- `/reload` / `ctx.reload()`
- `/new` and `/resume`
- `/fork` and `/clone`
- `/tree` navigation
- `/compact` / auto-compaction
- process exit / `ctx.shutdown()`
- model or thinking-level changes
- SDK/RPC `AgentSessionRuntime` replacement, including `importFromJsonl()`
- pi-agent-core v4 `Session` lane movement/forking and durable open-operation recovery
- remote-session acquisition/release and authoritative `SessionSnapshot` replacement
- cwd switches whose project trust is unresolved
- TUI component/overlay/widget disposal

## Factory and load order

- Factory load uses registration APIs, registered default-only `getFlag()` reads, and `pi.exec()` only when essential startup work must finish before `session_start`; session-bound actions wait for binding.
- Provider registration during factory load is queued intentionally. Choose legacy `(id, config)` or a native complete pi-ai `Provider` deliberately; factory-time unregister only cancels pending same-name registrations and does not remove an existing or built-in provider. Post-bind unregister removes only a dynamic registration and restores overridden built-ins.
- CLI extension flags are registered during factory load, but parsed CLI values are read from `session_start`, commands, tools, or events unless default-only behavior is intended.
- Before trust, user/global, CLI, and SDK inline extensions load; context files load later independently of trust. After trust, project/user/package resource precedence is understood when collisions matter.
- `project_trust` handlers, if present, return yes/no/undecided intentionally, persist with `remember` only when intended, and account for saved parent decisions plus `defaultProjectTrust`.
- CLI extensions winning first-registration collisions, SDK inline factories loading last, first-wins tools/flags/renderers, suffixed duplicate commands, and last-wins extension shortcut conflicts are acceptable for the design.
- Each provider name has one owner where practical. Repeated legacy configs compose defined top-level fields in load order, but every fragment validates independently and arrays such as `models` replace even when empty; native complete-provider registration replaces the extension provider base for that id.

## State model

- In-memory state can be reconstructed.
- Branch-aware state is stored in tool result `details` or branch-scanned custom entries; nested-model token/cost accounting stays in top-level `usage`, not `details`.
- Non-model state is stored with `pi.appendEntry()` when needed; `registerEntryRenderer()` is paired with it only for persisted display-only transcript UI.
- `session_start` rehydrates from `ctx.sessionManager.getBranch()` or `getEntries()` intentionally.
- `session_info_changed` updates any UI/state that depends on the current display name.
- `session_tree` rehydrates if branch navigation changes meaning.
- `agent_end` is used only for per-low-level-run work; final notifications, host idle transitions, and final cleanup use `agent_settled`, `AgentSession.waitForIdle()`, or `ExtensionCommandContext.waitForIdle()` when automatic continuations or summarization retries may remain, never low-level `session.agent.waitForIdle()`.
- `session_shutdown` cleans timers, watchers, processes, subscriptions, raw input listeners, overlays/widgets, and handles.

## Runtime mutation

- Dynamic `pi.registerTool()` is intentional and does not require `/reload`.
- Runtime `pi.setActiveTools()` changes are persisted or reconstructed when needed.
- Provider register/unregister timing is clear and validated if model availability matters. Dynamic refresh uses read-only `context.stored` and generation-checked `context.publish()`; no state mutates before successful publication. `createProvider({ fetchModels })` and config callbacks that only return models keep factory-owned publication. Same-id native registration discards prior legacy state and replaces native ownership; switching back deletes native ownership and starts from the new legacy fragment. Only later legacy re-registrations merge defined fields. Any removed/renamed conditional extension provider may survive `/reload` until explicitly unregistered or the runtime is rebuilt.
- `/reload` is used for source/resource reload, not as a substitute for supported dynamic APIs; reload also applies updated steering/follow-up mode settings to the current session in current pi.

## Replacement footguns

- Code after `await ctx.reload()` returns immediately and does not use stale state.
- Compaction handlers use `reason` and `willRetry` to distinguish manual compaction, threshold auto-compaction, and overflow retry flows; custom compaction and branch-summary provider usage is returned and persisted.
- Same-directory session switches may reuse imported modules while still creating fresh extension instances and lifecycle events; per-session mutable state resets from `session_start`, not top-level module initialization.
- `withSession` callbacks use only the fresh replacement context.
- Old `ctx`, session-bound `pi` methods, and captured `SessionManager` objects are not used after replacement.
- If committed session replacement or tree navigation begins during an active response, Pi owns aborting and persisting active work. Unstarted siblings in a sequential tool batch can remain unmatched after abort; workflows that require balanced call/result history wait for final idle before switching, while forced mid-turn switches document the limitation instead of appending synthetic results.
- Session replacement into another cwd can trigger project trust again; do not assume trust-gated project resources are loaded until trust resolves, and use `ctx.isProjectTrusted()` when later behavior depends on effective trust.
- SDK/RPC hosts use `runtime.setRebindSession(...)` as the single binder when extensions/session plumbing must be rebound; they do not also bind manually after successful replacement, and cancellation skips rebind.
- SDK hosts use `runtime.setBeforeSessionInvalidate(...)` for synchronous UI teardown before old contexts become stale.
- Hosts handle replacement creation failure as fatal/recoverable rebuild: the old session has already been disposed and must not be reused.
- SDK subscriptions are unsubscribed/resubscribed after `runtime.session` changes.
- Session import is treated like session replacement: teardown/rebind happens, cwd override/project trust may matter, and stale session objects are not reused.

## Mode behavior

- TUI-only UI checks `ctx.mode === "tui"`.
- Dialog-capable flows check `ctx.hasUI`.
- RPC behavior is checked when extension UI should work through clients; hosts accumulate delta-only `message_update` events until authoritative `message_end`, query `get_available_thinking_levels` again after model changes, run direct `bash` through extension `user_bash` policy, and consume `bash_execution_update` when streaming output.
- Remote clients treat listed `SessionMetadata` as durable discovery only and read runtime phase/model/thinking/attachment/lock state from acquired `SessionSnapshot` values.
- Print/JSON behavior is explicit.
- Non-interactive automation policy is explicit and not accidentally blocked by UI-only assumptions.
- `--approve/-a`, `--no-approve/-na`, and `defaultProjectTrust` behavior is tested when trust-gated project settings/resources/packages/skills affect the result; context-file behavior is tested separately when relevant.

## Parallelism

- Sibling tool calls may run concurrently.
- `tool_call` does not rely on sibling tool results from the same assistant response.
- File mutations use `withFileMutationQueue()` across the whole mutation window.
- `executionMode: "sequential"` serializes the entire sibling-call batch in source order when any sibling is sequential; use it only for a truly shared state machine.
- Independent resources use keyed queues where finer-grained concurrency matters.
