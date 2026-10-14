# Full Clef through Cloudflare AI Gateway

Use Pi's native classifier API, not a chat completion or a custom HTTP client.
The classifier provider is `cloudflare-workers-ai`; the exact model ID is
`@cf/cloudflare/clef`. Provider naming alone does not establish Gateway routing.

## Required route

Cloudflare supports Gateway routing on the Workers AI REST endpoint
`https://api.cloudflare.com/client/v4/accounts/{account}/ai/run` through the
**`cf-aig-gateway-id` request header**. The API hostname is therefore compatible
with Gateway use; a bare request without that header is not.

The Workers AI credential needs the account ID and Workers AI access. Use the
user's existing Gateway ID for that account. An authenticated
`cloudflare-ai-gateway` chat provider does not automatically route classifiers.

On Pi versions supporting provider headers, this is the relevant fragment of
the agent directory's `models.json` (`PI_CODING_AGENT_DIR`, otherwise
`~/.pi/agent`). It is setup guidance, not permission to change configuration
during a read-only scan:

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

Merge only the header into existing configuration when setup is authorized;
preserve other providers, headers, and credentials. Provider-level headers affect
all models on that provider. Environment interpolation is also possible when the
Gateway ID is available in that provider's credential environment or process
environment; another provider's credential environment is not inherited.
Never print API keys, bearer headers, or the whole credential file.

Load changed configuration with `/reload` before using native classifiers.
Verify the effective Gateway header belongs to the current session's loaded
configuration. Do not assume a file changed after session startup is active.
On the inspected Pi implementation, per-model `modelOverrides` apply to chat
models, not classifiers. Passing a fabricated `headers` or `baseUrl` field to
codemode's `models.classify` also does not override transport: it re-resolves the
model by provider and ID.

For a new setup, qualify routing with a small synthetic classification and a
Gateway receipt: for example, `cf-aig-log-id` from an SDK `onResponse` observer
or the matching request in Gateway logs. Native codemode returns answers and
usage, not raw HTTP headers. A catalog entry or successful answer alone does
not prove the request traversed Gateway. Reuse still-valid setup verification
while its route/configuration is unchanged; report any unavailable log evidence
honestly.

## Native classification

After verifying the route, build `state` from the inspected candidate evidence
and `questions` from the smell rubric. A boolean question has `type: "bool"`,
`instructions`, and `criteria: { true: "...", false: "..." }`.

Run inside `codemode`:

```js
const model = (await models.getAvailableOfType("classifier", "cloudflare-workers-ai"))
  .find(candidate => candidate.id === "@cf/cloudflare/clef");
if (!model) throw new Error("Full Clef is unavailable; no substitute route or model.");
const result = await models.classify(model, { state, questions });
if (result.stopReason !== "stop") {
  throw new Error(result.errorMessage || result.stopReason);
}
return { model: result.model, answers: result.answers, usage: result.usage };
```

Boolean answers have `{ type: "bool", probability: number }`. Verify the expected
question IDs and answer types before applying the rubric's triage thresholds.
Use one state per candidate or duplicate pair. Independent calls can run
concurrently; Pi queues beyond four concurrent model calls per script.

Full Clef has a 65,536-token context. Keep source, context, and questions within
it, reading and selecting complete relevant evidence instead of relying on
service truncation. Provider errors resolve as non-`stop` results; an error or a
missing answer is an unassessed candidate, never a negative smell judgment.
If the required route or full model is unavailable, keep the local findings and
state that the Clef pass is blocked. Do not bypass Gateway or use Flash,
OpenRouter, or a chat-model fallback.

## Sources and qualification

- [Cloudflare Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
- [Workers AI Gateway integration](https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/)
- [Full Clef model](https://developers.cloudflare.com/workers-ai/models/clef/)
- [Gateway response log ID](https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback-api/#2-retrieve-the-cf-aig-log-id)
- Pi's installed `docs/codemode.md` and `docs/models.md` for the active host API.

The header route was live-verified on October 14, 2026 with Pi fork revision
`2c0c794053ee5e86ecd25d6c4d0979cf837756f7`: native full-Clef classification
returned a typed boolean answer and Gateway response headers including
`cf-aig-log-id`. This qualifies that setup, not every Pi version or credential.
