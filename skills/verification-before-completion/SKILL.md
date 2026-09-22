---
name: verification-before-completion
description: "Verify evidence before claiming completion or passing checks, committing, opening a PR, or handing work back. Covers diff cleanup, requirements, runtime proof, and contract/generated-surface alignment. Not initial planning or diagnosis before a candidate fix."
---

# Verification Before Completion

Make the exact status claim match current inspectable evidence. Do not broaden beyond the request or silently narrow acceptance such as “all,” “complete,” or “no tech debt.” A narrower proof warrants a narrower report, not a claim that the original request is done.

Reviewer judgment does not replace validation. This skill requires no review or fresh opt-in; delegate substantive review when useful, while the original agent retains delivery ownership. Complete actual requested/standing reviews and address feedback already received.

## 1. State the claim and sweep the delta

Identify what you will claim: bug fixed, requirements met, checks pass, PR ready, or contracts/docs aligned. Inspect fresh `git status --short` and the relevant diff for unrelated churn, debug/scaffold leftovers, unapproved TODOs/stubs/shims, dead code, hard-coded test paths, and stale docs/examples/fixtures/generated output. Clean only in-scope issues and confirm no unrelated files are staged before delivery.

When an authority surface changes (API/schema, CLI, defaults, permissions, deployment, flags, generator inputs), check directly affected mirrors: clients/types, fixtures, examples, docs, generated artifacts, and alignment tests. Use the canonical generator or narrow obvious edits. Make routine alignment choices within the approved outcome; ask only when an unresolved product or compatibility decision is necessary. Report any remaining unverified alignment without inventing behavior or policy.

## 2. Choose proof that reaches the claim

| Claim | Closest meaningful proof |
| --- | --- |
| Tests/lint/type/build pass | Current command output and successful exit, with failures/skips/warnings inspected |
| Bug fixed | The original reachable failure no longer reproduces |
| UI works | Relevant rendered/interactive inspection |
| Requirements met | Requirement-by-requirement evidence map |
| No tech debt remains | Diff sweep and resolution of each known unapproved shortcut/stub |

Static review cannot prove runtime behavior; green tests cannot satisfy an unimplemented requirement.

### Regression proof

For non-trivial regression tests added or materially changed, demonstrate the expected failure against the broken implementation and pass against the fix when practical. Reuse original RED/GREEN evidence when the exact test reached the defect. Reconstruct missing proof in an isolated `git worktree` or with a targeted revert only when unrelated work cannot be affected.

If historical reproduction is impractical, provide convincing verification and disclose the gap; missing old-code failure proof alone does not block completion. Preserve available commands, code states, outputs, and results. Never substitute a source-text assertion, weakened assertion, or self-fulfilling mock for the real defect boundary. Do not claim an unperformed test-first cycle occurred.

## 3. Run or reuse current evidence

Record command outputs, instrumented checks, CI results, and manual observations with enough context to establish what they prove: exact command/source and cwd, relevant code/environment/state, result, failures/skips/warnings, and inspectable output.

For a clean Git tree, `git rev-parse HEAD^{tree}` survives metadata-only commits. CI and commit-bound reviews use the exact head SHA. Uncommitted work can also have valid evidence: identify its relevant staged, unstaged, untracked, and ignored inputs; unchanged `git status` paths alone prove nothing.

Reuse evidence only when:

- its recorded code and input state establish that it still applies;
- its command or source directly proves this claim and the output is inspectable;
- relevant code, cwd, dependencies, toolchain, configuration, generated artifacts, services, environment, and observed state remain unchanged;
- no later failure, flaky signal, base integration, or policy invalidated it.

Repeat live observations when their relevant conditions cannot be established. The broken half of an ablation is historical evidence of a different state: preserve its command, result, and identified code. Reconstruct missing history when practical; otherwise disclose the gap with convincing current proof. The fixed half follows normal reuse rules.

Reviewer findings and verdicts are analysis, not validation evidence. Carry them into briefs without presenting old analysis as a review of changed code or skipping a required review. Deterministic checks run by reviewers follow the normal reuse rules.

Do not rerun a still-valid full suite merely because a reviewer finished, a turn ended, or a metadata-only commit preserved the tree. Refresh the lightweight status/diff sweep; run only missing/invalidated checks. With no valid evidence, run the relevant command or explain the concrete blocker. Inspect actual output and exit status. Fix issues needed for the authorized outcome or required checks, then rerun affected checks. Report unrelated, pre-existing nonblocking defects separately.

## 4. Resolve received feedback

- Address every actionable finding with **Fix** or an evidence-backed **Rebut**, recorded in the review context. Fix valid in-scope defects regardless of effort; a follow-up alone does not resolve a finding.
- The owning agent may clear incorrect, out-of-scope, or approved-behavior-conflicting agent findings without the originating reviewer's agreement. Preserve requested reviews, required human approvals, repository protections, and unresolved valid security findings.
- Assess security notes against concrete impact and approved behavior. Context, praise, or risk without a defect/change can be informational regardless of reviewer role; include it in the user update only when material to the outcome or next action.

## Report and finish

Follow the user's format. State what changed, whether the requested outcome is complete, the supporting verification, and any material gap or next action. Keep detailed commands and requirement-by-requirement evidence in the PR/work record when useful; do not force a simple update into an internal checklist.

For failed or unavailable checks, name the concrete failure, what was verified, and what remains. “Should pass,” “probably fixed,” “looks good,” “for this scope,” and “good enough” are not evidence.

Stop when proof is sufficient for the exact claim and received actionable findings are resolved. Continue when missing evidence could materially affect correctness, buildability, user-visible behavior, data loss, or contract alignment.
