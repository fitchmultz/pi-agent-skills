# Provider and Model Guide

Use for provider registration, auth, dynamic catalogs, model metadata, or SDK model-runtime work. Read installed `docs/providers.md`, `docs/custom-provider.md`, `docs/models.md`, and current pi-ai/Pi types first; read `docs/llama-cpp.md` for local llama.cpp workflows.

## Choose the smallest provider mechanism

1. Use `models.json` for endpoint/model configuration that needs no runtime code.
2. Use legacy `pi.registerProvider(id, config)` for supported APIs, static/simple dynamic catalogs, or legacy OAuth/`streamSimple` integration.
3. Use `pi.registerProvider(createProvider(...))` when the provider owns native auth, credential filtering, catalog caching, or stream behavior.
4. Hand-build a complete `Provider` only when `createProvider` cannot express the needed refresh/store semantics.

`models.json` composes above native providers. With legacy config, extension fields can win while `modelOverrides` still apply last; inspect the active composer for precedence-sensitive fields. Never spread provider ownership across extensions unless the merge/replace order is intentional and tested.

## Pi 0.82 full provider extensions

- Import `createProvider`, auth helpers, and types from the pi-ai root. Root types do not export concrete API factories, despite the current native-provider docs; import factories such as `openAICompletionsApi` from `@earendil-works/pi-ai/compat`. Package-based Node installs may resolve `/api/*`, but the bundled extension loader does not expose those virtual subpaths reliably, so avoid them in portable extensions.
- A complete `Provider` owns `id`, `name`, auth, synchronous `getModels()`, optional `refreshModels`/`filterModels`, and both `stream` and `streamSimple`. Registering it discards any same-id legacy state and replaces any prior native provider; switching back deletes native ownership and starts a fresh legacy config. Only later legacy re-registrations merge defined fields.
- `createProvider({ models, fetchModels })` restores and persists the dynamic overlay through Pi's `ModelsStore`, preserves the prior list when fetching fails, and coalesces concurrent refreshes. A store-write failure rejects after the fetched catalog becomes visible, so validate and report fetch and persistence failures separately. The callback receives the canonical credential/store/network/force/signal context.
- Dynamic providers need a static or stored baseline: interactive and RPC modes restore cached catalogs and then refresh in the background; print mode, `--list-models`, and default SDK construction do not automatically perform network refresh. `/model` and the model picker call `modelRuntime.refresh()`, which reloads `models.json` before catalog refresh.
- Honor `allowNetwork` and `signal`; treat `force` as an explicit freshness request; only persist through the scoped store. Cache-only recovery may pass the optional `credential` as `undefined`.
- `filterModels(models, credential)` filters after auth is considered configured, but receives the raw runtime credential-store result, including a runtime API-key override when present. Do not assume ambient/env credentials are materialized in that argument.
- Pi 0.82.0 currently treats native provider-level `baseUrl` and `headers` as metadata/composition inputs, not reliable request defaults. Put `baseUrl`/static headers on each model or return headers from auth resolution, then inspect a real or stubbed request.
- Custom native streams must emit well-formed event sequences, produce exactly one terminal event, stop on abort, preserve provider/model metadata, accumulate text/thinking/tool-call deltas, and run option callbacks consistently. Prefer the bundled API factories over reimplementing a wire protocol.
- `/reload` re-registers present provider ids, but removing or renaming a conditional legacy or native registration does not prune the old live provider. Explicitly unregister it or rebuild the runtime when validating removal.

## Auth and model-runtime rules

- `ModelRuntime` is the canonical async model/auth facade. Create one runtime, pass it to `createAgentSession`, and inject a pi-ai `CredentialStore` such as `InMemoryCredentialStore` for isolated tests. Extension code still uses synchronous `ctx.modelRegistry`; await `modelRegistry.refresh()` before reads that depend on fresh dynamic catalogs.
- Pi 0.82.0 pi-ai root exports intentionally omit the removed singleton `getModel`/`getModels`/`getProviders`/`stream` API. New SDK code should use `createModels`/provider factories, and Pi extensions should prefer `ctx.modelRegistry` plus `pi.registerProvider`. Use `/compat` for old singleton migration and, until the export/loader mismatch is fixed, the concrete lazy API factories needed by full provider extensions.
- Never import removed pi-ai `/base` entrypoints. Type-check the actual package before trusting examples.
- The shell execution option type in current `@earendil-works/pi-agent-core` is `ShellExecOptions`; remove stale `ExecutionEnvExecOptions` imports.
- Preserve credential precedence deliberately: explicit per-request API-key override → runtime API-key override → stored credential → configured legacy/models.json key or command → inherited/native ambient resolver. A stored credential owns the provider, so failed/unsupported stored auth does not silently fall back to environment auth. Read stored credentials directly only for one-off inspection; request auth comes from `ModelRuntime.getAuth()` or provider-owned auth.
- `setRuntimeApiKey` and `removeRuntimeApiKey` are async. Handle their rejection and await them before assuming auth changed.
- `auth.json` provider entries may include provider-scoped `env`; Pi applies these for in-process provider resolution/streaming. Do not log or persist resolved values elsewhere.
- Env indirection is explicit: uppercase header/key values are literals unless prefixed with `$`; `${VAR}` and leading `!command` are supported where current config types/docs say so. `$$` and `$!` escape literal prefixes.
- `envApiKeyAuth` checks stored API-key credentials before environment variables. Build keyless/ambient auth only with an explicit resolver that reports configuration truthfully.
- OpenRouter and Kimi Coding support both API-key env auth and `/login` OAuth (`Sign in with OpenRouter` mints a user-controlled key; `Sign in with Kimi Code` uses device auth with refresh). Prefer login flows for interactive setup.
- In non-interactive mode, fail closed when auth is missing; never prompt or invent fallback credentials.

