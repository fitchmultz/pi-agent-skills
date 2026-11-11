# Lifecycle Checklist

Use when state, persistence, reload, session metadata, tree navigation, fork/resume, compaction, SDK/RPC runtime replacement, dynamic runtime mutation, or UI cleanup matters.

## Boundaries to check

- project trust before trust-gated project inputs load (project config resources/packages/extensions and project `.agents/skills`; not AGENTS.md/CLAUDE.md context files)
- extension factory load vs bound runtime
- startup and each low-level `agent_end`
- local-idle `agent_settled` / `AgentSession.waitForIdle()` / `ExtensionCommandContext.waitForIdle()` after retries, compaction/summarization retry, and queued continuations; never low-level `session.agent.waitForIdle()`; extension-owned detached jobs have a separate completion boundary
- dynamic tool/provider registration after startup, including native-provider replacement and removal
- `/reload` / `ctx.reload()`
- `/new` and `/resume`
- `/fork` and `/clone`
- `/tree` navigation
- `/compact` / auto-compaction
- process exit / `ctx.shutdown()`
- model or thinking-level changes
- SDK/RPC `AgentSessionRuntime` replacement, including `importFromJsonl()`
- acquired live-state replacement for explicitly source-targeted remote hosts; experimental coding-agent client/server surfaces are not published SDK prerequisites
- session replacement into another cwd with its trust decision; execution-only `change_dir` does not reload trust, context files, or skills
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
- `session_start` rehydrates from `ctx.sessionManager.getBranch()` for anything that tree navigation can undo, and from `getEntries()` only for facts that hold for the whole session file.
- Custom type names, the size and versioning of stored records, where package files live, and the state snapshot the model needs after a compaction follow [State](house-conventions-tool-contract.md#state).
- `session_info_changed` updates any UI/state that depends on the current display name.
- `session_tree` rehydrates if branch navigation changes meaning.
- `agent_end` is per-low-level-run. Local-run notifications use shared `agent_settled`, `AgentSession.waitForIdle()`, or `ExtensionCommandContext.waitForIdle()` after continuations/retries, never low-level `session.agent.waitForIdle()`. On the inspected hosts, actionable final-boundary work uses `agent_before_settle`; settlement is notification-only. Extension-owned detached jobs are not completed by local settlement.
- `session_shutdown` cleans timers, watchers, processes, subscriptions, raw input listeners, overlays/widgets, and handles.
- Idle RPC `ctx.shutdown()` runs immediately when no command is active; an active command writes its response first. Print mode still exits through its own completion path. Let the host finish started OAuth refresh persistence during shutdown rather than killing it on the first signal.

## Compaction prompt and tool state

On both hosts, let `SessionManager` build the compaction checkpoint and provider context; use public retain-none compaction for rollover. On the fork, a compaction without a provider summary block keeps the current prompt sections but the tool list of the context's first system message in `CompactionEntry.systemMessage`. Its optional `toolUpdate`<!-- fork-only --> is a second system message carrying only the net `toolsRemoved` and `toolsAdded`. Projection places both, in that order, before the summary. Replaying them restores the current definitions and their order; repeated compaction keeps the initial list and the existing update order before appending newer definitions. Preserve both messages in `context_with_system`; do not replace the first tool list with the current list or discard the second message as redundant. Native working-session validation also checks the update as a system message.

Official Pi stores the complete current prompt and tool state in `systemMessage`, without that second checkpoint field. Keep its native checkpoint and projection rather than requiring the fork's split or synthesizing one through private state. Both paths retain the tools; when tools changed, the fork's native Anthropic path can also preserve the earlier tool-list cache prefix after compaction. Parse the selected host's entry shape and keep the host's normal journal recovery. See [Fork provider differences](provider-model-guide.md#fork-provider-differences) for serialization and the new transcript helpers. Sources: `src/core/session-manager.ts` and, on the fork, `src/core/working-session.ts`.

## Provider summary compactions

This capability is fork-only. An extension's `session_before_compact` result (`ExtensionCompactionResult`<!-- fork-only -->), or a `compaction` draft from `turn_end`, can opt in with `providerSummary`<!-- fork-only --> set to `{ instructions?: string }`. The optional instructions replace the provider's own summarization prompt. Read `docs/compaction.md#provider-summary-block`<!-- fork-only --> and the implementations in `src/core/{agent-session,session-manager}.ts` and `src/core/extensions/{types,runner}.ts` at the selected fork commit.

- **Choose by capability.** `supportsProviderSummary(model)`<!-- fork-only --> from the loaded pi-ai module is true for `anthropic-messages` with all three compatibility flags: `supportsMidConvoEffort`, `supportsMidConvoSystemMessages`, and `supportsMidConvoToolChanges`. The built-in routes are supported Claude models on Anthropic and Cloudflare AI Gateway, not every Claude endpoint. Do not name-import the helper on official Pi.
- **Request.** Pi asks the session's current model through its own login and route, rerunning context hooks on the prefix that the first kept reply answered, with that reply's recorded thinking level when available, otherwise the current level. The request normally reuses a cached prompt and uses a 30-second abort timeout; a cache hit is not guaranteed. A `turn_end` request runs only when the draft is appended, after all handlers, so boundary previews contain no block.
- **Record and usage.** Pi keeps the extension's summary, retained-entry boundary, token count and details. `CompactionProviderSummary`<!-- fork-only --> on the saved entry records provider, API, model, duration, usage, and either the opaque block or a reason without one. Pi adds that request's usage to the compaction's top-level `usage`; do not add it again. Treat the signed block as opaque and never edit it.
- **Successful projection.** The leading system message keeps its prompt and initial tool list unchanged, and carries the block. A host-owned system message restates the summarized tool changes for Pi and other models; the block's model restores those changes from the block, so its adapter does not send duplicate definitions. The kept messages, including their system messages, follow; the extension's `compactionSummary` follows them, then later messages. The entry has no `toolUpdate`. Prompt changes from the summarized range are stated again before the next request, after the kept range. Do not apply the ordinary checkpoint's current-prompt or summary-first ordering to this entry.
- **Cuts and fallbacks.** The first retained non-system projected message at or after `firstKeptEntryId` must be an assistant reply that neither failed nor was aborted, with a leading system message and an actual conversation prefix before it. Retain-none drafts, a user/tool/custom first message, and a cut with no preceding conversation cannot make a block. The saved reason is `cut`; other outcomes are `overflow`, `model`, `prompt`, `aborted`, `timeout`, `error: <message>` or `stop: <stop reason>`. Overflow, unsupported/virtual models and a forced run prompt send no request. Esc during the block request stops that request, not the already-prepared compaction. These outcomes store the extension's ordinary compaction; they neither cancel it nor run Pi's own summarizer because the opt-in failed.
- **Hooks and model changes.** In `context_with_system`, leave every message before `compactionSummary` unchanged when the head carries a block: no head edits, inserted messages, reordered or removed kept messages. Put new state after the summary and preserve its position on later requests. A changed `context` list or a `before_agent_start` forced prompt substitutes the block's visible summary text (or an unavailable-summary notice) for that request; another provider, API or model gets the same fallback through coding-agent's model runtime. These requests remain usable but do not preserve the kept reasoning. Context estimates ignore usage from kept replies that predate the block until a new reply supplies usage.

**Complete official path:** return the ordinary custom compaction with `summary`, `firstKeptEntryId`, `tokensBefore`, optional `details` and real summary-call `usage`, without the opt-in. Use the official host's manager and context hooks for retention or public retain-none rollover. A portable extension detects the helper on the loaded module and adds the opt-in only for a supported model; it never requires a fork import or invents a signed block. Official compaction retains the selected conversation but cannot preserve Claude's kept thinking through this provider-summary mechanism. See [Fork provider differences](provider-model-guide.md#fork-provider-differences) for low-level APIs and diagnostic evidence.

## Managed restart prompt state

Managed restart control is fork-only. Native managed TUI control sets the `restart` prompt section in `before_agent_start`, so Pi records it. A copied session continuing without managed control retains its historical leading system message and records the section's removal later. Providers accepting mid-conversation system messages keep that leading prefix; other providers fold the removal into the leading message. Preserve later section patches in `context_with_system`; do not strip the historical section or rewrite the head yourself. Native code also handles saved windows whose leading record lacks the section. Forced prompt text stays run-scoped and unpersisted. Sources: `src/extensions/restart/index.ts`, `src/core/{agent-session,system-prompt}.ts` and `docs/restart.md`.

Official Pi has no managed restart facility. For an extension's persistent guidance, use shared `before_agent_start` and `event.systemPromptOptions.sections`, letting Pi record updates and removals. Use `/reload` for changed extensions/resources. A clean-process change needs ordinary shutdown and an owner/external-host relaunch with `pi --session "/absolute/session.jsonl"`; persist extension state and clean up resources through the normal lifecycle APIs. Do not require `ctx.managedHost` on official Pi.

## Copied-session cache identity

On the fork, a session that copies another conversation records optional `SessionHeader.cacheSessionId`<!-- fork-only -->. `/fork`, `/clone`, `--fork` and a copied `--session` from another project keep the source header's cache identity when present, otherwise its `id`; a copy of a copy therefore keeps the original routing identity. `SessionManager.getCacheSessionId()`<!-- fork-only --> returns that field or the session's own ID when it is absent. An extension that writes a copied-conversation journal must set the field by the same rule; `parentSession` alone does not establish cache inheritance for a fresh, empty child.

Pi uses the cache identity for the session agent's provider requests, including OpenAI's prompt cache key and session-affinity headers. Do not assume every auxiliary summary call uses that same identity. The copy still has its own session `id`, filename, `PI_SESSION_ID` and `--session` identity. Do not use the provider's routing ID as an application/session primary key, and do not change the journal ID to chase cache hits. Shared routing can reach the copied prefix's existing cache; it does not guarantee that the cache is warm or that the request prefix matches. Sources: `src/core/{session-manager,sdk,agent-session}.ts` and `docs/session-format.md#sessionheader`.

Official Pi has neither field nor getter. Use its normal fork/clone/session-manager path with distinct session identities, and accept its new provider routing identity rather than requiring fork metadata or claiming copied-prefix cache reuse. The getter belongs to a full SDK-owned `SessionManager`; the extension context's read-only manager type does not expose it. Detect the getter structurally on a full manager when inspecting fork routing, or inspect its header without assuming official header types have the field. Ordinary session identity on both hosts still comes from `getSessionId()`.

## Runtime identity records

On the fork, saved sessions get a `pi.runtime` custom entry before each `session_start` (startup, new, resume, fork and reload). Root exports `RUNTIME_RECORD_ENTRY` and `RuntimeRecordData` describe its format: build/runtime identity, loaded package versions and Git commits, loose extension entry-file hashes, and loaded context-file sizes/hashes. It never enters model context. Keep `pi.` reserved; use your package prefix for custom types on both hosts. Source: `src/core/runtime-record.ts` and `src/core/agent-session.ts`.

- In-memory sessions get no record. New saved sessions buffer it until a first message creates the journal. Resumed/reloaded sessions write it immediately.
- Working-session restore holds its record until the first agent run, so a startup that rolls back does not make the journal newer than its saved state. An unused restored session gets no record.
- The session selector ignores the record for activity/count/preview/name, but its write changes mtime, which `pi -c` uses. A custom leaf is hidden in the fork's HTML export.
- Versions, commits and entry hashes read disk, not the complete imported module graph. Same-directory `/new`, `/resume` or `/fork` can retain already imported code after a package changes on disk; `/reload` or restart loads the update. Do not claim the record proves the bytes of every running module.
- Official Pi has no runtime record. An SDK host can keep an explicit identity receipt outside the journal, or an extension can append its own small non-model custom entry with the same disk-versus-loaded-code limitation. Do not require a `pi.runtime` record to resume an official session.

## Shutdown ordering

On both hosts, clean up owned resources in `session_shutdown`. Official runtime shutdown aborts and awaits the active turn before the handler. A certified working-session exit on the fork also waits without a limit. An ordinary fork quit aborts and waits up to 500 ms while handlers run: tool results and `agent_end` can arrive during or after the handler. Tolerate those events, stop owned work promptly, and do not assume every interrupted call got a saved result if it ignored cancellation. The bound is on turn settlement, not on the shutdown handlers or credential writes. Source: `src/core/agent-session-runtime.ts`.

On the fork, a malformed native working-session restore names the first invalid field, such as `entries[12].message.content[0].type`. Handle the refusal without rewriting the journal or substituting partial state. Official Pi uses its ordinary session persistence; keep the host's own validation and recovery when a native working-session capability is absent.

## Runtime mutation

- Dynamic `pi.registerTool()` is intentional and does not require `/reload`.
- Runtime `pi.setActiveTools()` changes are persisted or reconstructed when needed.
- Provider register/unregister timing is clear and validated if model availability matters. Dynamic refresh uses read-only `context.stored` and generation-checked `context.publish()`; no state mutates before successful publication. `createProvider({ fetchModels })` and config callbacks that only return models keep factory-owned publication. Same-id native registration discards prior legacy state and replaces native ownership; switching back deletes native ownership and starts from the new legacy fragment. Only later legacy re-registrations merge defined fields. Any removed/renamed conditional extension provider may survive `/reload` until explicitly unregistered or the runtime is rebuilt.
- `/reload` refreshes resources/reinitializes extensions, not ordinary dynamic state. Both hosts clear factory caches on reload. Validate the exact distribution used, with a fresh process when package/runtime identity matters.

## Replacement footguns

- Code after `await ctx.reload()` returns immediately and does not use stale state.
- Compaction handlers use `reason` and `willRetry` to distinguish manual compaction, threshold auto-compaction, and overflow retry flows; custom compaction and branch-summary provider usage is returned and persisted.
- Same-directory session switches may reuse imported modules while still creating fresh extension instances and lifecycle events; per-session mutable state resets from `session_start`, not top-level module initialization.
- `withSession` callbacks use only the fresh replacement context.
- Old `ctx`, session-bound `pi` methods, and captured `SessionManager` objects are not used after replacement.
- If committed session replacement or the interactive `/tree` command begins during an active response, Pi owns aborting and persisting active work; programmatic `navigateTree()` (extension `ctx.navigateTree`, RPC, print mode) instead rejects while a run is active. Unstarted siblings in a sequential tool batch can remain unmatched after abort; workflows that require balanced call/result history wait for final idle before switching, while forced mid-turn switches document the limitation instead of appending synthetic results.
- Session replacement into another cwd can trigger project trust again; do not assume trust-gated project resources are loaded until trust resolves, and use `ctx.isProjectTrusted()` when later behavior depends on effective trust.
- SDK/RPC hosts use `runtime.setRebindSession(...)` as the single binder when extensions/session plumbing must be rebound; they do not also bind manually after successful replacement, and cancellation skips rebind.
- SDK hosts use `runtime.setBeforeSessionInvalidate(...)` for synchronous UI teardown before old contexts become stale.
- Hosts handle replacement creation failure as fatal/recoverable rebuild: the old session has already been disposed and must not be reused.
- SDK subscriptions are unsubscribed/resubscribed after `runtime.session` changes.
- Session import is treated like session replacement: teardown/rebind happens, cwd override/project trust may matter, and stale session objects are not reused.

## Mode behavior

- TUI-only UI checks `ctx.mode === "tui"`.
- Dialog-capable flows check `ctx.hasUI`.
- RPC behavior is checked when extension UI should work through clients; hosts accumulate delta-only `message_update` events, each carrying the latest cumulative `usage`, until authoritative `message_end`, query `get_available_thinking_levels` again after model changes, run direct `bash` through extension `user_bash` policy, and consume `bash_execution_update` when streaming output. Fork `background_command` is checked separately because it bypasses `user_bash` while receiving the default session environment.
- Source-targeted remote clients inspect their exact protocol and distinguish durable discovery metadata from acquired live state. Ordinary published integrations use the supported SDK/RPC contract.
- Print/JSON behavior is explicit.
- Non-interactive automation policy is explicit and not accidentally blocked by UI-only assumptions.
- `--approve/-a`, `--no-approve/-na`, and `defaultProjectTrust` behavior is tested when trust-gated project settings/resources/packages/skills affect the result; context-file behavior is tested separately when relevant.

## Parallelism

- Sibling tool calls may run concurrently.
- `tool_call` does not rely on sibling tool results from the same assistant response.
- Same-file mutations use `withFileMutationQueue()` across the whole mutation window; it is process-local, not a multi-file transaction or cross-process lock. Preserve missing-path/symlink safeguards.
- `executionMode: "sequential"` serializes the entire sibling-call batch in source order when any sibling is sequential; use it only for a truly shared state machine. Detached extension jobs still need explicit ownership and cancellation.
- Independent resources use keyed queues where finer-grained concurrency matters.
