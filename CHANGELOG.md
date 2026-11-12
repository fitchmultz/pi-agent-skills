# Changelog

## [Unreleased]

- Require Node `^24.22.3 || >=26.13.1` for the November 2026 security fixes; align setup guidance and root lockfile metadata.

- `pi-development`: the bundled resolver's `--json` output also compares the resolved host with the skill's stamp. The existing keys and the plain output are unchanged.
  - `forkCommit` is the commit in the `fork-release.json` receipt that the fork installer writes beside the release's `node_modules`, or `null` when the package has none. `stampPiVersion` and `stampForkCommit` are the stamp from the `SKILL.md` frontmatter.
  - `stampMatch` is true when the installed fork commit equals the stamp, or, for a package with no receipt, when the installed version equals the stamp.
  - When they differ, `changelog` is the path of the installed `CHANGELOG.md` and `stampNote` says to read it before copying an API from the skill. For a version older than the stamp, `stampNote` says to update the host first.

- Check the facts that `pi-development` cites against the selected Pi host. `test/pi-development-facts.test.mjs` reads every code span of the skill and looks up each name, documentation file, heading, schema file, and bundled version in the host package. It runs inside `npm test`, so the `official` and `fork` jobs and the daily canary run it.
  - The `fork` job fails when the fork lacks a cited fact. The `official` job fails when official Pi lacks a fact that the skill does not mark as fork-only, and when official Pi has a fact that the skill marks as fork-only. A plain `npm test` applies the `official` rules to the development SDK and shows the fork rule as skipped.
  - A fact that only the fork has carries the mark `<!-- fork-only -->` directly after its code span. The references mark the 34 facts that are fork-only today. No statement changes.
  - Names that do not belong to Pi are in the `notHostNames` list of the test, each with its reason. A new name that no host has fails until someone corrects the line, marks it, or lists it.
  - `docs/refreshing-pi-development.md` gains "Facts that `npm test` checks": the kinds of fact, the exact mark, and the action for each failure message.

- Add the house conventions to `pi-development`. They are binding for Mitch's Pi packages and the `fitchmultz/pi` fork, so that every package looks, reads, and ships the same way. `SKILL.md` names three new references and when to read each:
  - `references/house-conventions-ux.md`: tool cards (no live state in the call part, a bounded result preview, one hint row, what an HTML export keeps), messages and entries, notices, work without a UI, the status line, commands, key hints, settings, one word list, and one symbol set.
  - `references/house-conventions-tool-contract.md`: what each text slot of a tool holds, parameter names, exposure, what a cut result ends with, returned failures, `details`, stored records, hooks and the prompt cache, and messages to the model.
  - `references/house-conventions-delivery.md`: layout, `npm run check` as the gate before a push and `npm run check:compat` in shared CI, the Pi floor, the automatic npm release on merge, changelog notes and pull request titles, and the document set.
  - Correct the existing references where they said the opposite: `description` is the contract and `promptSnippet` the one-line label; a failure can be returned with `isError: true`, and only that form keeps `details`; the running state of a tool belongs in the result part, not in `renderCall`; the state symbols are `✓`, `✗`, `…`, and `⊘`; message and entry renderers receive `keyText` and `keyHint`; tool guidance goes in `promptGuidelines` or in a prompt section only while the tool is declared.
  - `references/publishing/workflow.md` now starts with the release channel. A package on an automatic npm channel releases on merge and uses no npm token; the manual tag and publish flow is only for a package with no release automation. The paragraph about the first `@fitchmultz/pi-workflows` publication is gone.
  - Add eight evaluation scenarios and the behavior case `pi-house-conventions`, and test that every relative link and heading anchor in the skill resolves.

- Record the supported official Pi release and `fitchmultz/pi` commit once, as the `pi-development` stamp: `metadata.last-verified-pi` and `metadata.fork-source` in its frontmatter. The stamp values are unchanged.
  - Remove the other records of the pair: `metadata.official-source`, the official commit, the merged upstream commit, and the verification date. The hazards reference links the official release by its tag, and states the fork's package version by pointing at the fork commit. The `compatibility` field, the maintenance guide, and `AGENTS.md` point at the stamp.
  - `test/pi-development.test.mjs` fails when a repeated value differs from the stamp: an official version or a fork commit in `SKILL.md` or the references, the development SDK pin, or a `Pi X.Y.Z` floor in the README, `clef`, or `code-smells`.
  - Add `docs/refreshing-pi-development.md`, the procedure that moves the stamp. A run reads what changed between the stamp and the latest hosts, updates the skill, and opens and merges one pull request. A refresh pull request records its changes in its own body and adds no changelog entry.
  - State what an agent does when the installed host is newer or older than the stamp.

