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

The advertised Pi 0.84.0 floor is separate from the current discovery baseline. The development skill's `last-verified-pi: 0.84.2` still describes its historical API-guidance review, not this asset test; a dependency bump does not re-verify every piece of that guidance. Diagram rendering tests additionally need their existing external rendering prerequisites.

## Model evaluations

Run opt-in task and routing evaluations through the actual Pi SDK and configured model provider:

```bash
npm run eval:model -- --case clarify-and-continue
```

See [Skill evaluations](docs/evaluations.md) for both-host comparisons, repeated and held-out cases, caller profiles, the optional GitHub workflow, and fixture limitations. No model credentials are needed for the normal test suite.

This repository is private to npm publishing. Install it from git or a local checkout.
