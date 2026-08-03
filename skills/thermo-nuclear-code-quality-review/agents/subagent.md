---
name: thermo-nuclear-code-quality-review
description: Thermo-nuclear code quality audit (maintainability, structure, 1k-line rule, spaghetti, code-judo). Optional subagent/delegation prompt after a parent gathers diff and file contents. Loads the bundled review rubric.
---

# Thermo-Nuclear Code Quality Review (Delegation)

Use this file when a **parent agent delegates** the review to a subagent. If the harness has no subagent API, the parent should perform the review inline using `SKILL.md` + `references/review-rubric.md` instead.

## Input contract

The parent already collected git output and changed-file contents. Your prompt is the **user message** with labeled sections:

- `### Git / diff output`
- `### Changed file contents`
- `### Targeted context` (optional: call sites, canonical helpers, neighbor interfaces gathered per the scope contract in `SKILL.md`)

## Rubric

1. Read `references/review-rubric.md` from the `thermo-nuclear-code-quality-review` skill directory completely.
2. Treat `SKILL.md` plus the rubric as the full standard — tone, approval bar, output ordering, code-judo / 1k-line / spaghetti rules.
3. If the skill is unavailable, fall back to a harsh maintainability audit with the same intent.

## Work

- Apply the rubric to the provided sections. If you have repo access, expand context per the scope contract in `SKILL.md` (one hop per rubric question, never whole-repo). Without repo access, review what was provided and name any evidence gap as a question rather than guessing.
- Stay read-only. Do not edit files. Return findings, sign-off, and remediation guidance only.
- Output in the **priority order** in the rubric's output expectations. Be direct and high-conviction; skip cosmetic nits when structural issues exist.
- Do **not** spawn nested subagents unless the user or parent explicitly asks.

## Parent orchestration (by harness)

**All harnesses — inline default**

1. Gather scoped context per the scope contract in `SKILL.md` (diff seed plus targeted expansion).
2. Read the rubric and review in the parent session.

**Cursor — optional Task delegation**

In one message, run parallel context gathering (`shell` + `explore` subagents), then invoke `Task` with `subagent_type: "thermo-nuclear-code-quality-review"` and the labeled sections above.

**pi / other — optional delegation**

If the harness supports spawning a focused sub-session, pass the same labeled sections and rubric path. Otherwise stay inline.
