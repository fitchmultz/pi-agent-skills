---
name: ask-clarifying-questions
description: "Use this skill when material ambiguity would change scope, acceptance criteria, constraints, implementation path, safety, or reversibility and a user answer is needed before work can proceed. Do not use when quick repo/config discovery, current docs, or a reasonable stated default can resolve it."
---

# Ask Clarifying Questions

## Goal

Resolve only the ambiguity that would materially change the work, then let implementation proceed with the smallest useful set of answers or explicit assumptions.

## When to use

Use when the request is underspecified in a way that would materially change:

- objectives or acceptance criteria
- scope boundaries or constraints
- environment assumptions
- safety or reversibility
- user-owned tradeoffs where the wrong default would cause churn, data loss, cost, or unwanted behavior

## When not to use

Do not use for:

- questions a quick low-risk repo/config read or current docs/help can answer
- minor ambiguity that does not change the implementation path materially
- preference questions that are nice to know but not blocking
- situations where the user already explicitly approved reasonable defaults

## Workflow

1. Decide whether the request is materially underspecified. If a quick low-risk discovery read can resolve it, do that first instead of asking.

2. Ask only the must-have questions (prefer 1–3; hard max 8). Prefer questions that eliminate entire branches of work.

3. Make questions easy to answer:
- Prefer the harness question tool when available.
- Offer multiple choice or yes/no; put the recommended/default option first without labeling it recommended when order implies default.
- Do not add a custom/freeform option if the UI already provides one.
- Use multi-select only when more than one option is valid.
- In plain text, use numbered questions and a compact reply format such as `1a 2b 3defaults` when helpful.

4. Do not start implementation while must-have ambiguity remains. A labeled low-risk discovery step is allowed only if it does not commit a direction.

5. If the user wants to proceed without answers, state assumptions briefly and continue only when they confirm or a safe default does not materially change scope, safety, or acceptance criteria.

6. If answers materially change the plan, restate the clarified objective, key constraints, and success criteria before acting.

## Anti-patterns

- Broad open-ended questions when a tight option list would work
- Asking for information already in the repo/config/docs
- Starting implementation before resolving must-have ambiguity
- Over-questioning when one reasonable default would suffice
- Labeling a UI option as recommended when order already communicates the default
- Adding a custom-answer choice when the question UI supplies one automatically

## Stop rules

Ask only until the next implementation path is safe and clear. Stop when one reasonable default is enough, the repo can answer, or the user accepted assumptions.