- Raise the minimum supported floor across `pi-development`, `clef`, `code-smells`, and the development SDK to official Pi `1.5.1` (`dd30101cfc5b0609411dd80b6f93adbc14db14cf`) and `fitchmultz/pi` commit `283718159fc199d9b49eb4ddf1d5bff55e305dd9` (`1.5.1`). Rewrite `pi-development` (`5.0.0`) for that floor:
  - Move the contracts that official Pi 1.5.1 released out of the fork-only lists and into one shared section: `Type.BigInt()` and `Type.Undefined()` conversion, optional `ReadOperations.createReadStream`, the deprecated and ignored `GrepOperations.readFile`, overlay `blocked` status, Markdown transformer `messageTypes`, the `promptCacheKeyMode`, `requiresToolsWithToolHistory` and `requiresNonNullAssistantContent` compat flags, Anthropic message threads with `disableContinuation` and `cleanupSessionResources`, `pi auth login` and `logout`, immediate idle RPC shutdown, prompt-template quoting, and `qwen-token-plan-individual-cn`.
  - Add an "After 1.5.1" table for upstream changes that only fork `main` has. Its first row is the Continue, Fork, or Cancel prompt for a saved session whose working directory is gone, with what `ctx.switchSession()` callers observe.
  - Correct statements that no longer match either host: setup cancellation reports `stopReason: "aborted"`; `dispatchMouseEvent` and `retargetMouseEvent` are not `pi-tui` root exports; schema editor URLs are `https://pi.dev/schemas/<name>.schema.json`; tool-result guards compare only `toolName` on both hosts; official Pi supports Termux, and the fork adds to it. Remove the sentence about `Tool.async`, `ResponseControl.steer`, `supportsAsyncTools` and `supportsSteering`, which neither host defines.
  - Add the fork's hidden model overrides, the official and fork quit difference, the busy guards on `reload()` and `navigateTree()`, `Provider.refreshModelsAuth`, the package-update `result` event, and the `github-copilot` `microsoft-decision-1` classifier.
  - Keep exact versions and commits only in the skill frontmatter and in "Targets and floors" at the top of `references/current-version-hazards.md`. The other references, the evaluations, the README and the maintenance guide point there instead of repeating them. Evaluation IDs are unchanged, and migration scenarios keep the versions they describe.

- Update `ask-clarifying-questions` to ask one focused blocking question at a time, wait for each answer before asking the next, and drop the batched multi-question reply example while keeping compact single-question replies.

- Teach native deferred tools in place of the fork's retired instruction groups. `pi-development`, `dogfood`, `propose-then-ship-pi`, `lyrics`, their evaluations and the maintenance guide now find deferred tools with `tool_search` on both official Pi and the fork; `agent_browser` itself is a direct tool, so `dogfood` and `lyrics` report it unavailable when it is missing. Remove the dogfood case for the retired fork browser discovery; `edge-browser-extension-unavailable` covers a missing browser tool. Fork main removed `discover_tools`, `pi:instruction-groups` and `pi.refreshTools()` in [`c48f833ef37241e66d7e61efda45f09d940d40ed`](https://github.com/fitchmultz/pi/commit/c48f833ef37241e66d7e61efda45f09d940d40ed).

- Shorten nine model-listed skill descriptions to 124–140 characters, keeping their selection criteria and the exclusions that separate sibling skills. `ask-clarifying-questions` and `pi-development` keep their full descriptions because shorter versions misrouted in the routing suite. Make `lyrics` and `propose-then-ship-pi` command-only with `disable-model-invocation: true`; their `/skill:` commands are unchanged. Remove their description-routing prompts (both `trigger-evals.json` files and the held-out `propose-then-ship-pi` prompt), and run the `shipping-plan-only` behavior case through explicit invocation.

- Rename `pi-extension-development` to `pi-development` without changing its extension-development scope. Preserve all bundled helpers, references and evaluation cases, and update their consumers. Refresh the guidance for current fork contracts while distinguishing unreleased upstream changes from official Pi 1.5.0.

