# Changelog

## [0.4.10] - 2026-08-19

- Require a broken-then-fixed ablation receipt before a non-trivial regression test added or materially changed by the work counts as completion evidence.

## [0.4.9] - 2026-08-19

- Require every actionable review finding to receive a `Fix` or `Rebut` verdict before completion; effort alone never permits deferral, an optional follow-up never clears a finding by itself, any fixed or rebutted security-seat finding requires that seat's clearance or withdrawal, informational classifications stay auditable, and small defects encountered directly along the implementation path remain in scope.

## [0.4.8] - 2026-08-19

- Add an explicit bundled UX review merge gate for every user-visible pull request, with a reasoned `N/A` only when the diff is proven unable to affect user-visible behavior.

## [0.4.7] - 2026-08-19

- Cap direct CI polling at five minutes and require longer waits to run in an asynchronous detached watcher.

## [0.4.6] - 2026-08-19

- Treat approved repository delivery as autonomous: branch, commit, push, pull request, and the repository's documented post-gate deployment need no second confirmation, while releases and external production control remain explicit authorization boundaries.

## [0.4.5] - 2026-08-16

- Preserve reviewer sign-off across conflict-free mechanical base syncs; refresh combined-head CI, base freshness, and mergeability instead.

## [0.4.4] - 2026-08-16

- Teach deslop to collapse evidence-laundering casts when a compiling replacement exists, keep `SAFETY:`-justified leftovers, and drop only no-context rethrows or proven-redundant swallows.

## [0.4.3] - 2026-08-15

- Always address blockers. Address nits unless they are a major level of effort; when in doubt, include them.

## [0.4.2] - 2026-08-15

- Execute every blocker and nit before completion. File only MASSIVE leftovers and name them in the final response. No follow-up PR chain.

## [0.4.1] - 2026-08-14

- Replaced ffmpeg's removed `-vsync vfr` option with `-fps_mode vfr`, restoring VFR contact-sheet generation on current ffmpeg releases. Doctor now rejects binaries without `-fps_mode` support before recording.

## [0.4.0] - 2026-08-13

- Added `ux-review` for PRs, designs, and user-facing product behavior, covering end-to-end ownership, recovery, truthful outcomes, capability boundaries, outcome metrics, and channel-appropriate output.

## [0.3.2] - 2026-08-09

- Aligned `package-lock.json` with the released package version. No skill or guidance changes.

## [0.3.1] - 2026-08-07

- Made Greptile automatic advisory feedback instead of a merge gate. Existing comments are fixed or rebutted without waiting for acknowledgment or re-review.

## [0.3.0] - 2026-08-06

### Changed

- Raised the minimum supported Pi version to 0.84.0.
- Updated extension, provider, JSON/RPC, SDK, harness-session, filesystem, and remote-session guidance for the Pi 0.84.0 contracts.
- Pinned local validation to Pi 0.84.0 and documented install, package, and release expectations for Pi 0.84.0 or later.

[0.4.10]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.9...v0.4.10
[0.4.9]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.2.0...v0.3.0
