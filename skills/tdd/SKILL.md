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
- Preserve the exact RED/GREEN commands, code states, and results when they exercise the reachable defect. Reconstruct missing historical proof when practical; otherwise provide convincing verification and disclose the gap. This does not waive an explicit test-first requirement.

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

Run or reuse current evidence for the relevant narrow tests and the project’s required affected test/lint/type/build gates; do not duplicate still-valid checks. Preserve available broken and fixed commands, code states, and results. If RED was not captured, reconstruct it when practical in an isolated `git worktree` that keeps the test and restores the pre-fix implementation, or with a targeted revert that cannot affect unrelated work. If impractical, disclose the gap and provide convincing verification without claiming an unperformed test-first cycle occurred. Never substitute a source-text assertion, weaken the assertion, or replace the real defect boundary with a self-fulfilling mock. Use the verification-before-completion skill before claiming completion.

## Stop rules

Stop and report the blocker only when:

- the public interface or expected behavior cannot be inferred safely;
- no reliable test command or runnable environment is available;
- RED fails for an unrelated cause that must be triaged first;
- continuing would overwrite unrelated user work or require a product choice.

Complete only when the explicit test-first workflow was followed for every requested behavior, refactoring is done or intentionally skipped, and current validation supports the claim. Missing historical RED/GREEN proof alone is not a completion blocker when convincing verification and the gap are reported.

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

Include the command and result for each Red, Green, and Validation line. Use `Ablation: N/A` when this work adds or materially changes no non-trivial regression test; otherwise reference the qualifying `Red` and `Green` lines above or record both states, commands, and results. If the broken state cannot be reproduced, use `Ablation: not reproduced: [reason]` and report the other convincing verification. Do not block solely on missing historical proof; disclose any unmet explicit test-first requirement separately. Use `Skipped: N/A` only when nothing material was skipped.