- Raise the minimum supported floor across `pi-extension-development`, `clef`, `code-smells`, `dogfood`, `propose-then-ship-pi`, and the development SDK to official Pi `1.5.0` (`f9a26365568127461c47a07a37dcb42c140a3ac5`) and `fitchmultz/pi` commit `ea5fe4563fd15e7b630fa33c776865a1e30c7acb` (`1.5.0`). Teach the Pi 1.5.0 extension contracts: pi-schema tool-argument validation and coercion, `typebox` imports, `StringEnum` type-checking through Pi's extension view, injected key hints, blocking custom UI, `pi.exec()` output caps, package changelogs, `ToolCallArgumentsStream`, and the current fork seams with structural detection. Describe Kimi Coding's OpenAI Completions route, add a pi-schema migration evaluation, and ship floor raises together with their guidance in one pull request.

- Stream bounded remote file reads in `ssh-unix-ops` (`--max-lines >= 0`) with incremental decoding and `splitlines(keepends=True)` so prefix/page reads stop after the requested line range without materializing the entire remote file.

- Add `lyrics`: fetch real lyrics for a requested song through the bundled lrclib.net script (with browser-source fallback) and return one copyable phonetically rewritten block for Suno-style vocal synthesis, plus paste-mode rewriting and an unrewritten-original variant.

- Raise the minimum supported floor across `pi-extension-development`, `clef`, `code-smells`, `dogfood`, `propose-then-ship-pi`, and repository dependencies to official Pi `1.4.0` (`4a080252f06caf63a525d7873c5d94d3c23887e0`), `fitchmultz/pi` commit `9e0674ef667e90a63a5fb64f18fbb476cd1b8a3f` (`1.4.0`), and current companion/analyzer baselines (`@fitchmultz/pi-subagents` `0.52.6+`, `pi-change-working-dir` `0.6.0+`, `@earendil-works/pi-durable` `1.4.0+`, `oxlint` `1.90.0+`, `oxfmt` `0.75.0+`, TypeBox `1.3.27+`, PMD `7.29+`, `lizard>=1.24.3`, `pathspec>=1.1.1`, and multimodal Clef/`clef-omni`/`clef-flash` classifiers), while instructing agents to always resolve and build to the current latest official release, latest fork HEAD, and latest dependency versions.
- Add `code-smells`: a read-only current-project or scoped analysis with complete file/function, graph, clone, and resumable full-Clef/Gateway evidence helpers. Keep ranking and user-requested top-N output in the parent model, without inherited scan budgets, numeric smell thresholds, or confidence cutoffs.
- Rewrite the README with a human-focused install path, practical skill guide, and editable workflow diagram; move detailed validation guidance into the maintenance guide.

## [0.9.2] - 2026-10-09

- Refresh Pi extension development guidance against installed fork c2031's full `FORK.md` inventory and `docs/instruction-groups.md`, distinguishing current installed source from historical 1.0 qualification and the unreleased upstream target.
- Document published configuration schema paths, strict theme fields, canonical key IDs, positive model/image/cache limits, and revision-specific hardware/fake cursor behavior without requiring unavailable helper imports on current supported hosts.
- Retain the Pi 1.0.0 development floor and historical verification metadata; align maintenance guidance with frozen current-host CI. Git/GitHub-only patch release; no npm publication.

## [0.9.1] - 2026-10-09

- Add `clef`, a concise reference for Cloudflare's decision models and Pi's native classification API, without prescribing a domain or workflow.
- Accept npm 11's singleton array and npm 12's package-name-keyed `npm pack --json` output in the publishing and Linux Docker recipes. Select only the expected package and preserve release identity, manifest, artifact marker, path and hash checks.
- Exercise all five documented parsers against observed npm 11.19.0/12.2.0 fixtures and malformed/ambiguous metadata, including retained release-artifact safeguards.

## [0.9.0] - 2026-10-01

- Raise the supported SDK and current-host qualification to Pi 1.0.0; keep Git/GitHub-only delivery and every bundled skill/resource.
- Replace removed experimental agent-core and old fork runtime advice with public session/boundary/model/tool/TUI contracts. Document portable Posthorse, the confirmed minimal-fork collector and its unqualified candidate boundary, disposition-aware completion, same-file queue limits and fullscreen behavior.
- Use the bundled CLI in evaluation fixtures and explicitly disable model-network refresh; preserve paid-evaluation scope and historical results.

