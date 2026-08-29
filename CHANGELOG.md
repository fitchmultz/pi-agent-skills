# Changelog

## Unreleased

- Resolve the Python executable before tests remove `pi` from `PATH`, so the package's resolver checks run on Termux as well as conventional Unix layouts.

## [0.5.0] - 2026-08-28

- Upgrade diagram-creation to 2.0.0 with renderer selection based on visual intent, a polished SVG-native path and reusable design-system starter, preserved D2 support for topology-led work, composition-first layout hygiene, mandatory full-image and crop inspection, and full PNG decode verification that rejects truncated renders.

## [0.4.16] - 2026-08-24

- Make local subagent review opt-in in propose-then-ship and verification-before-completion. By default they rely on required remote checks, current validation evidence, and existing feedback; the four-seat panel remains available only after explicit live-user opt-in or a higher-scope system/harness requirement.

## [0.4.15] - 2026-08-22

- Sync the pi-extension-development skill to installed Pi 0.84.2: correct tree-navigation abort semantics across every file (replacement and interactive /tree abort; programmatic navigateTree rejects while a run is active), document the 0.84.2 cumulative usage field on delta-only message_update, cover the 0.84.1/0.84.2 contracts (blocked tool_call terminate, expandPromptTemplates, triggerTurn:false, Agent.reset idle rejection, defaultTools, pi auth check, qwen-token-plan-individual, bash exposeSessionEnvironment, AI_AGENT markers, --use-theme, PI_TUI_ESC_TIMEOUT, fullscreen search), add the six missing docs to the per-surface source lists, and bump the skill to 1.13.0 verified against 0.84.2.

## [0.4.14] - 2026-08-22

- Make the pi-extension-development resolver honor `PI_PACKAGE_DIR` before launcher resolution so the override works without `pi` on PATH, have an explicit `--pi` ignore the override, and add behavioral tests for the resolution paths.

## [0.4.13] - 2026-08-19

- Put system and harness instructions first, let current live-user direction override global defaults where permitted, make active global agent policy authoritative over repository guidance, and apply compatible repository rules in preference to skill defaults.

## [0.4.12] - 2026-08-19

- Use colons instead of prose dashes in proposal, ship, UX-review, dogfood report, and generated status output while preserving structural hyphens and Markdown separators.

## [0.4.11] - 2026-08-19

- Keep Cloudflare control-plane and documentation work out of `agent_browser`; use the configured Cloudflare documentation and API tools or report unavailable work truthfully, while retaining direct browser QA for customer apps on custom, `pages.dev`, or `workers.dev` targets. Stop if Access, a managed or bot challenge, or Turnstile blocks the requested flow; never interact with that Cloudflare surface.

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

[0.5.0]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.16...v0.5.0
[0.4.16]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.15...v0.4.16
[0.4.15]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.14...v0.4.15
[0.4.14]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.13...v0.4.14
[0.4.13]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.12...v0.4.13
[0.4.12]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.11...v0.4.12
[0.4.11]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.4.10...v0.4.11
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
