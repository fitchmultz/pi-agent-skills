# Full Clef through Cloudflare AI Gateway

Use Pi's native classifier SDK through `scripts/classify.mjs`, not a chat
completion or a custom authentication/HTTP implementation. The classifier
provider is `cloudflare-workers-ai`; the exact model is `@cf/cloudflare/clef`.
Its provider name alone does not prove Gateway routing.

## Required route

Cloudflare supports Gateway routing on
`https://api.cloudflare.com/client/v4/accounts/{account}/ai/run` through the
**`cf-aig-gateway-id` request header**. The API hostname is compatible with
Gateway use; a bare request without that header is not.

The Workers AI credential needs the account ID and Workers AI access. Reuse the
existing Gateway ID for that account. An authenticated `cloudflare-ai-gateway`
chat provider does not automatically route classifiers. On hosts supporting
provider headers, the relevant agent-directory `models.json` fragment is:

```json
{
  "providers": {
    "cloudflare-workers-ai": {
      "headers": {
        "cf-aig-gateway-id": "<existing-gateway-id>"
      }
    }
  }
}
```

The directory is `PI_CODING_AGENT_DIR`, otherwise `~/.pi/agent`. This is setup
guidance, not authority to alter configuration during a read-only scan. When
setup is authorized, merge the header without replacing other providers,
headers, or credentials. It affects all models on that provider. Environment
interpolation needs the variable in that provider's credential/process
environment; another provider's credential environment is not inherited.
Never print keys, bearer headers, or the whole credential file.

The helper starts a fresh native SDK runtime, so it reads current configuration.
For ad-hoc codemode calls in an existing session, load changed configuration with
`/reload` first. Per-model `modelOverrides` are chat-only on the inspected host;
fabricated model-object headers/baseUrl also do not override codemode transport.

The runner verifies the effective header before inference, checks each actual
outgoing request's exact account endpoint, Gateway header, and model, and requires
`cf-aig-log-id` on a successful response. It uses a native in-memory credential
snapshot with normal key/template/command resolution, without writing credential
storage. A changed environment cannot redirect later jobs under the original
route fingerprint. It has no direct, Flash, chat-model, or OpenRouter fallback.
A catalog entry or successful answer without a Gateway receipt is insufficient. Native
codemode's answers do not expose raw response headers; use the helper or a
supported SDK observer when qualifying a route.

## Evidence size and actual service limits

Full Clef has a **65,536-token context**. Cloudflare also documents a **13 MiB
request-body ceiling**. These are actual provider limits, not skill-owned scan
budgets. They do not justify a maximum number of files, candidates, or calls.

The current [Clef schema](https://developers.cloudflare.com/workers-ai/models/clef/schema-input.json)
has no documented truncation-off switch or preflight token-count operation.
Cloudflare states that long text state is truncated to fit the context left by
questions. Usage reports tokens used, not original input length or a truncation
marker. A successful response does not establish complete evidence ingestion.
Do not invent a bytes-to-tokens safety cutoff or claim the runner prevents
service-side truncation.

Build jobs from complete logical evidence units. For large responsibilities,
review all functions/parts, ask focused questions about each, then reconcile the
cross-part behavior and relevant contracts in the parent model. Never keep only
file heads or silently drop later files, summaries, callers, or occurrences.
Retain the manifest and review coverage so every in-scope area is accounted for.
If necessary evidence cannot be evaluated reliably, name the unresolved question
instead of reporting a negative judgment or clean scope. The runner sends state
unchanged, records the lack of provider completeness attestation, and marks an
exhausted advertised context or provider rejection as an unassessed/error job.

## Interpreting answers

Use the rubric's explicit `supported`, `not_supported`, and
`insufficient_evidence` choices. Other native question types are available when
useful, but there is no confidence cutoff. The runner preserves typed answers
and probabilities without selecting findings. Missing answers, wrong types,
provider failures, and missing Gateway receipts cannot count as negative smell
judgments. Resolve their cause and resume; keep independently supported local
findings distinct.

Only the parent model has the full investigation context. Corroborate semantics,
write explanations from source, and rank findings there. A user-requested output
count never becomes a classifier-call budget.

## Sources and qualification

- [Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
- [Workers AI Gateway integration](https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/)
- [Full Clef model and limits](https://developers.cloudflare.com/workers-ai/models/clef/)
- [Gateway response log ID](https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback-api/#2-retrieve-the-cf-aig-log-id)
- Active Pi's `docs/codemode.md` and `docs/models.md` for native API details.

The header route was live-verified on October 14, 2026 with Pi fork revision
`2c0c794053ee5e86ecd25d6c4d0979cf837756f7`: native full-Clef calls returned typed
answers and Gateway response receipts. This qualifies that setup, not every
host version, source-evidence size, or credential.
