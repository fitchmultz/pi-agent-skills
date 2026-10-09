# Maintaining the skills

This repository owns the bundled skill instructions, references, scripts, and assets. Keep updates focused on the workflow a skill teaches; do not turn skills into another layer of global agent policy.

## Current guidance

The October 1, 2026 Pi modernization used:

- [OpenAI's latest-model guide](https://developers.openai.com/api/docs/guides/latest-model), currently covering GPT-6 Astra, Sol, and Luna: infer routine intent, finish authorized work, ask only consequential questions, make instruction conflicts explicit, delegate useful independent work, and calibrate verification to the change.
- [Agent Skills authoring practices](https://agentskills.io/skill-creation/best-practices) and [specification](https://agentskills.io/specification): precise routing descriptions, concise task-specific instructions, progressive disclosure, and scripts for fragile repeatable operations.
- Version-matched [official Pi skill documentation](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/skills.md) and the active [fitchmultz/pi fork](https://github.com/fitchmultz/pi). The [version hazards reference](../skills/pi-extension-development/references/current-version-hazards.md) owns exact inspected source identities and distribution differences.

These are dated source checks, not a promise that a moving “latest” URL will stay unchanged. Recheck the relevant primary source before the next refresh. Historical release notes, migration scenarios, and evaluation reports retain the versions they actually describe.

The October 9 guidance refresh uses the installed fork's c2031 revision-matched `FORK.md` and the exact released/unreleased source identities in the version hazards reference. It corrects the old five-feature candidate inventory and documents revision-specific schema/cursor contracts without rewriting historical qualification fields.

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

`package.json` pins the minimum supported official Pi SDK for local development. `.github/workflows/ci.yml` uses shared `resolve-hosts.yml` to freeze the current official release and fork revision, then qualifies both through the same shared owner checks. Host-sensitive discovery and scripted-session tests receive the selected SDK through `PI_HOST_INDEX`; receipts record exact package roots/versions and the frozen fork ref. Keep the current-host install separate from the local minimum baseline.

The 0.9.0 release established the owner-selected Pi 1.0.0 modernization floor, retained for local validation. This supersedes the previous 0.87.1 tooling-footprint decision without claiming 1.0 fixes every upstream cost. Guidance uses public SDK/session/runtime contracts, removes experimental harness and old fork-runtime requirements, and preserves historical evaluation results and saved-data recovery. The five-feature 1.0 fork candidate was a dated design snapshot; the installed 1.1.0 c2031 fork has the broader inventory in its `FORK.md`. Inspecting it does not qualify a later merged artifact. Git/GitHub is the only release channel; no npm publication.

Run the current-official host-sensitive checks locally without changing the repository's dependency tree. For an exact CI reproduction, select the tag from that run's frozen host receipt instead of querying the latest release:

```bash
host_dir=$(mktemp -d)
PI_CURRENT_TAG=$(gh release view --repo earendil-works/pi --json tagName --jq .tagName)
PI_CURRENT_VERSION="${PI_CURRENT_TAG#v}"
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
