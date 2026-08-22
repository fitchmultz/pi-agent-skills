---
name: pi-extension-development
description: "Pi extension/package runtime and bundled-resource install/discovery: tools, commands/events, providers, TUI, SDK/RPC, release/publish, debugging, and performance. Do not use for Pi core, Agent Skill content authoring, prompt-only work, Crabbox/cbx, platform matrices, dependency-contract research, or non-Pi publishing."
compatibility: Pi 0.84.0+; Python 3.9+ for the bundled resolver.
metadata:
  version: "1.12.2"
  last-verified-pi: "0.84.0"
---

# Pi Extension Development

## Goal

Build, update, debug, review, and package pi extensions against the active installed Pi contract without copying stale APIs or weakening requested power-user behavior.

## Trigger boundary

Use for Pi runtime code, package resources, custom providers, SDK/RPC hosts, extension TUI, lifecycle behavior, install/update flows, and extension-specific performance.

Route instead to:

- `agent-skill-engineering` for Agent Skill content (`SKILL.md`, evals, references, or scripts); Pi package install/discovery/runtime stays here even when the package ships skills;
- prompt-template docs for prompt expansion with no runtime code;
- `crabbox-platform-testing` for Crabbox/cbx setup or its local target matrix;
- `platform-validation` for multi-environment proof;
- `external-repo-integration` when deriving an external dependency contract is the primary task.

## Authority and safety

Pi extensions and packages are full-trust executable code. Review scripts, dependencies, network/file/process access, credentials, and secret logging. Preserve requested power-user capabilities such as tool overrides, remotes, sandboxes, persistent shells, dynamic tools/providers, subagents, and provider rewriting; make scope, provenance, cancellation, lifecycle, and non-interactive policy explicit.

Project trust is an input-loading gate, not a sandbox or per-tool permission system. Do not change trust/approval, credential/config handling, prompts, tool authority, resource loading, or user-visible behavior without understanding the existing policy.

Preparation is not release permission. When an approved task changes a remote repository, create the branch, commit, push, and open or update the pull request without another confirmation unless the user explicitly excluded one of those delivery actions. Run the repository's own defined deployment only when applicable user or repository instructions define a ship gate and that gate passes. If no ship gate is defined, do not infer one; report the deployment as `not reached: no ship gate defined`. A deployment that publishes or releases an external artifact still requires explicit authorization. Do not create tags or releases, make production-control changes outside the defined deployment, or read release credentials unless the user explicitly authorizes the action. Read `references/publishing/workflow.md` before release work.

## Resolve the current source of truth

Resolve the package root from the active `pi` command; do not assume npm, mise, asdf, Homebrew, Bun, or a remembered install path. Run the bundled read-only helper from the skill directory:

```bash
python3 scripts/resolve_pi.py --json
pi --version
```

Resolve the script path from this skill directory rather than the caller's cwd. The helper mirrors Pi's precedence: a set `PI_PACKAGE_DIR` must verify first, without requiring `pi` on PATH; otherwise it unwraps mise/asdf shims and resolves executable ancestry or standard npm launcher layouts. A `PI_PACKAGE_DIR` override bypasses launcher resolution, so `piExecutable` is `null`; verify the runnable `pi` separately. An explicit `--pi PATH` deliberately inspects that executable and ignores the override.

When install/runtime behavior matters, compare `type -a pi`, `pi --version`, `command -v node`, and `node --version` in clean shells inside and outside the target project. A mise/asdf-owned global npm Pi can shadow the stable install while both share `~/.pi/agent` unless `PI_CODING_AGENT_DIR` differs. Report duplicates first. Only with explicit authorization, uninstall the stale copy through its exact runtime prefix, such as `npm --prefix <runtime-prefix> uninstall -g @earendil-works/pi-coding-agent`; never use a plain global uninstall. Reshim/rehash and reverify from the project.

The active package's executable `dist/*.js`, emitted `.d.ts`, package exports, and observed CLI/runtime behavior are the contract. Official docs and examples are discovery aids and may be wrong. Read each selected Pi Markdown file completely and follow relevant cross-references, then verify every copied API, default, and lifecycle claim against the matching active implementation and types before coding. Minimum sources by surface:

- extensions/trust/runtime: `CHANGELOG.md`, `docs/extensions.md`, `docs/usage.md`, `docs/security.md`, `docs/settings.md`, `examples/extensions/README.md`, matching examples and generated types;
- TUI: `docs/tui.md`, `docs/keybindings.md`, matching examples, `dist/*` and bundled `@earendil-works/pi-tui` types;
- packages/install/release: `docs/packages.md` and package-manager/resource-loader source;
- skills/prompts: `docs/skills.md`, `docs/prompt-templates.md`;
- SDK/RPC/session: `docs/sdk.md`, `docs/rpc.md`, `examples/sdk/README.md`, matching examples/types/source; for pi-agent-core harness or remote sessions also read the released agent/client/protocol READMEs, root package exports, session/repository types, and matching implementations;
- providers/auth/models: `docs/providers.md`, `docs/custom-provider.md`, `docs/models.md`, `docs/llama-cpp.md` when applicable, matching examples/types/source.

