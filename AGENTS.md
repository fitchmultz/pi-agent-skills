# Project instructions

- This repository is the canonical source for the bundled Pi skills.
- Do not publish this package to npm.
- Keep each behavior change in its own pull request.
- Preserve bundled scripts and references when changing a skill.
- `test/package.test.mjs` owns shared behavioral corpus shape checks; skill-specific tests retain critical scenario IDs and independent policy contracts.
- Run `npm test`, `npm run smoke`, and `npm run pack:check` before shipping.