- Qualify current official Pi separately from the declared supported development baseline; track the current-host CI pin with Renovate.
- Bundle `ssh-unix-ops` with its SSH helper, references, integration scripts, and evaluation corpora; replace standalone installation guidance with the canonical Pi package workflow and clarify remote-write authority and file-safety limits.
- Fix inherited SSH helper bugs: use non-login shells for tree-transfer streams and decode stdin diffs with the requested encoding.
- Make extension development and validation explicitly target both official Pi releases and the `fitchmultz/pi` fork, with separate host identity, API, and loading evidence.

## [0.8.1] - 2026-09-27

- Replace obsolete settings-inventory advice with extension-owned discovery metadata, native capability gating, complete deferred instructions and existing declaration-history recovery.
- Keep official Pi exposure and explicit tool policy boundaries clear, including the shared post-bind SDK selection boundary where policy provenance is unavailable.

## [0.8.0] - 2026-09-26

- Refresh all thirteen skills against current OpenAI and Agent Skills guidance: focused questions, authorized follow-through, explicit task boundaries, concise outputs, and proportional verification.
- Raise the package baseline to Pi 0.87.1 and Node 24.21.0, refresh source-qualified extension guidance for official Pi and the current fork, and keep the dependency lock scoped to the coordinated Pi release.
- Document the active fork's deferred integration discovery and model-only live-result hooks without treating them as official Pi or provider capabilities.
- Align extension guidance with relevant version-matched documentation sections and required contract links, retaining exact-host and official/fork verification.
- Correct delegation directory guidance for `pi-subagents` 0.39.0+ with `pi-change-working-dir` 0.5.0+, preserving the distinction between execution directories and project context.
- Add the portable `test-audit` skill, retaining its upstream attribution and license.
- Reject active SVG content and `foreignObject` elements split across lines.
- Keep terminal capture on its own origin, detect entirely blank recordings, and preserve existing contact sheets when retries fail.
- Run pull-request compatibility checks on both official Pi and the current fork; keep live-model comparisons opt-in and historical evaluation results unchanged.

## [0.7.0] - 2026-09-22

- Streamline skill selection and workflow instructions while preserving all twelve skills and their bundled scripts, references, and assets.
- Refresh extension API guidance against official Pi 0.87.0 and the current fork, distinguish host-specific contracts, and document optional tool prerequisites.
- Align verification and review with current authorization: reuse applicable evidence, demonstrate regression failures when practical, continue independent work, and resolve findings with fixes or evidence-backed rebuttals.
- Add native Pi task and routing evaluations with baseline comparisons, held-out prompts, caller-policy and no-skills controls, and retained tool/image evidence. Live model runs remain separate from offline compatibility checks.
- Report failing CI checks immediately while preserving the existing non-Greptile check selection and PR-state receipts.
- Honor caller-selected QA report paths independently of screenshot directories, and preserve explicit Crabbox/platform-matrix routing exclusions.
- Publish [bounded model comparison results](docs/evaluation-results.md), including corrected fixtures, raw failures, and reproducible evidence.

## [0.6.0] - 2026-09-05

- Upgrade diagram-creation to 2.1.0. D2 rendering now requires Python 3 for native publication locking; SVG-native rendering requirements are unchanged.
- Prevent concurrent D2 publishers from corrupting the same SVG/PNG pair. Relative and symlink-directory aliases share a persistent lock sidecar; unrelated output bases remain independent. The lock stays held while publication children run and releases when the last holder exits. SIGKILL cannot run rollback, so interrupted backup/publish directories retain recovery artifacts.
- Verify same-output contention, alias handling, child-process lock lifetime, and byte-identical rollback with real-process regressions on macOS Bash 3 and Linux Bash 5.

## [0.5.1] - 2026-08-30

- Restore both prior D2 outputs when paired SVG/PNG publication is interrupted, or leave both absent when no prior outputs existed, while retaining recovery files if restoration cannot finish.
- Publish SVG-native review images before replacing the final PNG, so review publication failures preserve the prior PNG and remove partial review output.
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

[0.9.2]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.9.0...v0.9.1
[0.8.0]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/fitchmultz/pi-agent-skills/compare/v0.5.0...v0.5.1
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
