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
npm install
npm test
npm run smoke
npm run pack:check
```

Validation uses the exact Pi 0.84.2 development dependency while the installed package supports Pi 0.84.0 or later.

This repository is private to npm publishing. Install it from git or a local checkout.
