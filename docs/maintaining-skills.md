# Maintaining the skills

This repository owns the bundled skill instructions, references, scripts, and assets. Keep updates focused on the workflow a skill teaches; do not turn skills into another layer of global agent policy.

## Current guidance

The October 1, 2026 Pi modernization uses:

- [OpenAI's latest-model guide](https://developers.openai.com/api/docs/guides/latest-model), currently covering GPT-6 Astra, Sol, and Luna: infer routine intent, finish authorized work, ask only consequential questions, make instruction conflicts explicit, delegate useful independent work, and calibrate verification to the change.
- [Agent Skills authoring practices](https://agentskills.io/skill-creation/best-practices) and [specification](https://agentskills.io/specification): precise routing descriptions, concise task-specific instructions, progressive disclosure, and scripts for fragile repeatable operations.
- Version-matched [official Pi skill documentation](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/skills.md) and the active [fitchmultz/pi fork](https://github.com/fitchmultz/pi). The [version hazards reference](../skills/pi-extension-development/references/current-version-hazards.md) owns exact inspected source identities and distribution differences.

These are dated source checks, not a promise that a moving “latest” URL will stay unchanged. Recheck the relevant primary source before the next refresh. Historical release notes, migration scenarios, and evaluation reports retain the versions they actually describe.

## Authoring rules

- Keep general-purpose skills model-independent. Model selection, effort, transport, and provider capabilities belong to the host and selected route; a vendor API feature is not automatically available through Pi.
- Treat skills as workflow guidance under current system, harness, and user instructions. A skill cannot grant external-write authority, impersonate approval, reopen a settled decision, or silently narrow the requested outcome. Preserve real authorization and safety boundaries.
- Explain concrete failure modes and useful defaults rather than adding generic checklists. Keep `SKILL.md` below 500 lines; link larger references with explicit conditions for reading them.
- Put selection criteria in the description. Preserve manual-only invocation where deliberate, and distinguish review, planning, and implementation requests.
- Inspect the active tool catalog and supported discovery before declaring an optional capability unavailable. Fork integration discovery does not make the underlying extensions native to official Pi.
- Preserve bundled helpers and their contracts. Change executable behavior in its own focused PR rather than hiding it in an instruction refresh.

## Validation

Run `npm test`, `npm run smoke`, and `npm run pack:check` before shipping. The discovery check packs the real bundle and verifies that all skills and supporting files survive installation. Validate host-sensitive behavior against the minimum official Pi baseline, current official Pi, and the current fork, recording their exact identities.

### Minimum and current official hosts

`package.json` pins the minimum supported official Pi SDK for local development and the full CI suite. The `official-current` job in `.github/workflows/ci.yml` owns the separate current-official pin, which Renovate updates. Both current-host jobs run the same native discovery and scripted-session tests through `PI_HOST_INDEX`; the current-official check also verifies the exact installed version. The current-host install never replaces the local minimum baseline.

The owner selected Pi 1.0.0 as the modernization floor. Local and current-official pins now use 1.0.0; no older-host compatibility shim is required. This supersedes the previous 0.87.1 tooling-footprint decision without claiming 1.0 fixes every upstream cost. Guidance uses public SDK/session/runtime contracts, removes experimental harness and old fork-runtime requirements, and preserves historical evaluation results and saved-data recovery. The minimal fork keeps only restart/background_command/discover_tools/Read JSON/compactView; candidate qualification is separate from its confirmed design. Git/GitHub is the only release channel; no npm publication.

Reproduce current-official CI locally without changing the repository's dependency tree:

```bash
host_dir=$(mktemp -d)
PI_CURRENT_VERSION=$(awk -F "'" '/PI_CURRENT_VERSION:/ { print $2; exit }' .github/workflows/ci.yml)
npm install --prefix "$host_dir" --ignore-scripts --no-audit --no-fund \
  "@earendil-works/pi-coding-agent@$PI_CURRENT_VERSION"
PI_HOST_INDEX="$host_dir/node_modules/@earendil-works/pi-coding-agent/dist/index.js" \
  PI_COMPAT_HOST=official-current PI_COMPAT_EXPECTED_VERSION="$PI_CURRENT_VERSION" \
  PI_OFFLINE=1 PI_TELEMETRY=0 \
  node --test test/discovery.test.mjs test/evaluation-runtime.test.mjs
rm -rf "$host_dir"
```

Use existing behavior and routing cases for changed instructions. Add a case only for a distinct failure that existing coverage cannot detect; avoid tests that merely repeat new prose. See [Skill evaluations](evaluations.md) for explicitly requested live-model comparisons and their limits.

Do not label offline fixture success as improved model quality. Preserve historical evaluation results and report separately whether a new live comparison ran. Once applicable checks pass, repeat or broaden them only for changed inputs, failures, unresolved concerns, or repository requirements.
