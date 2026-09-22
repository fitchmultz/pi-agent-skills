---
name: verification-before-completion
description: "Use this skill when the agent is about to claim work is complete, commit, open a PR, or say tests/lint/build pass. Verify the exact success claim with current evidence from diff cleanup, requirement checks, validation commands, runtime/manual checks, and contract/generated-surface alignment. Do not use for initial planning, speculative review, or root-cause debugging before a fix exists."
---

# Verification Before Completion

## Purpose

Make the final status claim match current evidence. This skill is the last gate before saying work is done.

## Core rule

No completion claim without current verification evidence.

Reviewer judgment does not replace validation evidence, and this skill does not require a review. Delegate substantive review when it saves time or improves quality; the original agent retains delivery ownership. Review findings that already exist still must be resolved or accurately reported.

Evidence freshness follows the code and environment it covers, not the turn boundary or wall clock. If you did not run or inspect the check in this work cycle, or cannot prove its recorded context still matches, do not claim it passes. If evidence proves only a narrower claim, report the narrower claim without pretending the original request is complete.

## Use when

Use immediately before:

- claiming a task, goal, fix, feature, or review loop is complete
- saying tests, lint, typecheck, build, smoke, or CI-equivalent checks pass
- committing, opening/updating a PR, or handing work back as ready
- marking a tracked goal/task complete

Do not use for initial planning, speculative discussion, or root-cause debugging before a candidate fix exists.

## Workflow

### 1. State the exact claim

Write the claim you are about to make:

- bug fixed
- requirements satisfied
- tests/lint/build pass
- PR ready
- no known tech debt remains in the touched scope
- generated/contracts/docs are aligned

Do not broaden the claim beyond the user request or evidence. Do not silently narrow broad acceptance criteria such as "all", "complete", "no tech debt", or "hard acceptance criteria".

### 2. Sweep the local delta

Run `git status --short` or the repo equivalent, then inspect changed files and relevant diff for:

- accidental churn or unrelated formatting
- debug logs, temporary flags, commented-out code, or hard-coded test paths
- unapproved task markers, scaffolding, temporary stubs, or compatibility shims
- unused imports/helpers or dead code
- docs, examples, help text, fixtures, or generated outputs that no longer match behavior
- staged or unstaged files that are unrelated to the claim

Clean only issues related to the work. Avoid unrelated style churn. Before commit/PR handoff, confirm no unrelated files are staged.

### 3. Check authority/mirror alignment

If an authority surface changed, verify directly affected mirrors.

Authority surfaces include APIs, schemas, OpenAPI/contracts, CLI flags, route contracts, config/env defaults, deploy templates, permission/policy manifests, feature flags, and generator inputs.

Mirrors include generated clients/types, SDK artifacts, fixtures, schema bundles, examples, docs, and alignment tests.

Use the repo's canonical generator or narrow obvious edits. Do not invent product behavior, business rules, or compatibility policy. Make routine alignment choices within the approved outcome. Ask only when an unresolved product or compatibility decision is necessary; report remaining unverified alignment.

### 4. Choose evidence that proves the claim

Pick the closest meaningful proof:

- tests pass → current test evidence with zero relevant failures
- lint/type/build pass → current command output and exit code 0
- bug fixed → original failing behavior no longer reproduces
- UI works → rendered/interactive inspection when relevant
- requirements met → requirement-by-requirement evidence map
- no tech debt left behind → diff sweep plus removal/resolution of each known shortcut or temporary stub

Static review does not prove runtime behavior. Green tests do not prove unmet requirements.

For a non-trivial regression test added or materially changed by the work, confirm the expected failure against the broken implementation and the pass against the fix when practical. Reuse original RED/GREEN evidence when the exact test exercised the reachable defect. If historical proof is missing, use an isolated `git worktree` or a targeted revert that cannot affect unrelated work when practical. Otherwise provide convincing verification and disclose the gap; missing old-code failure proof alone does not block completion. Do not substitute source-text assertions, a self-fulfilling mock, or a weakened assertion for the reachable defect.

### 5. Run, inspect, or reuse current verification

