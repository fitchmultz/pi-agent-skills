# Maintaining the skills

This repository owns the bundled skill instructions, references, scripts, and assets. Keep updates focused on the workflow a skill teaches; do not turn skills into another layer of global agent policy.

## Current guidance

The September 26, 2026 refresh uses:

- [OpenAI's latest-model guide](https://developers.openai.com/api/docs/guides/latest-model), currently covering GPT-6 Astra, Sol, and Luna: infer routine intent, finish authorized work, ask only consequential questions, make instruction conflicts explicit, delegate useful independent work, and calibrate verification to the change.
- [Agent Skills authoring practices](https://agentskills.io/skill-creation/best-practices) and [specification](https://agentskills.io/specification): precise routing descriptions, concise task-specific instructions, progressive disclosure, and scripts for fragile repeatable operations.
- Version-matched [official Pi skill documentation](https://github.com/earendil-works/pi/blob/v0.87.1/packages/coding-agent/docs/skills.md) and the active [fitchmultz/pi fork](https://github.com/fitchmultz/pi). The [version hazards reference](../skills/pi-extension-development/references/current-version-hazards.md) owns exact inspected source identities and distribution differences.

These are dated source checks, not a promise that a moving “latest” URL will stay unchanged. Recheck the relevant primary source before the next refresh. Historical release notes, migration scenarios, and evaluation reports retain the versions they actually describe.

## Authoring rules

- Keep general-purpose skills model-independent. Model selection, effort, transport, and provider capabilities belong to the host and selected route; a vendor API feature is not automatically available through Pi.
- Treat skills as workflow guidance under current system, harness, and user instructions. A skill cannot grant external-write authority, impersonate approval, reopen a settled decision, or silently narrow the requested outcome. Preserve real authorization and safety boundaries.
- Explain concrete failure modes and useful defaults rather than adding generic checklists. Keep `SKILL.md` below 500 lines; link larger references with explicit conditions for reading them.
- Put selection criteria in the description. Preserve manual-only invocation where deliberate, and distinguish review, planning, and implementation requests.
- Inspect the active tool catalog and supported discovery before declaring an optional capability unavailable. Fork integration discovery does not make the underlying extensions native to official Pi.
- Preserve bundled helpers and their contracts. Change executable behavior in its own focused PR rather than hiding it in an instruction refresh.

## Validation

Run `npm test`, `npm run smoke`, and `npm run pack:check` before shipping. The discovery check packs the real bundle and verifies that all skills and supporting files survive installation. Validate host-sensitive behavior against both the pinned official Pi and the current fork, recording their exact identities.

Use existing behavior and routing cases for changed instructions. Add a case only for a distinct failure that existing coverage cannot detect; avoid tests that merely repeat new prose. See [Skill evaluations](evaluations.md) for explicitly requested live-model comparisons and their limits.

Do not label offline fixture success as improved model quality. Preserve historical evaluation results and report separately whether a new live comparison ran. Once applicable checks pass, repeat or broaden them only for changed inputs, failures, unresolved concerns, or repository requirements.
