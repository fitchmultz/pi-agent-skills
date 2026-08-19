---
name: tdd
description: "Use this skill when the user asks to build or fix code test-first, practice red-green-refactor, add behavior/integration tests before implementation, or explicitly wants TDD. Do not use for ordinary final test runs, broad QA, post-hoc coverage padding, or debugging where the cause is still unknown and no test-first/regression-test request was made."
---

# Test-Driven Development

## Goal

Ship one observable behavior at a time with a failing test that proves the next minimal code change.

## Core rules

- Follow the repo's existing test command, framework, fixtures, and naming before adding anything new.
- Test behavior through public interfaces, not implementation details. Read `tests.md` when choosing or reviewing test style.
- Use vertical slices only: one failing test → minimal code → passing test → repeat.
- Do not write all tests first, then all implementation.
- Do not refactor while RED. Get GREEN first.
- Do not ask for approval unless the public interface, expected behavior, or behavior priority is materially ambiguous; otherwise state the assumption and start the first cycle.
- If debugging and the cause is still unknown, use root-cause triage first unless the user explicitly asked for test-first diagnosis or a regression test.
- A non-trivial regression test added or materially changed by this work needs an ablation receipt: the exact test fails for the expected reason against the broken implementation and passes against the fix. The original RED/GREEN commands qualify when that exact test exercised the reachable defect. When classification is uncertain, require the receipt.

## Workflow

### 1. Scope the next behavior

- Identify the public interface, existing test command, nearby test style, and smallest user/caller-visible behavior to pin.
- List only the behavior queue needed for the request; do not design a full suite up front.
- Prefer integration-style tests through real code paths. Read `mocking.md` before adding mocks, stubs, or test-only seams.

### 2. RED

- Add or update one test for one behavior.
- Run the narrowest meaningful command and confirm the test fails for the expected reason.
- If the test passes before code changes, sharpen the test or report that the behavior already exists.

### 3. GREEN

- Write the smallest code change that makes the current test pass.
- Run the same narrow command until it passes.
- Do not add speculative API, branches, config, fixtures, test helpers, or edge cases for later tests.

### 4. Repeat

Run one RED→GREEN cycle per remaining behavior. Each new test should reflect what the previous cycle proved.

### 5. Refactor while GREEN

Read `refactoring.md` before the cleanup pass. Remove duplication, improve names, and simplify structure only while tests are passing. Run tests after each meaningful refactor step.

### 6. Final validation

Run the relevant narrow tests plus the project’s normal affected test/lint/type/build gate when available. For each non-trivial regression test added or materially changed by this work, preserve the exact broken and fixed commands, revisions or tree states, and results as the ablation receipt. If RED was not captured before the fix, use an isolated `git worktree` that keeps the new test while restoring the pre-fix implementation; use a targeted revert only when it cannot affect unrelated user work. Never substitute a source-text assertion, weaken the assertion, or replace the real defect boundary with a self-fulfilling mock. Use the verification-before-completion skill before claiming completion.

## Stop rules

Stop and report the blocker only when:

- the public interface or expected behavior cannot be inferred safely;
- no reliable test command or runnable environment is available;
- RED fails for an unrelated cause that must be triaged first;
- continuing would overwrite unrelated user work or require a product choice.

Complete only when every requested behavior has RED/GREEN evidence, every non-trivial regression test added or materially changed by this work has a broken-then-fixed ablation receipt, refactoring is done or intentionally skipped, and validation evidence is fresh.

## Output

```md
Behavior:
Red:
Green:
Ablation:
Refactor:
Validation:
Skipped:
```

Include the command and result for each Red, Green, and Validation line. Use `Ablation: N/A` when this work adds or materially changes no non-trivial regression test; otherwise reference the qualifying `Red` and `Green` lines above or record both states, commands, and results. If the broken state cannot be reproduced, use `Ablation: blocked: [reason]` and report completion blocked. Use `Skipped: N/A` only when nothing material was skipped.
