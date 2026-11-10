# Maintaining the skills

This repository owns the bundled skill instructions, references, scripts, and assets. Keep updates focused on the workflow a skill teaches; do not turn skills into another layer of global agent policy.

## Current guidance

Skill guidance follows these sources:

- [OpenAI's latest-model guide](https://developers.openai.com/api/docs/guides/latest-model), currently covering GPT-6 Astra, Sol, and Luna: infer routine intent, finish authorized work, ask only consequential questions, make instruction conflicts explicit, delegate useful independent work, and calibrate verification to the change.
- [Agent Skills authoring practices](https://agentskills.io/skill-creation/best-practices) and [specification](https://agentskills.io/specification): precise routing descriptions, concise task-specific instructions, progressive disclosure, and scripts for fragile repeatable operations.
- The skill documentation that ships with the target Pi release ([`docs/skills.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)) and the [`fitchmultz/pi` fork](https://github.com/fitchmultz/pi). The [version hazards reference](../skills/pi-development/references/current-version-hazards.md) owns the exact source identities and the differences between the two distributions.

These sources move, and a “latest” URL does not stay unchanged. Recheck the relevant primary source at each refresh. Historical release notes, migration scenarios, and evaluation reports retain the versions they actually describe.

The house conventions of `pi-development` (`references/house-conventions-ux.md`, `references/house-conventions-tool-contract.md`, `references/house-conventions-delivery.md`) are the owner's rules for his own Pi packages and the fork. Their CI and release rules follow the shared automation repository [`fitchmultz/.github`](https://github.com/fitchmultz/.github) (`fleet.json`, `docs/integration.md`, `docs/qualification.md`, `docs/npm-releases.md`). A change to a convention is the owner's decision; a host fact in those files is checked like any other.

## Authoring rules

- Keep general-purpose skills model-independent. Model selection, effort, transport, and provider capabilities belong to the host and selected route; a vendor API feature is not automatically available through Pi.
- Treat skills as workflow guidance under current system, harness, and user instructions. A skill cannot grant external-write authority, impersonate approval, reopen a settled decision, or silently narrow the requested outcome. Preserve real authorization and safety boundaries.
- Explain concrete failure modes and useful defaults rather than adding generic checklists. Keep `SKILL.md` below 500 lines; link larger references with explicit conditions for reading them.
- Put selection criteria in the description. Preserve manual-only invocation where deliberate, and distinguish review, planning, and implementation requests.
- Inspect the active tool catalog and supported discovery before declaring an optional capability unavailable. Tool discovery does not make the underlying extensions native to Pi.
- Preserve bundled helpers and their contracts. Change executable behavior in its own focused PR rather than hiding it in an instruction refresh.

## Validation

Use Node 24 (at least 24.21.0) and install the development dependencies before running the checks:

```bash
npm ci --ignore-scripts
npm test
npm run smoke
npm run pack:check
```

The code-smell helper tests also require [uv](https://docs.astral.sh/uv/getting-started/installation/) and [PMD with Java](https://pmd.github.io/pmd/pmd_userdocs_installation.html). The collector installs its declared Python dependencies with uv; structure tests reuse or install their Node analyzer tools outside the source checkout. CI provisions uv and checksum-verifies the current official PMD distribution. These are real analyzer tests, not model calls. Full-Clef runner tests use a synthetic HTTP transport on hosts exposing that classifier; the minimum host without it verifies explicit capability failure instead.

`npm run check:compat` combines `npm test` and the pack check. `smoke` runs the native discovery test separately; it is also included in `npm test`.

The discovery check packs the real skills, verifies that every bundled helper, reference, and asset survives, and loads the skills through the selected Pi SDK and bundled CLI in an isolated profile. Offline evaluation tests also exercise native Pi sessions with a scripted model stream. These checks do not establish model-backed skill quality, and normal tests need no model credentials. CI installs D2 and librsvg for the diagram rendering tests.

Validate host-sensitive behavior against the minimum official Pi baseline, current official Pi, and the current fork, recording their exact identities. No live runtime activation is part of qualification.

### Minimum and current official hosts

`package.json` pins the minimum supported official Pi SDK (`@earendil-works/pi-coding-agent`) for local development. `.github/workflows/ci.yml` uses shared `resolve-hosts.yml` to freeze the current latest official release and fork `main` revision, then qualifies both through the same shared owner checks. Host-sensitive discovery and scripted-session tests receive the selected SDK through `PI_HOST_INDEX`; receipts record exact package roots/versions and the frozen fork ref. Keep the current-host install separate from the local minimum baseline.

The minimum supported floor is official Pi `1.5.1` and the `fitchmultz/pi` commit that [Targets and floors](../skills/pi-development/references/current-version-hazards.md#targets-and-floors) names. That section owns the exact commits and the Pi companion versions; other files point to it and do not repeat them. The code-smells analyzer floors are PMD `7.29+`, `lizard>=1.24.3`, and `pathspec>=1.1.1`. Agents never build for anything older than a floor. They always resolve and build against the latest official Pi release, the latest `fitchmultz/pi` `main`, and the latest dependency versions.

Guidance uses the public SDK, session, runtime, model, tool, schema (pi-schema tool validation, `typebox` imports), and TUI contracts that both hosts share, plus the fork's `ManagedHost`, working-session (`acquireWorkingSession`, `bindWorkingSessionHost`, `openWorkingSession`/`writeWorkingSession`, `working_session_save`), auth-fallback (`registerProviderAuthFallback`), background-execution (`builtin:background-command`, `ctx.runInBackground`), and root `resolveModelReference` contracts. Optional tools use native deferred exposure with `tool_search` on both hosts; instruction groups and `pi.refreshTools()` no longer exist. Inspecting a revision does not qualify a later merged artifact. Git/GitHub is the only release channel; no npm publication.

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
