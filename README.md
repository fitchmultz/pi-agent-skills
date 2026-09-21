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

Asset/discovery validation uses the exact Pi 0.86.1 development baseline. `check:compat` runs the existing content/helper tests and pack check; `smoke` is the native discovery test, also included in `npm test`. It packs the real skills, checks that every helper/reference survives, and loads all twelve skills through the selected Pi SDK in an isolated profile. It does not load a fictitious runtime extension or execute model-backed skill tasks. The compatibility runner selects independent official/fork dependency graphs and verifies their resolved package identity.

The advertised Pi 0.84.0 floor is separate from the current discovery baseline. The development skill's `last-verified-pi: 0.84.2` still describes its historical API-guidance review, not this asset test; a dependency bump does not re-verify every piece of that guidance. Diagram rendering tests additionally need their existing external rendering prerequisites.

This repository is private to npm publishing. Install it from git or a local checkout.
