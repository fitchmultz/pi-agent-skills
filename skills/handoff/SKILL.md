---
name: handoff
description: "Write a paste-ready continuation or bounded delegation prompt when the user asks for /handoff continue, /handoff delegate, or a new-session handoff. Produces instructions; does not launch another agent."
---

# Handoff

Output only a self-contained handoff the user can paste verbatim, without code fences or commentary unless the user explicitly asks for surrounding explanation. Address the receiving agent directly in second-person imperative voice, as if the user is instructing it.

Use the current conversation, decisions, constraints, repo state, and evidence. Preserve relevant user and communication preferences. Summarize useful state, not the transcript or abandoned branches.

## Choose the mode

Obey an explicit mode. Otherwise infer:

- **Continue:** move the conversation to another session, model, or thread.
- **Delegate:** give another agent a bounded task to report back for review or integration.

Ask only if the wrong mode would materially change the result. This skill needs no delegation tool.

## Continue

- Start with exactly: `Continue the conversation from the previous session.`
- Include the goal, important decisions, constraints, relevant repo/worktree state, files or systems inspected, open questions, risks, and the most useful context for resuming.
- Include commands and verification status only when relevant to continuation.
- Optimize for continuity. Do not turn a planning conversation into an immediate execution order unless the user wants that.
- End with a plain separator line: `---`. End immediately after it, with no label, note, or placeholder.

## Delegate

- State the exact task first so the receiver can begin without more user text.
- Include necessary context, scope, non-goals, constraints, acceptance criteria, and verification requirements. If delegating from a plan, isolate only that slice.
- Preserve repo and architecture constraints. Give concrete paths and current evidence where needed.
- Require a concise, task-appropriate completion reply:
  - Always: outcome summary.
  - `Files changed`: only if files were modified.
  - `Verification`: only if commands or checks ran.
  - `Findings`: for research, review, or investigation.
  - `Open questions` or `Risks`: only if any remain.

Stop when the receiver can continue or execute without asking the user to reconstruct context. Do not force irrelevant report sections or vague instructions such as “take a look.”
