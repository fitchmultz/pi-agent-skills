---
name: verification-before-completion
description: "Use this skill when the agent is about to claim work is complete, commit, open a PR, or say tests/lint/build pass. Verify the exact success claim with current evidence from diff cleanup, requirement checks, validation commands, runtime/manual checks, and contract/generated-surface alignment. Do not use for initial planning, speculative review, or root-cause debugging before a fix exists."
---

# Verification Before Completion

## Purpose

Make the final status claim match current evidence. This skill is the last gate before saying work is done.

## Core rule

No completion claim without current verification evidence.

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

### 5. Run, inspect, or reuse current verification

Keep a shared evidence ledger for deterministic machine-produced validation outputs: local commands, instrumented runtime checks, and CI results. Manual observations may be recorded for audit, but they are current-only and must not be reused across steps or agents.

| Check or claim | Command or source | Scope identity | Result |
| --- | --- | --- | --- |
| `tests pass` | exact command and cwd | code plus relevant environment | exit code, failures, skips, warnings |

Reviewer analysis is different. Findings, verdicts, and sign-off are review history, not reusable validation evidence. Carry that history into later briefs, but never use it to skip a required fresh reviewer pass. Deterministic checks run by a reviewer may be reused under the normal rules; the reviewer's judgment may not.

For a clean Git checkout, `git rev-parse HEAD^{tree}` identifies the tested file tree even when a later commit changes only metadata. Bind CI and commit-specific reviews to the exact head SHA. Do not reuse an entry produced on a dirty checkout across steps or agents: there is no cheap complete identity covering staged, unstaged, untracked, and relevant ignored inputs. Run the check again after changes settle on a clean tree before carrying it forward.

Reuse an entry only when all are true:

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
Verification: [commands/checks + result; reused entries include scope identity]
Unverified: [none or specific gaps]
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
- remaining blockers in the claim's scope were fixed or rebutted
- remaining nits were fixed or rebutted, unless they are a major level of effort
- final status does not exceed evidence

Never defer a blocker. Defer a nit only if fixing it would be a major level of effort. When in doubt, include it. File that follow-up and name it in `Unverified` or `Final status`. Do not claim complete while blockers or ordinary nits remain.

Stop when evidence is sufficient for the exact claim. Continue when a missing check would materially affect correctness, buildability, user-visible behavior, data loss risk, or contract alignment.
