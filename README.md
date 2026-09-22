# pi-agent-skills

Source-managed Pi package for Mitch's reusable agent workflows. Requires Pi 0.84.0 or later.

## Skills

- `ask-clarifying-questions`
- `bro`
- `deslop`
- `diagram-creation`
- `dogfood`
- `handoff`
- `pi-extension-development`
- `propose-then-ship-pi`
- `tdd`
- `thermo-nuclear-code-quality-review`
- `ux-review`
- `verification-before-completion`

## Install

```bash
pi install git:github.com/fitchmultz/pi-agent-skills
```

## Validate

```bash
npm ci --ignore-scripts
npm run check:compat
npm run smoke
```

Asset/discovery validation uses the exact Pi 0.87.0 development baseline. `check:compat` runs the existing content/helper tests and pack check; `smoke` is the native discovery test, also included in `npm test`. It packs the real skills, checks that every helper/reference survives, and loads all twelve skills through the selected Pi SDK in an isolated profile. Offline tests also exercise native evaluation sessions with a scripted model stream; they do not establish model-backed skill quality. The compatibility runner selects independent official/fork dependency graphs and verifies their resolved package identity.

The advertised Pi 0.84.0 floor is separate from the current validation baseline; the current matrix does not requalify that historical floor. Extension API guidance was checked against official Pi 0.87.0 and `fitchmultz/pi` revision `afed789`, including emitted types and implementation. Diagram rendering tests additionally need their existing external rendering prerequisites.

## Model evaluations

Run opt-in task and routing evaluations through the actual Pi SDK and configured model provider:

```bash
npm run eval:model -- --case clarify-and-continue
```

See [Skill evaluations](docs/evaluations.md) for both-host comparisons, repeated and held-out cases, caller profiles, the optional GitHub workflow, and fixture limitations. The [0.7.0 results](docs/evaluation-results.md) include exact outcomes, retained failures, source identities, and evidence. No model credentials are needed for the normal test suite.

This repository is private to npm publishing. Install it from git or a local checkout.
