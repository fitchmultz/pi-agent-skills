# pi-agent-skills

Source-managed Pi package for Mitch's reusable agent workflows. Requires Pi 0.87.1 or later and Node 24.21.0 or later.

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
- `test-audit`
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

Asset/discovery validation uses the exact Pi development baseline pinned in `package.json`. `check:compat` runs the existing content/helper tests and pack check; `smoke` is the native discovery test, also included in `npm test`. It packs the real skills, checks that every helper/reference survives, and loads all thirteen skills through the selected Pi SDK in an isolated profile. Offline tests also exercise native evaluation sessions with a scripted model stream; they do not establish model-backed skill quality. Pull-request CI runs the full suite on pinned official Pi and host-sensitive discovery and scripted runtime tests on the current fork.

The suite uses Node 24. Exact official and fork source baselines are recorded in the Pi extension skill's version hazards reference. CI installs D2 and librsvg to run the diagram rendering tests.

## Model evaluations

Run opt-in task and routing evaluations through the actual Pi SDK and configured model provider:

```bash
npm run eval:model -- --case clarify-and-continue
```

See [Skill evaluations](docs/evaluations.md) for both-host comparisons, repeated and held-out cases, caller profiles, and fixture limitations. Live model evaluations are local and opt-in. The [0.7.0 results](docs/evaluation-results.md) include exact outcomes, retained failures, source identities, and evidence. No model credentials are needed for the normal test suite.

This repository is private to npm publishing. Install it from git or a local checkout.
