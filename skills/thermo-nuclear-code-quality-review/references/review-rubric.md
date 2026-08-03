# Thermo-Nuclear Review Rubric

Read this reference when performing the review. Apply every section.

## Core prompt

> Perform a deep code quality audit of the current branch's changes.
> Rethink how to structure / implement the changes to meaningfully improve code quality without impacting behavior.
> Work to improve abstractions, modularity, reduce spaghetti code, improve succinctness and legibility.
> Be ambitious: if a clear path improves the implementation via restructuring, name it clearly.
> Be extremely thorough and rigorous. Measure twice, cut once.

This is a review standard. Stay read-only: return findings, sign-off, and remediation guidance only. If the user wants fixes, use a separate implementation step after the review.

## Non-negotiable standards

0. **Ambitious structural simplification** — search for "code judo" moves that delete complexity, not rearrange it.
1. **1k line files** — do not let a PR push a file from under 1k to over 1k without strong reason; prefer decomposition.
2. **No spaghetti growth** — suspicious of ad-hoc conditionals and special cases in unrelated flows; prefer dedicated abstractions.
3. **Clean design over "it works"** — push for cleaner structure when behavior can stay the same.
4. **Direct over magical** — flag brittle, generic, or pass-through abstractions that add indirection without clarity.
5. **Type and boundary cleanliness** — question `any`, unnecessary optionality, cast-heavy code; prefer explicit contracts.
6. **Canonical layer** — feature logic should not leak into shared paths; reuse canonical helpers.
7. **Orchestration smells** — unnecessary serialization; non-atomic partial updates when atomic structure is obvious.

## Primary review questions

- Code-judo move that makes this dramatically simpler?
- Reframe so fewer concepts, branches, or layers?
- Architecture improved or worsened?
- Branching where an abstraction should exist?
- Module more coupled or harder to scan?
- Logic in the right file/layer?
- File/component past healthy size?
- Repeated conditionals → missing model?
- Direct and legible vs special-case control flow?
- Abstraction earning its keep?
- Casts/optionality obscuring invariants?
- Logic in canonical layer?
- Orchestration more sequential than needed?

## Flag aggressively

- Complicated implementation where reframing deletes categories of complexity.
- Refactors that move code but not concepts in the reader's head.
- File crossing 1000 lines without decomposition plan.
- New conditionals on unrelated paths.
- One-off booleans/flags tangling control flow.
- Feature logic in general-purpose modules.
- Magic generics hiding simple structure.
- Thin wrappers / identity abstractions.
- Unnecessary `any` / casts / optional params.
- Copy-paste instead of helpers.
- Edge cases in already busy functions.
- Tests pass but readability/modularity regressed or remains structurally weak in the reviewed scope.
- "Temporary" branching becoming permanent debt.
- Bespoke helpers duplicating canonical utilities.
- Wrong package/layer for the concept.
- Obvious parallelization missed.
- Partial updates leaving half-applied state.

## Preferred remedies

Delete indirection; reframe state so conditionals disappear; fix ownership boundaries; simpler default flow; extract pure helpers; split large files; dedicated feature abstraction; typed dispatcher; separate orchestration from business logic; collapse duplicate branches; delete non-clarifying wrappers; reuse canonical helpers; explicit type boundaries; right package/layer; parallelize independent work; atomic update structure.

Do not settle for rename-only feedback when the issue is structural.

## Review tone

Direct and demanding—not rude. Example phrases:

- `this pushes the file past 1k lines. can we decompose this first?`
- `this adds another special-case branch into an already busy flow. can we move this behind its own abstraction?`
- `this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure.`
- `this feels like feature logic leaking into a shared path. can we isolate it?`
- `this abstraction seems unnecessary. can we just keep the direct flow?`
- `why does this need a cast / optional here? can we make the boundary more explicit instead?`
- `this looks like a bespoke helper for something we already have elsewhere. can we reuse the canonical one?`
- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this refactor moves complexity around, but doesn't really delete it. is there a way to make the model itself simpler?`

## Output expectations

Prioritize findings in this order:

1. Structural code-quality regressions
2. Missed opportunities for dramatic simplification / code-judo restructuring
3. Spaghetti / branching complexity increases
4. Boundary / abstraction / type-contract problems
5. File-size and decomposition concerns
6. Modularity and abstraction issues
7. Legibility and maintainability concerns

For each finding, include the path/line or changed hunk, why it is structural rather than cosmetic, and the preferred remediation. Prefer a smaller number of high-conviction comments over a long list of cosmetic notes.

## Presumptive blockers

- Preserved incidental complexity when code-judo could delete it
- File crosses 1000 lines due to PR
- Ad-hoc branching tangling existing flows
- Feature checks scattered across shared code
- Unnecessary wrapper/cast-heavy indirection
- Duplicated canonical helper or wrong layer

When a presumptive blocker is present, leave explicit actionable feedback and push for cleaner decomposition instead of approval.