For upgrades, read every crossed changelog entry. If docs, examples, generated `.d.ts`, CLI help, and implementation disagree, follow the active implementation and emitted types, confirm with a safe CLI/runtime probe when possible, and record the mismatch.

Pi 0.84.0 still ships some misleading docs/examples. Before copying tool, TUI, SDK/RPC, lifecycle, provider, session, or model snippets, read `references/current-version-hazards.md` and verify applicable claims against active source and emitted types.

## Available scripts

- `scripts/resolve_pi.py [--pi PATH] [--json]` resolves and verifies the active package root. It is read-only; its only subprocess is fixed-argument `mise which pi` or `asdf which pi` when the active path is that manager's shim.

## Choose the smallest correct mechanism

- **Skill**: reusable instructions only.
- **Prompt template**: user-invoked prompt expansion only.
- **Extension command**: explicit user action needing session/runtime/UI control.
- **Custom tool**: model-callable structured capability.
- **Event handler**: observation, policy, mutation, or lifecycle reaction.
- **Custom UI/TUI**: overlays, widgets, editors, renderers, or other interactive surfaces.
- **SDK/RPC runtime**: another process embeds or manages Pi sessions.
- **Package**: installable resources shared across projects or machines.

Use runtime code only when the outcome needs runtime behavior.

## Workflow

1. Define the user-visible outcome, runtime surface, authority, modes, state, and lifecycle boundaries.
2. Read the current installed implementation and emitted types, crossed changelog entries, full relevant docs, matching examples, and safe CLI/runtime probes.
3. Inspect the existing extension/package and its canonical tests, scripts, metadata, and install path.
4. Design startup/reload/new/resume/fork/tree/compact behavior, state reconstruction, cancellation, non-UI behavior, concurrency, and TUI interaction only where they apply.
5. Implement the smallest focused change against current APIs.
6. Type-check every TypeScript change with the repo script or `tsc --noEmit`. Use the repo lint/format script; otherwise use an already-installed `@biomejs/biome` via `npx --no-install @biomejs/biome check`. Do not fetch a formatter implicitly and do not invoke the unrelated `biome` package.
7. Load the extension/package through its intended path and exercise the changed command/tool/event/provider/UI/SDK/RPC flow. Use explicit `--approve` or `--no-approve` when project trust affects the result.
8. When factory-load work, dependencies, startup, or performance changed, run the startup A/B in `references/runtime-authoring-guide.md`; inspect steady-state timers, watchers, processes, memory, network, and prompt/tool tax too.
9. Update package metadata, docs, tests, and changelog when install, runtime contract, performance, or user-visible behavior changed.

## Runtime invariants