## Model metadata and compatibility

- Current built-in API literals are `openai-completions`, `mistral-conversations`, `openai-responses`, `azure-openai-responses`, `openai-codex-responses`, `anthropic-messages`, `bedrock-converse-stream`, `google-generative-ai`, `google-vertex`, and `pi-messages`. `Api` also permits custom strings; use exact current types and a real stream implementation.
- Treat `api`, `reasoning`, `input`, `compat`, `thinkingLevelMap`, `contextWindow`, `maxTokens`, `cost`, and optional `cost.tiers` as runtime behavior. Never guess them from model names.
- Thinking levels are `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`, but generated catalogs expose only provider-verified effort levels and each model still has only its mapped subset. Query `getSupportedThinkingLevels(model)` in SDK code or RPC `get_available_thinking_levels` after model changes.
- Direct Kimi K3 routes (`kimi-coding/k3`, `moonshotai/kimi-k3`, `moonshotai-cn/kimi-k3`) expose `low`, `high`, and `max`. Kimi Coding uses Anthropic compatibility including empty-signature replay; Moonshot uses OpenAI Completions with `thinkingFormat: "openai"`, `supportsReasoningEffort: true`, `deferredToolsMode: "kimi"`, and its own pricing.
- Qwen Token Plan registers `qwen-token-plan` and `qwen-token-plan-cn`, using `QWEN_TOKEN_PLAN_API_KEY` and `QWEN_TOKEN_PLAN_CN_API_KEY` respectively. Each has 15 static models in 0.82.0; both default to `qwen3.7-max`. The name does not imply `max` thinking support: that model exposes only `off` through `high`.
- Pi loads the bundled llama.cpp extension as a hidden built-in. `/login llama.cpp` stores the router URL and optional API key, `/llama` controls local model load/unload, model discovery is live and non-persistent, and the provider filter exposes only loaded models. Loaded models set both `contextWindow` and `maxTokens` from the server-reported context size. Use the current manager/UI path rather than adding a duplicate provider or shelling out during ordinary discovery.
- Each `cost.tiers` item must define `inputTokensAbove` and all four rates. Pi selects the highest strictly exceeded threshold from request-wide input plus cache read/write; ordinary cache writes use tier `cacheWrite`, while `cacheWrite1h` uses twice tier input.
- Current OpenAI-compatible thinking formats are `openai`, `openrouter`, `deepseek`, `together`, `zai`, `qwen`, `chat-template`, `qwen-chat-template`, `string-thinking`, and `ant-ling`. For configurable chat templates, use current `chatTemplateKwargs`; do not rewrite request payloads ad hoc.
- Current session affinity uses `sessionAffinityFormat`: `openai`, `openai-nosession`, or `openrouter`. It does not disable `prompt_cache_key`; do not restore removed `sendSessionIdHeader` flags.
- `OpenAICompletionsOptions.toolChoice` is a stream option, not model `compat`. Preserve its typed union: `"auto"`, `"none"`, `"required"`, or a named function object.
- Tool `constrainedSampling` is model-gated: `json_schema` + `strict: "prefer"|"require"` needs `compat.supportsStrictMode`/`supportsStrictTools` on the active path; OpenAI Lark/regex grammar needs `compat.supportsOpenAIGrammarTools`. Prefer falls back; require fails closed; grammar falls back when unsupported.
- Enable deferred tools only with endpoint proof: `supportsToolReferences` for Anthropic references, `supportsToolSearch` for OpenAI Responses search, or `deferredToolsMode: "kimi"` for compatible Kimi Chat Completions. Activate tools additively and validate immediate next-turn definitions.

## Validation and safety

- Validate registration with `--list-models`, auth configured/unconfigured states, thinking-level enumeration, and one real or stubbed stream for each custom request path.
- For dynamic catalogs, test cached/offline startup, successful refresh, fetch-failure retention, store-write failure visibility/reporting, abort, forced refresh, and the actual mode that should trigger network work.
- For llama.cpp, validate unloaded, loaded, server-down, abort/timeout, and reload states without publishing images or copying credentials into artifacts. Treat download and load/unload as explicit local mutations; do not perform them during read-only inspection.
- For remote model smokes, inject only the needed credential into the model-only process, avoid package/lifecycle scripts, use `-p` with `--no-session`, set a verified thinking level, and save separate non-secret artifacts.
