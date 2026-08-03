---
name: verification-before-completion
description: "Use this skill when the agent is about to claim work is complete, commit, open a PR, or say tests/lint/build pass. Verify the exact success claim with fresh evidence from diff cleanup, requirement checks, validation commands, runtime/manual checks, and contract/generated-surface alignment. Do not use for initial planning, speculative review, or root-cause debugging before a fix exists."
---

# Verification Before Completion

## Purpose

Make the final status claim match fresh evidence. This skill is the last gate before saying work is done.

## Core rule

No completion claim without current-cycle verification evidence.

If you did not run or inspect the check in this work cycle, do not claim it passes. If evidence proves only a narrower claim, report the narrower claim without pretending the original request is complete.

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

- tests pass → fresh test command with zero relevant failures
- lint/type/build pass → fresh command output and exit code 0
- bug fixed → original failing behavior no longer reproduces
- UI works → rendered/interactive inspection when relevant
- requirements met → requirement-by-requirement evidence map
- no tech debt left behind → diff sweep plus removal/resolution of each known shortcut or temporary stub

Static review does not prove runtime behavior. Green tests do not prove unmet requirements.

### 5. Run or inspect fresh verification

Run the relevant commands/checks now, or explain why they cannot run.

Inspect:

- exit code
- failures/errors
- skipped checks
- warnings that affect the claim
- whether the output actually proves the claim

If validation fails, own the triage. Fix high-confidence issues and rerun unless a real blocker prevents progress.

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
Verification: [commands/checks + result]
Unverified: [none or specific gaps]
Final status: [complete / incomplete / blocked, matching evidence]
```

For trivial docs-only or one-line changes, keep each line short. For goals or broad acceptance criteria, include a requirement-to-evidence map before `Final status`.

## Completion standard

Verification is complete only when:

- the exact claim is explicit
- local changes were swept for accidental debt
- authority/mirror surfaces are aligned, ruled out, or reported as blocked
- relevant fresh checks were run or accurately blocked
- output was read, not assumed
- final status does not exceed evidence

Stop when evidence is sufficient for the exact claim. Continue when a missing check would materially affect correctness, buildability, user-visible behavior, data loss risk, or contract alignment.
