# Tool Design Checklist

Use when adding/changing custom tools or overriding built-in tools.

## Decision

- Command vs tool choice is intentional.
- The model should call this autonomously; otherwise use a command.
- Tool name is stable, clear, and prompt-friendly.
- Power-user capability is not weakened by default; scope, provenance, project-trust interaction, and mode behavior are explicit instead.

## Prompt contract and schema split

Design tools as a routed set, not isolated schemas. For each natural user intent, decide which active tool should win, which sibling tools overlap, and which fallback should not be used.

- Tool name: stable, natural, specific, and prompt-friendly.
- `description`: concise capability label — what the tool can do.
- `promptSnippet`: selection trigger — when the model should choose this tool, using natural user phrases rather than only the tool name.
- `promptGuidelines`: cross-tool routing and critical common/safety paths only; every bullet names the tool because Pi flattens guidelines.
- `parameters`: valid call shape only. Use fields, enums, required/optional, bounds, defaults, and mutual exclusions; keep field descriptions local.
- Docs/README: long workflows, examples, edge cases, command references, and troubleshooting.
- Skills/templates: repeatable user workflows that orchestrate tools.
- Tool result `content` and thrown errors: immediate model-facing recovery guidance when the model must act.
- Tool result `details`: structured evidence, renderer state, artifact verification, and exact next-action payloads.
- Tool result top-level `usage`: real pi-ai `Usage` for nested model work so persistence and full-session token/cost totals remain correct; never bury it in `details`.

## Schema and prompt metadata

- Parameters use strict TypeBox schemas.
- String enum fields use `StringEnum([...])` for Google-compatible schemas.
- Path fields document cwd/relative behavior and normalize leading `@` when applicable.
- Avoid aliases and optional-field soup unless compatibility requires them; use `prepareArguments()` for old stored-session compatibility instead of widening the public schema.
- Do not put routing rules, full workflows, examples, troubleshooting, or philosophy in parameter descriptions unless needed to prevent invalid calls.
- `description` is specific and short.
- `promptSnippet` is present when the tool should appear in Available tools.
- `promptGuidelines` explicitly name the tool in every bullet and stay small enough for always-on context.
- `defineTool()` is used for standalone definitions and SDK `customTools` arrays so TypeBox params stay inferred; inline `pi.registerTool({ ... })` already infers params.
- `constrainedSampling` is set only when provider-side strict schema or grammar is intended. Use `{ type: "json_schema", strict: "prefer" }` by default; use `"require"` only when unsupported models must fail; use `{ type: "grammar", variants: { openai_lark?: string, openai_regex?: string } }` only with `compat.supportsOpenAIGrammarTools`. Omit or set `false` to opt out.

## Factory/load timing

- During factory load, session-bound actions are avoided; registration APIs and registered default-only `getFlag()` reads are safe, while `pi.exec()` is reserved for essential startup work.
- Session-bound action methods run from `session_start`, commands, tools, or events.
- Dynamic `pi.registerTool()` after startup is intentional and does not require `/reload`.
- The `defaultTools` setting (0.84.2) changes the startup built-in tool selection globally or per project while preserving extension/SDK custom tools; validate conditional registration against a configured default set.

## Execution behavior

- `execute(toolCallId, params, signal, onUpdate, ctx)` signature matches current types.
- Long work observes `signal` and uses `onUpdate` when progress matters.
- Errors that should be model-visible failures are thrown, not returned as ad hoc flags.
- Result-level `terminate: true` is used only for final structured-output behavior when every finalized sibling in the batch may skip the follow-up LLM turn. Blocked `tool_call` handlers can also return `{ block: true, terminate: true }` (0.84.1); termination applies only to blocked calls, and the follow-up turn is skipped only when every finalized batch result terminates.
- Tools stay parallel by default. `tool_call` preflight is sequential, but sibling results are unavailable there; result events may interleave by completion while final tool-result messages use assistant source order.
- Shared non-file state has an explicit concurrency plan. `executionMode: "sequential"` is batch-wide: one sequential sibling makes Pi execute every call in that assistant response in source order.
- Independent resources use keyed queues instead of batch-wide serialization when possible.
- File mutations use `withFileMutationQueue()` on the resolved absolute path and queue the whole read-modify-write window.
- `tool_call` handlers use `isToolCallEventType()` for typed narrowing; `tool_result` handlers use built-in result guards such as `isBashToolResult()` instead of relying on direct `toolName` comparisons.

## Built-in wrappers and overrides

- Prefer `create*ToolDefinition()` for extension tool overrides.
- Prefer `create*Tool()` for SDK custom tools or when adapting an `AgentTool`.
- Bash overrides that use `createBashToolDefinition`/`createBashTool` inherit session env injection (`PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, `PI_REASONING_LEVEL`) unless `exposeSessionEnvironment: false` disables it or custom operations replace the env entirely; user-entered `!`/`!!` commands never receive these variables.
- Use built-in operation interfaces (`ReadOperations`, `BashOperations`, etc.) or `spawnHook` for remotes, sandboxes, and wrappers.
- Use `createLocalBashOperations()` instead of reimplementing local shell/process-tree behavior.
- Built-in result/details shape is preserved.
- Prompt metadata is re-declared; it is not inherited.
- Renderer inheritance choice is intentional and per slot.

## Output and rendering

- Model-facing `content` is concise and useful.
- Large output is truncated with `truncateHead`/`truncateTail` and `DEFAULT_MAX_BYTES`/`DEFAULT_MAX_LINES` unless tighter limits fit; the full output path/artifact is named.
- Immediate next-step guidance stays in visible `content`; stable state, UI/audit data, artifact verification, and exact action payloads live in `details`; nested provider accounting stays in top-level `usage` and is preserved by `tool_result` hooks.
- Custom renderers handle `isPartial`, `expanded`, and `context.isError`.
- Renderer state uses `context.state`; expensive components use `context.lastComponent` when useful.
- `context.invalidate()` is used for renderer-local async updates.
- Collapsed rendering is compact; expanded rendering gives recovery/detail.
- Custom shells (`renderShell: "self"`) handle their own framing, padding, backgrounds, and width limits.
- Rendered lines fit width via `truncateToWidth`/`visibleWidth`/`wrapTextWithAnsi` when needed.

## Mode and policy

- TUI-only flows check `ctx.mode === "tui"`.
- Dialog-capable flows check `ctx.hasUI`.
- If the only authorization path is an interactive confirmation, non-UI behavior is explicit.
- Project trust is treated as an input-loading gate, not a per-tool permission system or a reason to neuter requested tool power.
- Tools or global/CLI extensions that choose to respect project trust use `ctx.isProjectTrusted()` for the effective decision; intentional risk-on project config policies are documented and honor explicit opt-outs.
- Automation/power-user non-UI execution can be enabled by explicit config, CLI flag, allowlist, sandbox-only mode, or env opt-in; do not blanket-block when automation is the feature.
- Tool behavior is validated in the mode(s) where it can run.
