---
name: verification-before-completion
description: "Use this skill when the agent is about to claim work is complete, commit, open a PR, or say tests/lint/build pass. Verify the exact success claim with current evidence from diff cleanup, requirement checks, validation commands, runtime/manual checks, and contract/generated-surface alignment. Do not use for initial planning, speculative review, or root-cause debugging before a fix exists."
---

# Verification Before Completion

## Purpose

Make the final status claim match current evidence. This skill is the last gate before saying work is done.

## Core rule

No completion claim without current verification evidence.

Local subagent review is not verification evidence and is not required by this skill. Do not launch reviewer subagents unless the current live user explicitly opted in or a higher-scope system/harness instruction requires them. Review findings that already exist still must be resolved or accurately reported.

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

Use the repo's canonical generator or narrow obvious edits. Do not invent product behavior, business rules, or compatibility policy. If alignment needs judgment, report it as blocked or unverified.

### 4. Choose evidence that proves the claim

Pick the closest meaningful proof:

- tests pass → current test evidence with zero relevant failures
- lint/type/build pass → current command output and exit code 0
- bug fixed → original failing behavior no longer reproduces
- UI works → rendered/interactive inspection when relevant
- requirements met → requirement-by-requirement evidence map
- no tech debt left behind → diff sweep plus removal/resolution of each known shortcut or temporary stub

Static review does not prove runtime behavior. Green tests do not prove unmet requirements.

A non-trivial regression test added or materially changed by the work being verified counts as evidence only with a broken-then-fixed ablation receipt: run the exact test in an isolated `git worktree` that keeps the new test while restoring the pre-fix implementation, or use a targeted revert only when it cannot affect unrelated user work, and confirm the expected failure; then run it against the fix and confirm it passes. The original test-first RED/GREEN commands qualify when that exact test exercised the reachable defect. When classification is uncertain, require the receipt. Do not substitute source-text assertions, a self-fulfilling mock, or a weakened assertion for the reachable defect.

### 5. Run, inspect, or reuse current verification

Keep a shared evidence ledger for deterministic machine-produced validation outputs: local commands, instrumented runtime checks, and CI results. Manual observations may be recorded for audit, but they are current-only and must not be reused across steps or agents.

| Check or claim | Command or source | Scope identity | Result |
| --- | --- | --- | --- |
| `tests pass` | exact command and cwd | code plus relevant environment | exit code, failures, skips, warnings |

Reviewer analysis is different. Findings, verdicts, and sign-off are review history, not reusable validation evidence. Carry that history into later briefs, but never use it to skip a reviewer pass required by the caller's explicit review policy. This skill creates no such requirement. Deterministic checks run by a reviewer may be reused under the normal rules; the reviewer's judgment may not.

For a clean Git checkout, `git rev-parse HEAD^{tree}` identifies the tested file tree even when a later commit changes only metadata. Bind CI and commit-specific reviews to the exact head SHA. Do not reuse an entry produced on a dirty checkout across steps or agents: there is no cheap complete identity covering staged, unstaged, untracked, and relevant ignored inputs. Run the check again after changes settle on a clean tree before carrying it forward. The broken half of an ablation receipt is historical evidence for a deliberately different state, not a final-tree ledger entry. Reuse it across steps or agents only when its exact command, inspectable result, and complete captured tree or commit identity are preserved; otherwise reproduce it in an isolated `git worktree`. The fixed half still follows the clean-tree reuse rules.

Reuse a final-tree ledger entry only when all are true:

- the checkout was clean when its code identity was recorded
- its command or source directly proves the current claim
- its output is inspectable and records the result, failures, skips, and material warnings
- the code state, cwd, dependencies, toolchain, configuration, generated artifacts, relevant services, and environment inputs it relied on are unchanged
- no later failure, flaky signal, base integration, or policy has invalidated it

Do not rerun a still-valid full suite solely because a reviewer finished, a turn ended, or a commit preserved the same tree. Re-run only missing or invalidated checks, choosing the narrowest command that restores evidence. Always refresh the lightweight status/diff sweep before the final claim.

When no valid ledger entry exists, run the relevant command now or explain why it cannot run. Inspect its exit code, failures, skips, warnings, and whether the output actually proves the claim. If validation fails, own the triage. Fix high-confidence issues and rerun unless a real blocker prevents progress.

### 6. Report only what evidence supports

If verification passed, cite the command/check.

If verification failed or could not run, state:

- exact blocker or failure
- what was verified
- what remains unverified
- whether the requested work is complete, incomplete, or blocked

Never use "should pass", "probably fixed", "looks good", "for this scope", or "good enough" as completion evidence.

## Output contract

Use this compact shape:

```md
Claim: [exact claim]
Delta sweep: [git status/diff clean / fixed items / remaining issue]
Alignment: [N/A or contract/generated/docs checked]
Ablation: [N/A, reference to preserved qualifying RED/GREEN evidence, broken command/state → expected failure; fixed command/state → pass, or blocked with the reason]
Verification: [commands/checks + result; reused entries include scope identity]
Unverified: [none or specific gaps]
Informational review notes: [each `Findings` item classified informational, with the reason, or none]
Final status: [complete / incomplete / blocked, matching evidence]
```

For trivial docs-only or one-line changes, keep each line short. For goals or broad acceptance criteria, include a requirement-to-evidence map before `Final status`.

## Completion standard

Verification is complete only when:

- the exact claim is explicit
- local changes were swept for accidental debt
- authority/mirror surfaces are aligned, ruled out, or reported as blocked
- relevant checks were run or reused from a still-valid ledger entry, or accurately blocked
- output was read, not assumed
- every actionable review finding already received in the claim's scope has a recorded **Fix** or **Rebut** verdict
- every non-trivial regression test added or materially changed by the work being verified has a broken-then-fixed ablation receipt, or the inability to reproduce its broken state is accurately reported as blocking completion
- every received `Findings` item classified informational is named with the reason
- every received `reviewer-security` risk note has a recorded **Fix** or **Rebut** verdict
- final status does not exceed evidence

These rules triage review feedback that already exists; they do not require starting a review. An actionable finding identifies a defect, regression, policy violation, or concrete change to the current diff at any severity; pure context, praise, and risk notes that identify no defect or change are informational. Name each item from a reviewer's `Findings` section that is classified informational, with the reason, in `Informational review notes`. Every received `reviewer-security` risk note requires a **Fix** or **Rebut** verdict even when it requests no change. Never defer an actionable finding. Fix it or rebut it with reasoning. A follow-up may accompany a rebutted out-of-scope finding but cannot clear the finding by itself. Do not claim complete while any received actionable finding lacks a **Fix** or **Rebut** verdict.

Stop when evidence is sufficient for the exact claim. Continue when a missing check would materially affect correctness, buildability, user-visible behavior, data loss risk, or contract alignment.
