# 0.7.0 evaluation results

Evaluated on 2026-09-22. This release preserves all twelve skills, refreshes their Pi contracts, and reduces repeated instructions. The comparisons found and corrected two instruction problems: a QA report could use the wrong directory, and the shorter Pi description lost explicit platform-work exclusions.

The behavior-qualified candidate completed all 19 task cases on both hosts after the two documented wording-only grading corrections below. The final description-only refinement matched all 32 Pi routing labels on both hosts. Some broader routing probes still disagree with their labels or encounter missing-repository fixture boundaries. These are bounded results, not a guarantee of universal routing accuracy or reliability.

## Reproduction and identities

See [evaluation commands and boundaries](evaluations.md). The [release evidence archive](https://github.com/fitchmultz/pi-agent-skills/releases/download/v0.7.0/pi-agent-skills-0.7.0-evidence.zip) retains the original grades, model outputs, tool traces, image evidence, source snapshots, correction receipts, and a hash manifest. Exported home/temporary paths are normalized; original receipt hashes and unchanged PNG hashes remain available. Invalidated and partial runs are retained, not silently replaced.

| Input | Identity |
| --- | --- |
| Official host | Pi 0.87.0, source `16787ad5b2dc748047f314ca1bfe7708f30f54f3` |
| Fork host | `fitchmultz/pi` revision `afed789dded723566b6ecb1c77a06e8561504f7a`, also version 0.87.0 |
| Live model | `openai-codex/gpt-6-astra`, `max` thinking, SSE, cache warming off, provider retries disabled |
| Effective host limits | 272,000 context tokens; 128,000 maximum output tokens |
| Case execution | Four independent jobs; five-minute case deadline; paired variants, reversed order on alternate repetitions |
| Policy-equivalent baseline | `aae58ed7baa3d992f9711a6c1f54c1790f34d64b` |
| Initial instruction candidate | `e6fdaa7d6cca973e638b8c86fa5ab51006358fa8` |
| Report-path candidate | `b249f769083fe3e688c7b6dc89cae33d543ce17f` |
| Final description refinement | `c556e5725334fd3587b0ea548ac4169ed7aeb76f` |
| Corrected routing/control runner | `b3cbecab872ddb26b8e84038d722297377d33329` |
| Final handoff wording grader | `4d9557f3e2cdd85cbd068a4ae2c674e3eea0a8c2` |

The baseline already contains the separately approved authorization, review, and proportional-verification policies. Comparisons therefore do not count those policy changes as wording-optimization gains. The delivered candidate also preserves the separately verified CI fail-fast fix. Each report records its actual skill and harness hashes, host SDK hash, profile hash, settings, and case selection.

## Task and selection results

Counts below are per variant, not combined across hosts. The portable/control candidate is `b249f769`; authorized-profile comparisons use the initial candidate. The final `c556e572` changes only the Pi discovery description and was checked separately against all 32 neighboring Pi prompts and the held-out Pi prompt.

| Suite | Official baseline/control | Official candidate | Fork baseline/control | Fork candidate |
| --- | ---: | ---: | ---: | ---: |
| Complete routing corpus, once | 118/124 | 119/124 | 119/124 | 119/124 |
| Held-out routing, 12 prompts twice | 24/24 | 24/24 | 24/24 | 24/24 |
| Authorized caller profile, 19 tasks | 19/19 | 19/19* | 19/19 | 19/19 |
| Portable tasks with isolated no-skills control | 16/19 | 19/19* | 16/19 | 19/19 |

\* The raw official authorized result is 18/19 because the review said “identity adapter” instead of `IdentityAdapter`. The raw official portable result is 18/19 because the handoff said “Stay in planning mode; do not modify files or begin implementation.” Both outputs met the requested constraints. Small grader corrections have failing-before/passing-after checks; separate receipts regrade the saved paired outputs. No model output or original JSONL grade was changed, and no model rerun was used to obtain those corrected counts.

The isolated controls had zero successful bundle-file accesses. Their three failures on each host were the skill-specific handoff opening and unsuccessful searches for the named shipping/Cloudflare policies. These controls show that the model already handles many simple tasks without the bundle; they do not establish a general capability or speed deficit without skills.

### Instruction refinements

| Paired follow-up | Official before → after | Fork before → after |
| --- | ---: | ---: |
| QA report path, three repetitions | 3/3 → 3/3 | 3/3 → 3/3 |
| Pi routing, all 32 prompts | 29/32 → 32/32 | 30/32 → 31/32 |
| Held-out Pi routing, twice | 2/2 → 2/2 | 2/2 → 2/2 |

The QA clarification followed one genuine wrong-directory attempt in the earlier corrected fork run. All six subsequent candidate traces wrote the requested report path on their first write, separately from screenshot directories. The prior candidate also passed these follow-ups, so the small sample does not prove a reliability-rate improvement.

For the Pi refinement, target-selection decisions matched all 32 labels on both hosts, including all 22 positive prompts. The candidate avoided the Pi skill for both Crabbox and platform-matrix-only requests on both hosts; the previous description selected it incorrectly in three of those four comparisons. The other 30 prompts retained the same selection decisions. The remaining fork candidate failure was an attempted parent-directory lookup in a fixture without the requested project, not incorrect Pi-skill selection. Label agreement is a diagnostic, not a reclassification of that raw failure as a pass. The follow-up does not prove downstream platform workflows.

### Remaining routing limitations

The complete-corpus raw failures include both label mismatches and guarded discovery attempts:

- Official: baseline four label mismatches plus two fixture-boundary failures; candidate three plus two.
- Fork: baseline four label mismatches plus one fixture-boundary failure; candidate four plus one.
- Both variants sometimes load the clarification skill for “Use the default settings unless something is obviously unsafe,” which has no concrete task or settings fixture. Another prompt conditionally requests questions but carries an unconditional positive label.
- Requests to inspect “this codebase” or prepare a PR sometimes select clarification first because no repository was supplied. Initial routing ends at that question action; it does not measure which workflow would run after a real answer.
- The Pi platform-work mismatches motivated the separately measured description refinement above.

Labels and file guards were left unchanged. Missing-context failures are not counted as evidence that one variant's skill instructions are better. No routing comparison demonstrated a failed end-to-end application task: task actions in these probes are inert.

## Recorded resource use

For the complete 19-task authorized-profile comparison, with equivalent policy and no provider failures:

| Host | Baseline tokens | Candidate tokens | Baseline tool calls | Candidate tool calls |
| --- | ---: | ---: | ---: | ---: |
| Official | 895,196 | 785,121 | 137 | 139 |
| Fork | 1,038,389 | 802,142 | 148 | 135 |

Tokens include cache reads across turns. This candidate used fewer recorded tokens in both comparisons, while tool-call counts were mixed. Other follow-ups also had mixed timing and token results. These observations do not establish a general latency improvement, billing reduction, or statistical significance; provider caching, load, nondeterminism, and the small task set matter. Full token, call, and elapsed-time totals remain in every report.

## Original runs and corrections

The initial portable comparison ran 19 tasks twice per variant on each host. Raw results were official 35/38 baseline versus 36/38 candidate, and fork 36/38 versus 38/38. Those scores cannot be used as improvement claims:

| Observed problem | Treatment |
| --- | --- |
| QA fixture rejected legitimate evidence-report writes | Allowed the explicitly requested report file while retaining application-write restrictions and actual image inspection; reran both variants twice on both hosts. |
| Documentation fixture supplied only a summary claim | Added the real documentation-only Git diff, pre-existing check output, and checked-input hashes; reran both variants twice on both hosts. |
| Official SDK inherited fork documentation paths | Bound `PI_PACKAGE_DIR` to the selected SDK before import, recorded and checked the native resource root; reran both official SDK-review pairs. The old official run retains this context caveat. |
| Routing stopped after inspection or another skill | Preserved the censored reports, including prematurely passing negative cases; reran the full routing and held-out cohorts with the explicit initial-routing boundary. |
| Official deliberate cancellation was classified as provider failure | Added narrow post-decision cancellation handling and retained raw diagnostics. The stopped old official routing report remains partial: 126 rows, no summary. |
| “No skills” still allowed manual bundle reads | Denied those reads and removed the bundled resolver from control tool help; reran the complete control cohorts on both hosts. Old controls are not quality evidence. |
| Two free-text graders required incidental wording | Preserved raw failures and recorded the paired, output-preserving corrections described above. |

Two earlier benchmark attempts ended with the stream error `terminated`: the original official wrapper review and the old fork control SDK review. The official paired retry passed; the replacement fork control completed successfully. Both original errors remain visible. Completed corrected routing, held-out, and final control runs had no uncontrolled provider errors or deadlines.

The corrected fixture pairs scored 6/6 for both official variants and 4/4 baseline versus 3/4 candidate on the fork. The latter failure was the genuine QA report-path mistake addressed by the instruction refinement. Unaffected original pairs remain available separately; no mixed-source aggregate is presented as a fresh full comparison.

## Coverage and local verification

| Skill | Executed task contract |
| --- | --- |
| `ask-clarifying-questions` | Ask once, persist the answer, continue; inspect discoverable facts before asking |
| `bro` | Explicit invocation, concise plain-language restatement with preserved meaning; absent from automatic discovery |
| `handoff` | Paste-ready continuation and read-only delegation prompts, scope and evidence honesty |
| `deslop` | Real diff cleanup while preserving behavior, invariant comments, and user-owned files |
| `tdd` | Actual reachable Node assertion failure, unchanged regression test, then passing fix |
| `verification-before-completion` | Supported completion, failed-check refusal, practical proof and disclosed historical gaps |
| `thermo-nuclear-code-quality-review` | Concrete unnecessary-wrapper finding without edits |
| `ux-review` | Lost accepted work is rejected; a verified static-navigation success is not overcomplicated |
| `pi-extension-development` | Read the selected host's emitted SDK contracts and correct model/tool APIs |
| `propose-then-ship-pi` | Respect an explicit merge hold and an explanation-only boundary |
| `diagram-creation` | Open a real PNG and identify the reversed relationship |
| `dogfood` | Exercise Save, capture and open screenshots, report the observed failure, honor report paths and Cloudflare boundaries |

The integrated release source passed **59/59 local tests, zero skips**, in all four combinations of official Pi 0.87.0 / fork `afed789` and Node 22.19.0 / 24.21.0. Native discovery found all twelve packed skills on both hosts. Package checks preserve all original resources, with the intentional CI helper update. The native evaluation tests also passed against the independent, npm-nested Pi 0.86.1 graph; this does not qualify the advertised historical Pi 0.84 floor.

Separate recon verified native Git installation and discovery on both hosts, four live provider/host smoke combinations, actual question-tool RPC dialogs and print-mode refusal, and real renderer/VFR helper checks. These narrower receipts do not turn the synthetic browser, merge, or delegation fixtures into live-service tests.

GitHub Actions was explicitly disabled during delivery and remained disabled. Final qualification is local; no new-head Actions success was fabricated. The optional model workflow was not dispatched and its repository credential was not provisioned. Browser authentication, remote merges by an evaluated model, real subagent reviews, motion quality, and untested platforms are outside the live comparison's proof.
