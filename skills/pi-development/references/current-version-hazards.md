# Version and distribution hazards

Read this before you copy an affected API. It records which contracts official Pi and the `fitchmultz/pi` fork share, which exist on one of them only, and where documentation disagrees with code. The selected host's implementation and emitted types win over this file.

## Targets and floors

The stamp is `metadata.last-verified-pi` and `metadata.fork-source` in the `SKILL.md` frontmatter: the official release and the fork commit that this skill was last checked against. They are also the floors. This table shows the same pair; the repository's tests fail when an official version or a fork commit in the skill differs from the stamp.

| Distribution | Floor | Target |
| --- | --- | --- |
| Official Pi (`earendil-works/pi`) | Release [`1.5.2`](https://github.com/earendil-works/pi/releases/tag/v1.5.2) | The latest published release: `gh release view --repo earendil-works/pi --json tagName,url`, or npm `@earendil-works/pi-coding-agent@latest`. Use its public SDK (`dist/index.js`), declarations, and schemas. |
| `fitchmultz/pi` fork | Commit [`0106ee92c42eca0c96a3c6ad45f501a3878723e2`](https://github.com/fitchmultz/pi/tree/0106ee92c42eca0c96a3c6ad45f501a3878723e2). Its `FORK.md` names the upstream commit that it has merged. | The latest `main` commit: `gh api repos/fitchmultz/pi/commits/main --jq .sha`. Check it against that revision's `FORK.md`, SDK exports, and bundled CLI. Record the installed fork release separately. |

- A floor is a minimum, not a pin. Build and validate against the latest official release, the latest fork `main`, and the latest release of every dependency and companion tool. When a target is newer than its floor, the host wins over this skill: read the `[Unreleased]` and newer version sections of its `CHANGELOG.md`, and its own docs, before you copy an API from here.
- When the installed host is older than its floor, do not build for it. Have the user update it first: `pi update` on official Pi, `pi update --fork` on the fork, then `pi update --extensions` for this skill.
- Every extension supports both distributions. A matching version string does not make them the same artifact.
- Do not write code, shims, or fallbacks for anything older than a floor.
- Upstream `main` is not a release. A change the fork has merged can still be absent from the latest official package. At this stamp, no extension-facing upstream contract remains ahead of the official release.

Versions at the last verification. Treat them as floors too, and resolve the current release of each before you use it:

| Component | Version |
| --- | --- |
| `@earendil-works/pi-coding-agent`, `pi-agent-core`, `pi-ai`, `pi-tui`, `pi-telemetry`, `pi-codemode`, `pi-mcp`, `pi-schema`, and the companion `pi-durable` | `1.5.2` on both targets. Read `packages/coding-agent/package.json` at the fork commit rather than inferring parity from that version. The fork's coding-agent also depends on `@earendil-works/chord` and `@earendil-works/pi-durable`. |
| TypeBox bundled with Pi | `1.3.27` on official Pi, `1.3.37` on the fork. Code for both uses only `1.3.27` APIs. |
| Node and npm | Both distributions declare `engines.node >=22.19.0`. Extension work uses Node `>=24.21.0`; the current Node 24 release is `24.22.2`, and npm is `12.2.2`. This refresh ran with Node `24.22.1` and npm `11.19.1`. |
| `@fitchmultz/pi-subagents` | `0.52.34` |
| `pi-change-working-dir` (Git package) | `0.6.0` |
| `oxlint`, `oxfmt` | `1.93.0`, `0.78.0` |
| TypeScript (`tsc`) | `7.0.2` |

Pi's own dependencies can be nested under `pi-coding-agent/node_modules`. Resolve them from the selected SDK, not from the consumer's root. Keep live resources, settings, and the running runtime untouched while you qualify a target in isolation.

## Fork-only capabilities

The fork's revision-matched `FORK.md` owns this inventory; read it at the target revision. The list below covers the extension-facing parts at the fork floor. Official Pi has none of them.

- **Process restart:** `pi restart`, `/restart`, `ctx.managedHost`<!-- fork-only -->, `ManagedHost`<!-- fork-only -->, `docs/restart.md`<!-- fork-only -->. See [Managed restart prompt state](lifecycle-checklist.md#managed-restart-prompt-state) for recorded guidance/removal and official Pi's reload or external-relaunch path.
- **Shutdown disposition** for work that outlives a worker: `ShutdownDisposition`<!-- fork-only --> is `release`, `handoff`, or `provisional`. `session_shutdown` sets `disposition` only for `quit`, and only when `ctx.managedHost` exists.
- **Detached background shell commands:** `background_command`<!-- fork-only -->, `builtin:background-command`, `docs/background-command.md`<!-- fork-only -->.
- **Background-work reporting:** `AgentSession.getBackgroundWork()`<!-- fork-only -->, the `background_work`<!-- fork-only --> event and `createBackgroundCommandExtension({ hostWaits: true })`<!-- fork-only -->. See [SDK background work](runtime-authoring-guide.md#sdk-background-work) for the host loop and the complete official path.
- **Tool exposure setting:** `toolExposure` in `settings.json` replaces a tool's registered exposure by name or `*` pattern. Both hosts separately support per-server MCP `toolExposure`; see [Native tools and deferred tool discovery](runtime-authoring-guide.md#native-tools-and-deferred-tool-discovery).
- **Default-active registration exclusions:** negative tool-selection entries suppress automatic activation of extension/SDK tools, including late registration. This behavior is fork-only; see [Native tools and deferred tool discovery](runtime-authoring-guide.md#native-tools-and-deferred-tool-discovery) for lifecycle limits and complete official controls.
- **Codemode look-ups and reads:** `show(...calls)`, `models.docs()`, whole-text nested reads up to 1 MiB, multi-page continuation offsets, past-end reads and missing-path hints. See [Fork codemode and native-tool additions](runtime-authoring-guide.md#fork-codemode-and-native-tool-additions) for limits and official equivalents.
- **Runtime records:** `pi.runtime`, `RUNTIME_RECORD_ENTRY`<!-- fork-only --> and `RuntimeRecordData`<!-- fork-only -->; see [Runtime identity records](lifecycle-checklist.md#runtime-identity-records).
- **Background tool runs:** `ctx.runInBackground(customType, work)`<!-- fork-only --> in tool contexts, `BackgroundToolResult`<!-- fork-only --> with optional `commit()`, and `BackgroundToolMessageDetails`<!-- fork-only -->. A run ends with the process. See `docs/extensions.md#background-tool-runs`<!-- fork-only -->.
- **JSON selection for `read`:** `json.path` and `json.fields` on `createReadToolDefinition` and `createReadTool`.
- **Compact activity view:** the `compactView: boolean | "hybrid"`<!-- fork-only --> setting; message renderers receive `MessageRenderOptions.compactView?: boolean`.
- **Fork self-update:** `pi update --fork`.
- **Termux additions:** official Pi supports Termux (`docs/termux.md`). The fork adds installer compiler and environment handling, short control-socket paths, and an OSC 52 clipboard fallback that needs no Termux:API.
- **Complete working-session state:** `openWorkingSession`<!-- fork-only -->, `parseWorkingSession`<!-- fork-only -->, `readWorkingSession`<!-- fork-only -->, `writeWorkingSession`<!-- fork-only -->, the `WorkingSession*`<!-- fork-only --> types, `session.acquireWorkingSession(...)`<!-- fork-only -->, `session.bindWorkingSessionHost(...)`<!-- fork-only -->, `createAgentSession({ workingSession })`, the `working_session_save`<!-- fork-only --> event, and `docs/working-session.md`<!-- fork-only -->.
- **Provider credential isolation:** `ignoreStoredCredentials: true`<!-- fork-only --> on a provider registration, so a routing provider does not read unrelated stored credentials. See `docs/custom-provider.md`.
- **Fallback credential chains:** `pi.registerProviderAuthFallback`<!-- fork-only -->, `ModelRuntime.registerProviderAuthFallback`, `ProviderAuthFallback`<!-- fork-only -->. See `docs/custom-provider.md`.
- **Public model-reference resolution:** root exports `resolveModelReference` and the `ModelReference*` types. Official Pi keeps the resolver internal. See `docs/sdk.md#resolve-a-model-reference-without-creating-a-runtime`<!-- fork-only -->.
- **Hidden model overrides:** `modelOverrides.<id>.hidden: true` in `models.json` removes a model from its provider.
- **Null inside a schema union:** the fork drops a `null` sent for an optional property of an object inside `anyOf` or `oneOf`. Official Pi converts it instead, for example to `"null"` for a string property. Both drop it for an optional property of a plain object. When the result matters, keep optional properties out of union branches, for example with one object and a `StringEnum` discriminator.
- **Source-aware fullscreen selection:** a highlighted copy of native Markdown keeps its source syntax and real line breaks; `/copy` still copies the whole message. Prefer native Markdown and Text components, and read `packages/tui/src/{selection-source,selection-markers}.ts` before you map sources yourself.
- **Opt-in diagnostics:** `PI_EXTENSION_PERFORMANCE=1`<!-- fork-only --> (`docs/environment-variables.md`) warns about slow handlers and footer renders. The wrapper preserves component members such as `capturesViewportInput`.
- **Compaction cache prefix:** the initial tool list plus a separate checkpoint update preserve Claude's native tool-cache prefix. See [Compaction prompt and tool state](lifecycle-checklist.md#compaction-prompt-and-tool-state) for the split and official Pi's complete single-checkpoint path, and [Fork provider differences](provider-model-guide.md#fork-provider-differences) for serialization and fork-only transcript helpers.
- **Catalog and correctness fixes** listed in `FORK.md`, including Kimi K3-family cache-write pricing, required-first Claude strict-tool budgets, qualified Gemini unsigned-tool replay, and Astra Ultrafast cost estimates that wait for terminal tier confirmation. See [Provider differences](provider-model-guide.md#fork-provider-differences). Source and offline checks do not establish live billing.

Detect a fork seam structurally at the call site, as `pi-subagents` does:

- `Reflect.get(ctx, "managedHost")`
- `typeof sdk.resolveModelReference === "function"` on the loaded SDK module
- `typeof ctx.runInBackground === "function"`
- `Reflect.apply(pi.on.bind(pi), undefined, ["working_session_save", handler])` for a fork-only event; official `pi.on()` stores the handler and never fires it

Give official Pi a complete path for the same capability, such as running the tool in the foreground. Reach fork-only exports through the loaded module object, because official types reject a named import of them (`TS2305`).

## Shared contracts

Both distributions implement these at their floors. Source paths without a package prefix are under `packages/coding-agent/`.

### Tool schemas and arguments

- **Pi validates tool arguments with `@earendil-works/pi-schema`**, whatever built the schema. Check `Type.Refine()` constraints in `execute()`. `Type.BigInt()` converts numeric strings and numbers to bigint, and `Type.Undefined()` converts `null` to `undefined`; `Type.Void()` rejects every JSON argument. Keep portable tool inputs JSON-compatible. Codecs pass the encoded JSON value. Pi checks the standard formats plus `url` and `json-pointer-uri-fragment`; `Format.Set()` formats stay unchecked. Property names match literally, not as regular expressions, and `additionalProperties` applies only to undeclared properties. An unresolved `$ref` rejects only arguments at its place. Source: `packages/schema/src/{coerce,compiler,explain}.ts`.
- **Documentation mismatch:** both hosts' `docs/extensions.md` still say that `Type.BigInt()` and `Type.Undefined()` reject every argument. The source and the changelog are right.
- Coercion covers every tool schema, including plain JSON Schema and MCP tools: numeric strings become numbers, `"true"` becomes `true`, a single value becomes a one-item array, and `null` in an optional property is dropped. The model reads pi-schema messages such as `- path: missing` or `- limit: expected number, got string`, and tests match that text.
- **Import `Type`, `Static` and `TSchema` from `typebox`.** The published `@earendil-works/pi-ai` types export no TypeBox (`TS2305` on those names). At run time Pi resolves `@earendil-works/pi-ai` and `/compat` to its extension view (the compat entry plus TypeBox `Type`, `Static`, and `TSchema`), so existing imports load. New code imports from `typebox`.
- `ToolDefinition`, `defineTool()` and `pi.registerTool()` are TypeBox-typed (`TParams extends TSchema`), so extension tools use TypeBox schemas. pi-schema builders such as `obj()` compile there with `unknown` params, and `@earendil-works/pi-schema` is the extension's own dependency, not a host-provided import. pi-ai `Tool` and agent-core `AgentTool` accept any JSON Schema object (`TParameters extends object`); agent-core infers TypeBox's common kinds and gives `unknown` for Enum, Tuple and Intersect.
- **`StringEnum` has two typings.** Inside Pi it returns a TypeBox `TUnsafe<T>`. The published pi-ai types return a pi-schema `Schema<T>`, which makes the property `unknown` inside `Type.Object`. Type-check against the module that extensions get at run time, as upstream's `examples/tsconfig.json` does: map `"@earendil-works/pi-ai"` in `compilerOptions.paths` to `./node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/pi-ai-extension-view.d.ts`, with `pi-coding-agent` as a development dependency.
- Tool search and codemode summaries follow local `$ref`s into `$defs` without looping on recursion. `pi-codemode` exports `resolveSchemaRef`. A `$ref` with a malformed percent escape renders its parameter as `unknown` instead of breaking every script. Source: `packages/codemode/src/declarations.ts`, `src/extensions/{tool-search,codemode}/tool.ts`.

### Native tools

- `ReadOperations.createReadStream` is optional and supplies an async iterable, so a custom backend can stream a file instead of loading it whole.
- Grep takes context lines from ripgrep and never calls `GrepOperations.readFile`. The field remains optional and deprecated, so existing integrations compile. To search a remote system, override grep's `execute()`. Grep globs are relative to `path`. Source: `src/core/tools/{read,grep}.ts`.
- `pi.exec(command, args, { maxBuffer })` caps stdout plus stderr and returns `truncated`. The default cap is the smaller of 256 MiB and the runtime string limit. A command that ignores SIGTERM after a timeout or abort gets SIGKILL 5 seconds later.
- `pi.setActiveTools()` keeps the order of tools that stay active and appends new ones.

### Rendering and custom UI

- Renderers receive `keyText()` and `keyHint()` on `ToolRenderContext`, `MessageRenderOptions` and `EntryRenderOptions` (`KeybindingHints`). Use the injected functions: they read the user's keybindings, while an imported helper can resolve the extension's own `pi-coding-agent` copy and render hints without keys. Persisted-entry `messageId` and ISO `timestamp` arrive only on `MarkdownTransformContext` and are undefined while the message is live.
- `ctx.ui.custom(factory, { blocked: { kind, message } })`, with `kind` `"question"`, `"permission"` or `"auth"`, reports Pi as waiting for user input. Inline UI reports it while visible. An overlay reports it from when it is shown until it calls `done()`, also while hidden with `setHidden()`. Closing one overlay keeps other open questions blocked.
- `/reload` and session replacement remove and dispose every overlay that an extension owns, including hidden ones. Source: `src/modes/interactive/interactive-mode.ts`.
- `pi.registerMarkdownTransformer(transformer, { messageTypes })` selects the Markdown surfaces a transformer runs on. Without options it runs on user, assistant and thinking Markdown. `messageTypes` replaces that set and can add `custom`, `summary`, and `changelog`. Each extension has one registration; a later one replaces it. Source: `src/core/extensions/{types,loader,runner}.ts`.
- pi-tui provides `replaceControlCharacters()`, `Component.capturesViewportInput` and `getSelectPageIndex()`. `Markdown` reuses rendered blocks until `invalidate()`, which a theme change must call. `Text.setText()` with unchanged text keeps its wrapped lines.

### Packages, trust, and the CLI

- A package that loads an extension can show its changelog on the next fresh launch after an update. Pi reads `pi.changelogPath` in `package.json`, else the root `CHANGELOG.md`, and shows entries newer than the last seen `package.json` version. `collapseChangelog` condenses them. A Git package shows entries when its version increases.
- Startup continues past a configured package that fails to install: Pi skips it, reports an extension warning, and retries on the next start or `/reload`. Explicit install and update commands exit nonzero. `pi -e npm:<pkg>` and `-e git:<repo>@<branch>` refresh on each start and `/reload`.
- `pi update --extensions` lists each package's npm version or Git commit change, and `PackageManager.update()` reports each changed package as a `result` progress event.
- A saved trust decision takes precedence over auto-trust, so `ctx.isProjectTrusted()` returns `false` after "Do not trust" even in a folder without trust-requiring resources.
- `pi auth login <provider>` and `pi auth logout <provider>` work without a session. Source: `docs/cli.md`.
- Prompt-template arguments open a quote only at the start of an argument. An apostrophe inside a word and an unmatched quote stay literal, and a backslash before the matching quote inside a quoted argument keeps that quote. Source: `src/core/prompt-templates.ts`.

### Reload, navigation, and shutdown

- `AgentSession.reload()` throws while a response is streaming or compaction is running. Print and RPC `ctx.reload()` call it directly, so wait for idle first.
- Programmatic `navigateTree()` throws while a response is streaming, a prompt is in preflight (input hooks or authentication), compaction is running, or another navigation is in progress.
- In RPC mode, `ctx.shutdown()` from an idle session shuts down at once. A shutdown that a command requests waits until that command's response is written. After shutdown starts, a stdin EOF or a single signal does not interrupt cleanup; a second signal exits immediately. Shutdown also waits for a started OAuth token refresh to be saved. Source: `src/modes/rpc/rpc-mode.ts`.

### Providers

- Provider streams use `ToolCallArgumentsStream`, keep stream state off content blocks, and report `totalFromProvider` and `responseModel`. See `provider-model-guide.md`.
- Anthropic requests use message threads: with a `sessionId` and caching enabled, each request sends only the new messages, and Pi falls back to the full request when earlier context changed. `StreamOptions.disableContinuation` keeps a repeated request, such as cache warming, out of that state. `before_provider_request` sees the full payload even when the transport sends only a continuation. Source: `packages/ai/src/api/anthropic-messages.ts`, `packages/ai/src/types.ts`.
- OpenAI-compatible `compat` has `requiresNonNullAssistantContent`, `requiresToolsWithToolHistory`, and `promptCacheKeyMode`. A request with no current tools omits `tools`, even when the history has tool calls. Source: `packages/ai/src/providers/compat-schema.ts`.
- Cancellation during lazy provider loading or authentication ends the stream with `stopReason: "aborted"`, not `"error"`. Source: `packages/ai/src/api/lazy.ts`.
- `Provider.refreshModelsAuth: "configured"` marks a catalog that needs no provider credential: the refresh still skips unconfigured providers, never refreshes OAuth first, and gets `context.credential` undefined.

These are source-contract checks, not claims of live provider qualification.

### Missing session working directory

On both hosts, interactive mode offers **Continue**, **Fork**, or **Cancel** when a saved session's directory no longer exists. This applies at startup (`--session`, `--resume`), to `/resume`, to `/import`, and to `ctx.switchSession()`. Source: `src/core/session-cwd.ts`, `src/core/agent-session-runtime.ts`, `src/modes/interactive/interactive-mode.ts`.

What an extension that calls `ctx.switchSession(path, { withSession })` observes on both hosts:

1. `session_before_switch` fires for the requested file before Pi checks the directory. The check fails before teardown, so the current session stays live while the prompt is open.
2. **Continue** retries the switch with the current working directory as a one-time override. `session_before_switch` fires again for the same file, and `withSession` receives the requested session. Pi does not store the choice.
3. **Fork** copies the session into the current session directory with a new ID, the current working directory, and the original as `parentSession`. `session_before_switch` fires again and names the copy, `withSession` receives the copy, and `session_start` has reason `resume`. If an extension cancels that second event, Pi deletes the copy and returns `{ cancelled: true }`.
4. **Cancel** returns `{ cancelled: true }` and leaves the current session open.
5. Print and RPC modes do not prompt on either host. The promise rejects with an error whose `name` is `MissingSessionCwdError`; the class is not a root export.

Do not assume that the session `withSession` receives has the path you requested.

## Portable session and lifecycle contracts

- Use `DefaultResourceLoader`, `createAgentSession`, `SessionManager`, `ModelRuntime`/`ModelRegistry`, and `AgentSessionRuntime` for ordinary extensions and hosts. `CreateAgentSessionOptions.tools` is a **name array**; definitions belong in `customTools`. A supplied resource loader must be reloaded by its owner. SDK sessions do not automatically load CLI builtins; add their factories and call `session.bindExtensions()` when needed.
- `SessionManager` owns finalized provider context. SDK owners append or navigate through it and then call `session.refreshContext()`, or create a session with a populated manager. Assigning `session.agent.state.messages` is not a supported context rewrite. Extensions get a read-only manager: use public message and append APIs or boundary drafts, not private casts.
- `message_end` is dispatched **before** the message is appended. Use its authoritative message value for message-local work; do not assume that the message is already in `getBranch()`. `turn_end` resolves persisted assistant and tool-result IDs, composes drafts across handlers, then commits **after** handlers finish. Preserve earlier proposals with `{ entries: [...event.entries, draft] }`.
- `custom` drafts persist non-model state. `custom_message` adds model content. `context_edit` changes or omits active-branch content without erasing raw history, usage or UI. `compaction` with `firstKeptEntryId: null` retains none of the preceding conversation while carrying current system and tool state. Do not request unconditional continuation: the preview must contain runnable context or queued input.
- `agent_end` finishes one low-level loop, not retries, compaction recovery or queued continuations. `agent_before_settle` is the final actionable boundary. `agent_settled` is notification-only and defers newly scheduled work until handlers finish. Use `AgentSession.waitForIdle()` or the command context's idle wait for final local completion, never low-level `session.agent.waitForIdle()`. Extension-owned detached jobs still have their own completion contract. Do not await a run's idle from a handler that the run is waiting for.
- `context` receives conversation without system messages; the host restores prompt and tools. `context_with_system` owns the full output: preserve the leading system declaration at index zero and later tool updates in their positions. Request-local transformations do not persist context edits. `before_agent_start.systemPromptOptions` is mutable and `systemPrompt` is readonly. Continuations do not rerun that hook, and forced prompts can replace system-only decoration.
- After a committed `newSession`, `fork`, or `switchSession`, old `pi` and `ctx` actions and getters are stale. Capture plain data first and do session-bound follow-up only with `withSession(freshCtx)`. After `await ctx.reload()`, return; reload has no fresh-context callback. Reload clears factory caches and reinitializes resources.
- Runtime replacement aborts and settles outgoing work, awaits `session_shutdown`, tears down host UI, and disposes before it creates the replacement. A factory failure does not restore the disposed old runtime. Rebind subscriptions through `runtime.setRebindSession`; synchronous host UI teardown uses `setBeforeSessionInvalidate`. Direct `session.dispose()` is synchronous invalidation, abort, and listener cleanup, not the awaited shutdown lifecycle of `runtime.dispose()`.
- A committed replacement and interactive `/tree` abort and persist active work; programmatic navigation rejects while active. Later unstarted sequential siblings can remain unmatched after an abort: wait for final idle if balanced history is required, and never fabricate tool results. Preserve legacy saved-session recovery when you remove obsolete runtime paths.

`pi-posthorse` is **portable on official Pi** through public retain-none compaction and lifecycle boundaries. Do not declare a blanket fork-only exception or require checkpoint APIs for ordinary rollover. Validate prompt and tool retention, queued input, errors, threshold and overflow, resume, and legacy journal recovery.

## Tools, concurrency and policy

- Tools run in parallel by default. Preflight is ordered, completion events follow finish order, and persisted results follow assistant source order. Key state by `toolCallId`. Any `executionMode: "sequential"` sibling serializes the whole batch, not only that resource.
- `withFileMutationQueue(path, fn)` covers the whole same-file read, modify, and write window and releases on failure. It is **process-local**, resolves existing realpaths but uses a lexical path for missing files, and is not a multi-file transaction or cross-process lock. Keep batch planning and rollback, symlink safety, and external ownership where required.
- `prepareArguments` precedes validation. Mutable `tool_call.input` follows it and is not revalidated, so preserve schema and trust invariants yourself. A blocked call's `terminate` suppresses follow-up only when all finalized sibling results terminate. Changing active tools does not revoke sibling references that are already preflighted.
- Tool-context `ctx.executeTool()` uses validation, hooks, permissions, child IDs, and `parentToolCallId`. Unknown, blocked, and throwing calls resolve `isError: true`; they do not reject. Nested-call records are bounded metadata, not durable raw results. Usage aggregates onto the parent, so do not count it twice. Raw tool execution bypasses this boundary. Late updates after settlement are ignored.
- Native exposure is a policy choice. Direct tools are callable while active. Model-only tools are never nested-callable. Codemode and deferred tools are callable whenever registered, even if inactive. Hidden tools are unreachable. `defaultActive: false` is not deferred exposure. Namespace, annotations, and `prepareLoadout` do not enforce permissions or instruction-before-effect gates.
- Preserve `isError`, meaningful content and top-level usage. An output schema promises successful `structuredContent`. Content replacement drops old structured content unless you supply it consistently; do not leak stale machine-readable secrets after redaction.
- A `defaultTools` reload enables newly added defaults without overriding explicit `tools` or `noTools`. Do not delete necessary resume restoration without exercising that SDK path. `sendUserMessage` expands commands, skills, and templates only with `expandPromptTemplates: true`. Context-only `sendMessage({ triggerTurn: false })` is not steering.

## Fork boundaries

Rules for an extension that must run on both hosts and can use a [fork-only capability](#fork-only-capabilities):

- Do not import or require a fork-only addition unconditionally. Detect it structurally and keep a complete official path.
- Neither host has instruction groups (`builtin:instruction-groups`, `pi:instruction-groups`, `discover_tools`) or `pi.refreshTools()`. Optional tools use native `exposure: "deferred"`; `runtime-authoring-guide.md` covers activating `tool_search` and warning when nothing reaches them. On resume, a tool that discovery hid before it was ever declared comes back like a newly registered tool.
- JSON selection belongs to the fork's core `createReadToolDefinition`, so native cwd wrappers inherit it.
- `compactView` is a global setting, default off. `MessageRenderOptions.compactView` is absent on official Pi, so treat it as `false`. Preserve the user's selection and do not invent other renderer properties from its name.
- Process restart is launcher and runtime machinery. Detached background commands are a builtin extension that uses public lifecycle APIs.
- `pi update --fork` is runtime delivery, not an extension update, and needs explicit cutover authority.
- Quit differs. Official `runtime.dispose()` awaits `session.abort()` before `session_shutdown`. A certified working-session exit on the fork also waits without a limit before running handlers. An ordinary fork quit aborts the turn and waits at most 500 ms while `session_shutdown` handlers run; last tool and agent events can arrive during or after those handlers. A tool that has not settled by that bound can leave a call without its saved result. Clean up owned work in the handler and tolerate those late events. Source: `src/core/agent-session-runtime.ts`.

## Published configuration schemas

Both distributions publish configuration schemas under the `pi-coding-agent` package root (repository prefix `packages/coding-agent/`):

| Document | Schema path |
| --- | --- |
| Themes | `schemas/theme.schema.json` |
| Keybindings | `schemas/keybindings.schema.json` |
| Models | `schemas/models.schema.json` |
| Settings | `schemas/settings.schema.json` |

Editor URLs are the schemas' `$id` values, `https://pi.dev/schemas/<name>.schema.json`; theme metadata does not point into `src/modes/interactive/theme/`. Pi does not fetch `$schema` URLs to load configuration. Use the host's shipped schema and native loader for acceptance. Compared with the official release's shipped schemas, the fork adds `compactView`, `toolExposure` and `lastChangelogForkCommit`<!-- fork-only --> in settings and `modelOverrides.hidden` in models. `lastChangelogForkCommit` is Pi's own record of the fork changelog it showed, not extension-owned state.

- Themes reject extra top-level fields and unknown `colors` or `export` keys. Put reusable custom colors in `vars`, use documented export backgrounds, and resolve missing or circular variable references through the native loader. Names cannot contain `/`; `system` is reserved. Optional scrollbar, search, and `thinkingMax` tokens keep native fallbacks; do not duplicate a token inventory or add needless colors.
- Key values use the native `KeyId` spelling and case, including `pageUp` and `pageDown`, with lowercase `ctrl`, `shift`, `alt`, `super` modifiers, no duplicates, and valid base keys. Examples: `ctrl+shift+x`, `alt++`; not `Ctrl+X`, `option+x`, or `ctrl+ctrl+x`. Extension-owned action names remain allowed; schema validation is not a global action-name allowlist.
- `models.json` definitions and overrides require a supplied `contextWindow` and `maxTokens` to be positive numbers. Zero is not "unlimited"; omit optional values or supply verified positive limits.
- Validation enforces positive integer image dimensions and byte and count limits, JPEG quality of 1–100, and positive supplied prompt-cache lifetimes.
- Settings allow extension-owned keys. Do not make Pi's schemas a strict validator for unrelated extension configuration. When you adapt a fork settings schema, retain `compactView: boolean | "hybrid"` and the existing resource filters.

## SDK, JSON and RPC traps

- Inspect exported interfaces over stale SDK prose. There is no `continueSession` option. `SettingsManager.create(cwd, agentDir?, options?)` is positional. `SessionManager.list(cwd)` selects a project, `listAll()` selects all normal projects, and its optional string is a custom session directory. Resources use `sourceInfo`, not obsolete `source` or location fields.
- JSON output starts with a `type: "session"` header. Header and entry timestamps are ISO strings; message timestamps are milliseconds. Compaction uses `firstKeptEntryId`. Wire `message_update` is delta-only, unlike in-process events. Accumulate by content index until the authoritative `message_end`; cumulative usage can be zero until completion.
- Parse incremental UTF-8, split only on LF, accept a trailing CR, and flush at EOF. Node readline also splits on Unicode separators that are valid inside JSON strings. Do not pass all stdout through as a successful assistant answer; inspect the final assistant's stop reason, the process result, and cancellation.
- RPC input receipts distinguish **started**, **queued**, and **handled**. Handled means no new run; queued is not completion. Install listeners before the prompt, inspect the disposition, and clean up listeners on every path. Official `RpcClient.waitForIdle` and `collectEvents` await a **future** settled event. `promptAndWait` installs first but ignores a handled disposition and can time out on a handled command.
- `get_available_thinking_levels` returns `{ data: { levels } }`; the client unwraps it. Query again after model changes. `get_commands` uses `sourceInfo`. Direct RPC bash honors `user_bash`, emits correlated `bash_execution_update`, and accepts raw `excludeFromContext: true`; the bundled client bash helper does not expose that option.
- Native bash injects session, model, and reasoning variables unless `exposeSessionEnvironment: false`; user-entered `!` and `!!` commands never get them. For tests, use an explicit physical Node and `env -i` with an isolated HOME and agent directory, not inherited `PI_*` state or mise/asdf shims that fail under a private HOME.

## Models, classifiers, codemode, and providers

- The ordinary `pi-ai` ESM root has types, `StringEnum`, streams and utilities, and `createModels`/`createProvider`. It has no global `getModel` or `stream` dispatch. Use the extension's `ctx.modelRegistry` or a standalone `ModelRuntime`; an isolated `createModels()` does not load every provider and config automatically. `ModelRegistry` is supported; it has no `completeSimple`, so use `streamSimple(...).result()`.
- Pi's loader maps root `pi-ai` and `/compat` to its extension view (the `/compat` superset plus TypeBox `Type`, `Static`, `TSchema`, and a TypeBox `StringEnum`), which can mask invalid root imports. Validate real ESM and types **and** bundled extension loading. Npm `/api/*` exports do not prove Jiti subpath resolution. Where the host alias misresolves a needed factory, use one explicit supported `/compat` factory, not a custom resolver or a root-global routing architecture.
- Runtime dispatch resolves request auth, base URL, headers, and environment. Header-only, OAuth and ambient auth can have no API-key string: do not require, extract, or echo a key before registry calls. Scope is a selection snapshot, not authorization; an empty `ctx.scopedModels` is unrestricted. Preserve explicit evaluation selection and effort, and paid-call authority.
- Classify a setup failure by its `stopReason`: `"aborted"` when the request signal was aborted, otherwise `"error"`. Provider hooks report failures but dispatch continues, so they are not fail-closed security gates. Auxiliary registry calls do not automatically become session usage: return usage on the outer tool result.
- Preserve `ModelsRequestTransforms` and `ProviderHeaders` null deletion markers. Refresh returns `ModelsRefreshResult`; inspect `aborted` and errors. Auth mutations establish local consistency, not a remote refresh. Propagate OAuth refresh signals; never log credentials.
- `createProvider({ fetchModels })` owns publication. Handwritten refresh reads the immutable `context.stored` and publishes through generation-checked `context.publish({ persist, update })`. A persistence failure prevents the paired mutation. Legacy model lists replace catalogs; native providers still receive `models.json` overlays. Streams receive `TranscriptContext`: use the current system and tool helpers, emit exactly one terminal event, and preserve usage, partial-call validity, and abort.
- Standalone owners call `cleanupSessionResources(sessionId)` when a session ends. It releases per-session provider state such as Anthropic message threads and the strict-tool fallback that Anthropic and Bedrock keep after Claude rejects `strict: "prefer"` tools.
- Built-in catalogs include `google` (`gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash` through `GEMINI_API_KEY`) and `minimax-cn`. Always inspect the active host's generated catalog for newer models and providers.
- In codemode, `models.classify(model, { state, questions, images })` accepts optional `images` (`ImageContent[]` with `{ type: "image", data, mimeType }`) for classifiers with `"image"` in `model.input`. `cloudflare-workers-ai` classifiers include `@cf/cloudflare/clef` (65,536 context), `@cf/cloudflare/clef-omni` (64,000 context; 65,536 as OpenRouter `cloudflare/clef-omni`), and `@cf/cloudflare/clef-flash` (24,576 context), all with `["text", "image"]` input. `github-copilot` has the text-only `microsoft-decision-1` (32,768 context).
- Codemode bounds worker threads across all sessions in the process with `PI_CODEMODE_MAX_WORKERS` (default `2`). Missing-member reads on `tools` throw, so use `"name" in tools`, not `typeof tools.name`.

## TUI and `@earendil-works/pi-agent-core`

Use the supplied host TUI, never a second terminal or render loop. **Fullscreen is the default.** Also test regular mode, narrow and wide terminals, CJK text, resizing, focus, keyboard and mouse input, cancellation, `done`, and disposal. `ctx.hasUI` includes RPC; custom components require `ctx.mode === "tui"`. Use `tui.queryTerminalColors()` (`TerminalColors`, `TerminalColorScheme`, `parseTerminalColorSchemeReport`), not the removed standalone color-scheme and background query helpers. Extend `CustomEditor` and forward unhandled keys to `super.handleInput`; use configured keybindings. Close custom UI through `done`; do not hide a handle and abandon its promise.

The public cursor APIs in `@earendil-works/pi-tui` are `renderFakeCursor(text)` and `CURSOR_MARKER`, along with `compositeTuiLine` and `stripTerminalSequences`. Place `CURSOR_MARKER` immediately before a cursor cell wrapped with `renderFakeCursor(text)`, and emit the position marker only when focused. With the hardware cursor off, the TUI resolves fake-cursor markers to reverse video. With it on, the focused marked fake cursor loses reverse video while its text remains, and unfocused fake cursors stay visible. Prefer native `Input` or `CustomEditor` so that the host owns cursor behavior.

`@earendil-works/pi-agent-core` exports only `Agent`, `agentLoop`/`agentLoopContinue`, `streamProxy`, the host hook `setDefaultStreamFn`, and agent types. **Ordinary extensions use the `pi-coding-agent` SDK, `SessionManager`, and runtime, or stdio RPC.** Only an explicitly durable requirement warrants `@earendil-works/pi-durable` and its separate storage contract.

## Source map

Repository paths behind this reference. Read them at the selected revision.

- `packages/coding-agent/{CHANGELOG.md,schemas/*.schema.json,docs/{sdk,extensions,sessions,session-format,rpc,cli,tui,packages,codemode,mcp}.md,src/{index.ts,core/{sdk,agent-session,agent-session-runtime,session-manager,session-cwd,model-runtime,model-registry,key-id-schema,keybindings-schema,model-config,settings-schema,prompt-templates,package-manager}.ts,core/extensions/{types,loader,runner,virtual-modules,pi-ai-extension-view}.ts,core/tools/{file-mutation-queue,read,grep}.ts,modes/interactive/{interactive-mode.ts,theme/{theme-schema,theme}.ts},modes/rpc/{rpc-client,rpc-mode,rpc-types}.ts},examples/tsconfig.json}`
- `packages/agent/{CHANGELOG.md,package.json,src/index.ts}`
- `packages/ai/{CHANGELOG.md,package.json,src/{index,compat,models,types}.ts,src/api/{lazy,anthropic-messages}.ts,src/providers/{model-schema,compat-schema}.ts,src/utils/{streaming-json,string-enum}.ts}`
- `packages/tui/{CHANGELOG.md,src/{index,tui,terminal,terminal-colors,components/editor,components/input,utils}.ts}`
- `packages/schema/src/{coerce,compiler,explain}.ts` and `packages/codemode/src/{declarations.ts,runtime/{execution,prelude-source}.ts}`
- Fork only: `FORK.md`, `packages/coding-agent/docs/{restart,working-session,background-command}.md`, `packages/coding-agent/src/extensions/{background-command,restart}/`, `packages/coding-agent/src/core/{working-session,background-work,runtime-record,tools/read-json}.ts`, and `packages/tui/src/{selection-source,selection-markers}.ts`. Also read `packages/coding-agent/src/extensions/{tool-search/tool,codemode/execute,codemode/tool}.ts` for fork look-ups and `core/tools/{read,missing-path,bash}.ts` for native-tool changes. Fork-only exports in shared files include `resolveModelReference` from `packages/coding-agent/src/index.ts`.
