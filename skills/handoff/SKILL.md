---
name: handoff
description: "Use when the user asks for `/handoff continue`, `/handoff delegate`, a new-session continuation prompt, or a bounded delegation prompt. Output paste-ready instructions for the receiving agent."
---

# Handoff

Write output that the user can copy verbatim into another agent session.

## Goal

Produce a paste-ready handoff that preserves the useful context and gives the receiving agent a clear next move without extra wrapper commentary.

## Success criteria

- The mode is correct: continuation for session transfer, delegation for bounded parallel work.
- The receiving agent has the task, constraints, current state, evidence, open risks, and expected completion report needed to act.
- The output is concise enough to paste directly and detailed enough to avoid losing momentum.

## Core Rules

- Write directly to the receiving agent in second-person imperative voice, as if the user is speaking to it.
- Output only the handoff itself unless the user explicitly asks for explanation around it.
- Do not wrap the handoff in code fences.
- Be context-aware: use the current conversation, repo state, decisions, plan, and constraints.
- If the user explicitly names the mode, obey it. Otherwise infer the most likely mode from context.

Use `continue` when the user wants to move the current conversation to a new session, model, or thread.

Use `delegate` when the user wants another agent to perform a bounded task and then report back for review or integration in the current session.

If the mode is genuinely ambiguous and the wrong choice would materially change the result, ask a short clarifying question. Otherwise choose the likely mode and proceed.

## Continue Mode

Goal: produce a session-transfer handoff that preserves enough context for a new agent to continue naturally.

### Continue Output Contract

- Start with exactly: `Continue the conversation from the previous session.`
- Summarize the relevant state, not the entire chat transcript.
- Include the current goal, important decisions, constraints, repo/worktree state when relevant, files or systems already inspected, open questions, and the most useful current context for resuming.
- Preserve important user preferences and communication preferences when they matter to the next steps.
- End with a plain separator line: `---`
- End immediately after that separator with no trailing label, note, or placeholder text.

### Continue Style

- Optimize for continuity, not action pressure.
- Do not turn it into an immediate execution prompt unless the user clearly wants that.
- Keep enough detail to avoid losing momentum, but do not dump every explored branch or repeated back-and-forth.
- Mention commands run, tests run, or verification status only when they matter for the next session.

## Delegate Mode

Goal: produce a paste-ready prompt that another agent can act on immediately with no extra user text.

### Delegate Output Contract

- Write the prompt so the receiving agent can begin work immediately.
- State the exact task first.
- Include the necessary context, scope boundaries, constraints, acceptance criteria, and verification requirements.
- If the task comes from an existing plan, isolate only the delegated slice and make non-goals explicit.
- Include any repo-specific or architecture-specific constraints that must be preserved.
- Tell the receiving agent how to report completion in a structured but task-appropriate way that can be pasted back into the current session.

### Delegate Reply Contract

Require a concise, structured reply that adapts to the task:

- Always include a short outcome summary.
- Include `Files changed` only if code or files were modified.
- Include `Verification` only if commands, tests, lint, or type checks were run.
- Include `Findings` for research, review, or investigation work.
- Include `Open questions` or `Risks` only if they remain.

Do not force irrelevant sections for tasks like research-only delegation.

### Delegate Style

- Write as if the user is instructing that agent directly.
- Prefer imperative, action-oriented language.
- Make the prompt self-contained so the user can paste it without adding anything else.
- Avoid vague phrases like "help with this" or "take a look." Be explicit about what to do and what success looks like.

## Stop Rules

Stop once the receiving agent can continue or execute without asking the user to reconstruct context. Do not include transcript history, speculation, or branches that no longer affect the next step.
