# pi-agent-skills

Source-managed Pi package for Mitch's reusable agent workflows. Version 0.9.0 requires Pi 1.0.0 or later and Node 24.21.0 or later.

Guidance covers both official Pi and Mitch's active `fitchmultz/pi` fork; the same version string does not imply the same APIs. See [maintaining the skills](docs/maintaining-skills.md) for current sources and authoring policy, and [version hazards](skills/pi-extension-development/references/current-version-hazards.md) for the inspected host revisions.

## Skills

- `ask-clarifying-questions`
- `bro`
- `clef`
- `deslop`
- `diagram-creation`
- `dogfood`
- `handoff`
- `pi-extension-development`
- `propose-then-ship-pi`
- `ssh-unix-ops`
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

Asset/discovery validation uses the minimum supported Pi development baseline pinned in `package.json`. `check:compat` runs the existing content/helper tests and pack check; `smoke` is the native discovery test, also included in `npm test`. It packs the real skills, checks that every helper/reference survives, and loads all bundled skills through the selected Pi SDK in an isolated profile. Offline tests also exercise native evaluation sessions with a scripted model stream; they do not establish model-backed skill quality. Pull-request CI runs the full suite on the minimum official Pi baseline and host-sensitive discovery and scripted runtime tests on both current official Pi and the current fork. The supported baseline is now official 1.0.0; the current-host lane remains separate for future releases. The confirmed minimal-fork design is documented without claiming an unavailable candidate passed. No live runtime activation is part of qualification.

The suite uses Node 24. Exact official and fork source baselines are recorded in the Pi extension skill's version hazards reference. CI installs D2 and librsvg to run the diagram rendering tests.

## Model evaluations

Run opt-in task and routing evaluations through the actual Pi SDK and configured model provider:

```bash
npm run eval:model -- --case clarify-and-continue
```

See [Skill evaluations](docs/evaluations.md) for both-host comparisons, repeated and held-out cases, caller profiles, and fixture limitations. Live model evaluations are local and opt-in. The [0.7.0 results](docs/evaluation-results.md) include exact outcomes, retained failures, source identities, and evidence. No model credentials are needed for the normal test suite.

This repository is private to npm publishing. Install it from git or a local checkout.