Record relevant command outputs, runtime checks, CI results, and manual observations with enough context to establish what they prove. Reuse inspectable evidence only while its relevant code, environment, and observed state remain unchanged; repeat live observations when those conditions cannot be established.

| Check or claim | Command or source | Scope identity | Result |
| --- | --- | --- | --- |
| `tests pass` | exact command and cwd | code plus relevant environment | exit code, failures, skips, warnings |

Reviewer analysis is different. Findings, verdicts, and sign-off are review history, not reusable validation evidence. Carry that history into later briefs, but never use it to skip a reviewer pass required by the caller's explicit review policy. This skill creates no such requirement. Deterministic checks run by a reviewer may be reused under the normal rules; the reviewer's judgment may not.

For a clean Git checkout, `git rev-parse HEAD^{tree}` identifies the tested file tree even when a later commit changes only metadata. Bind CI and commit-specific reviews to the exact head SHA. For uncommitted work, establish the input state covered by the check; `git status` paths alone are insufficient. Reuse the result only when relevant staged, unstaged, untracked, and ignored inputs are demonstrably unchanged. The broken half of an ablation receipt is historical evidence for a different state; preserve its command, result, and identified code state. Reconstruct missing historical proof when practical; otherwise disclose the gap and provide convincing verification. The fixed half follows the normal evidence-reuse rules.

Reuse a final-tree ledger entry only when all are true:

- the recorded code and input state is sufficient to establish that the evidence still applies
- its command or source directly proves the current claim
- its output is inspectable and records the result, failures, skips, and material warnings
- the code, cwd, dependencies, toolchain, configuration, generated artifacts, services, and environment inputs relevant to the check are unchanged
- no later failure, flaky signal, base integration, or policy has invalidated it

Do not rerun a still-valid full suite solely because a reviewer finished, a turn ended, or a commit preserved the same tree. Re-run only missing or invalidated checks, choosing the narrowest command that restores evidence. Always refresh the lightweight status/diff sweep before the final claim.

When no valid ledger entry exists, run the relevant command now or explain why it cannot run. Inspect its exit code, failures, skips, warnings, and whether the output actually proves the claim. If validation fails, own the triage. Fix high-confidence issues needed for the authorized outcome or required checks, then rerun affected checks. Report unrelated, pre-existing nonblocking defects separately.

### 6. Report only what evidence supports

If verification passed, cite the command/check.

If verification failed or could not run, state:

- exact blocker or failure
- what was verified
- what remains unverified
- whether the requested work is complete, incomplete, or blocked

Never use "should pass", "probably fixed", "looks good", "for this scope", or "good enough" as completion evidence.

## Output contract

Follow the user's requested format. State what changed, whether the requested outcome is complete, the verification that supports it, and any material gap or next action. Keep detailed commands and requirement-by-requirement evidence in the PR or work record when useful. Do not turn a simple completion update into an internal checklist.

## Completion standard

Verification is complete only when:

- the exact claim is explicit
- local changes were swept for accidental debt
- authority/mirror surfaces are aligned, ruled out, or reported as blocked
- relevant checks were run or reused from a still-valid ledger entry, or accurately blocked
- output was read, not assumed
- every actionable review finding already received in the claim's scope has a recorded **Fix** or **Rebut** verdict
- before/after regression proof was obtained when practical; otherwise convincing verification and the historical-evidence gap are reported
- final status does not exceed evidence

These rules triage review feedback that already exists; they do not require starting a review. An actionable finding identifies a defect, regression, policy violation, or concrete change to the current diff at any severity; pure context, praise, and risk notes that identify no defect or change are informational. Assess security concerns against the approved behavior and concrete evidence. Address actionable findings with a fix or an evidence-backed rebuttal, recorded in the review context; a follow-up alone does not resolve a finding. The owning agent may clear an incorrect or approved-behavior-conflicting finding without the originating reviewer's agreement. Complete explicitly requested reviews and preserve actual repository merge requirements. Include informational observations in the user update only when they materially affect the outcome or the user's next action.

Stop when evidence is sufficient for the exact claim. Continue when a missing check would materially affect correctness, buildability, user-visible behavior, data loss risk, or contract alignment.