- During factory load, register handlers/tools/commands/shortcuts/flags/message and entry renderers/providers. Default-only `getFlag()` reads and `pi.exec()` are also available, but keep startup work minimal. Run session-bound actions from `session_start`, commands, tools, or events, and read CLI-provided flag values only after parsing.
- Treat reload, session replacement/import, cwd changes, and branch navigation as real boundaries. Rehydrate durable state from session entries/branch data and clean up timers, streams, subprocesses, listeners, overlays, and subscriptions. Pi 0.84 aborts and persists active work before committed session replacement or tree navigation, but it does not synthesize results for unstarted siblings in a sequential tool batch. If balanced tool-call history matters, wait for final idle before switching; do not race the transition with synthetic session writes.
- Use `agent_end` for one low-level run; use `agent_settled`, `AgentSession.waitForIdle()`, or `ExtensionCommandContext.waitForIdle()` for final-idle work after retries, compaction retry, and queued continuations. Never use low-level `session.agent.waitForIdle()` for settlement.
- Tools run in parallel by default. Queue the whole file read-modify-write window with `withFileMutationQueue()`. `executionMode: "sequential"` serializes the entire sibling-call batch in source order; use it only when sibling calls truly share one state machine.
- Pi 0.84 bundles TypeBox 1.3.7. Import from `typebox`; use supported APIs rather than old TypeBox compatibility shims.
- For cache-friendly lazy tools, register every tool up front, keep searchable tools inactive, and activate them additively from a loader tool. Removing or replacing tools uses the normal fallback; prompt metadata on newly active tools can still invalidate the stable system-prompt prefix.
- Guard terminal-only UI with `ctx.mode === "tui"`; use `ctx.hasUI` for TUI/RPC dialogs. Define print/JSON/RPC behavior instead of relying on interactive confirmation.
- Use `before_provider_headers` for outbound assembled headers, `before_provider_request` for serialized payload changes, and `after_provider_response` for response status/headers. `ModelRuntime` owns final auth/header assembly and applies the pi-ai `ModelsRequestTransforms` header transform before dispatch. `ProviderHeaders` values are `string | null`; preserve `null` deletion markers when forwarding. Never log resolved credentials or auth headers.
- Use legacy `pi.registerProvider(id, config)` for supported APIs with static/simple catalogs; use `pi.registerProvider(createProvider(...))` when the provider owns native auth, filtering, refresh/cache, or streaming. `createProvider({ fetchModels })` still returns fetched models and owns publication. Handwritten refresh code reads `context.stored` and commits persistence plus synchronous state through generation-checked `context.publish()`, never `context.store`. Native providers still receive `models.json` overlays; inspect field precedence for legacy config. Validate removal/reload for any conditional registration.
- When extension model UI or actions must honor `--models` or `enabledModels`, use the read-only `ctx.scopedModels` snapshot when non-empty. An empty array means the session is unscoped, so all available models remain eligible.
- Put nested-LLM `Usage` from tools, custom compaction, and branch summaries in the top-level `usage` field so persisted session totals include it; do not hide it in `details`.
- Gate tool `constrainedSampling` on model capability flags; prefer `json_schema`/`prefer`. Bash tools expose `PI_SESSION_ID`/`PI_SESSION_FILE`/`PI_PROVIDER`/`PI_MODEL`/`PI_REASONING_LEVEL`; direct RPC bash runs `user_bash` handlers before execution and streams `bash_execution_update`.
- JSON/RPC `message_update` is delta-only in Pi 0.84: accumulate `assistantMessageEvent` deltas between `message_start` and `message_end`, and replace local state with authoritative `message_end.message`. Internal SDK/extension `AgentSessionEvent` still carries its in-process cumulative message.
- `ModelRegistry.refresh(options)` returns `ModelsRefreshResult`; inspect `aborted` and provider `errors`. `setRuntimeApiKey(providerId, key, { signal })` accepts auth cancellation only; call `refresh({ providers: [providerId], signal })` separately when remote catalog freshness is required. Config-form OAuth `refreshToken(credentials, signal)` must honor the concrete signal.
- New pi-agent-core harness work imports v2 `AgentHarness` and the v4 lane-based `Session`, `SessionStorage`, `SessionRepo`, `JsonlSessionRepo`, and `InMemorySessionRepo` from the package root. `AgentHarness` is currently a compile-complete scaffold with many operation paths rejecting `HarnessNotImplemented`; verify the exact path before adoption. Custom `FileSystem` implementations provide atomic same-filesystem replacement through `renameFile()`. Do not import removed experimental or legacy repository subpaths.
- `RemoteSession.sessions` contains durable `SessionMetadata`; inspect an acquired `SessionSnapshot` for runtime phase, model, thinking, attachment, and lock state.
- RPC clients should query `get_available_thinking_levels` after model changes rather than hard-code a global level set.
- Pair `pi.appendEntry()` with `pi.registerEntryRenderer()` for durable display-only transcript state excluded from model context. Use custom messages when content should enter model context. Message renderers receive `outputPad`; apply it to horizontal spacing, while entry renderers receive only `expanded`.
- Visually inspect changed TUI behavior; code review alone is not proof.

## Reference loading

Read only when applicable:

- `references/current-version-hazards.md` — Pi 0.84.0 migrations and stale docs/examples before copying affected snippets.
- `references/runtime-authoring-guide.md` — runtime authority, trust, load order, lifecycle, events, packages, RPC, performance, and validation.
- `references/tui-authoring-guide.md` — terminal UI, overlays, widgets, editors, shortcuts, autocomplete, renderers, and mode fallbacks.
- `references/provider-model-guide.md` — providers, auth, model catalogs/compatibility, ModelRuntime, or SDK model/auth migration.
- `references/lifecycle-checklist.md` — state, reload, fork/resume/tree, compaction, final-idle, or runtime replacement.
- `references/tool-design-checklist.md` — custom tools or built-in overrides.
- `references/idea-evaluation-checklist.md` — deciding whether a new extension should exist.
- `references/linux-docker-validation.md` — requested Linux/Docker validation.
- `references/publishing/workflow.md` — package preparation, release, publish, and install/update verification.

## Output contract

```md
Abstraction: [skill/template/command/tool/event/UI/SDK/RPC/package]
Current sources: [Pi version, exact docs/examples/types/help/source]
Implementation: [changed files]
Lifecycle/authority: [state, boundaries, modes, concurrency, trust]
TUI/UX: [guards, rendering, key/focus flow, visual evidence if applicable]
Validation: [type-check, tests/lint, runtime/package/manual checks, startup A/B if applicable]
Repository delivery: [branch, commit, push, pull request: complete / excluded / blocked / failed; deployment: run or verified / not defined / not reached / blocked / failed]
Explicit external actions: [none, or exact authorized tags/releases/publication/release credentials/production control outside the defined deployment]
Remaining gaps: [only real gaps]
```

## Stop rules

Stop only when the abstraction is correct, implementation matches the active installed contract, the real changed path is validated, each routine branch, commit, push, and pull-request action is complete, explicitly excluded, or truthfully reported blocked or failed with its recovery action, deployment is run or verified after its applicable gate or truthfully reported not defined, not reached, blocked, or failed, release and production-control actions outside the defined deployment stayed within explicit authorization, and no unverified lifecycle/install/TUI assumption could change correctness.
