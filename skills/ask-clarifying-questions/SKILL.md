---
name: ask-clarifying-questions
description: "Resolve material ambiguity that needs a user decision before dependent implementation: scope, acceptance, constraints, safety, or reversibility. Skip questions answerable from repo/config discovery, current docs, or already-approved defaults."
---

# Ask Clarifying Questions

Resolve only decisions that materially change the work. Discover facts from the repo, configuration, or current docs before asking the user; do not reopen approved defaults or ask nonblocking preference questions.

## Workflow

1. Identify the must-have decisions about objectives, acceptance, scope, environment, or user-owned tradeoffs. Ask only questions whose wrong answer would change implementation, cause churn, cost, data loss, or unwanted behavior.
2. Ask the smallest useful set: prefer 1–3 questions, hard maximum 8. Favor questions that eliminate whole branches of work.
3. Prefer the harness question tool when installed and usable. `ask_question` is an optional extension, and its dialogs need TUI or an RPC client that answers them; plain print mode is not a dialog surface. Otherwise ask in plain text.
4. Make answers easy:
   - Prefer multiple choice or yes/no; put the recommended/default option first without labeling it recommended.
   - Do not add a custom-answer option when the UI supplies one.
   - Use multi-select only when multiple answers are valid.
   - In plain text, number questions and offer a compact reply format such as `1a 2b 3defaults` when useful.
5. Pause only implementation that depends on unresolved must-have ambiguity. Continue independent authorized work, including discovery that can resolve the question.
6. If the user wants to proceed without answers, state assumptions briefly. Continue only when they confirm or a safe default does not materially change scope, safety, or acceptance.
7. If answers materially change the plan, restate the clarified objective, constraints, and success criteria before acting.

Stop asking once the next implementation path is clear. Do not turn clarification into a survey or ask the user to rediscover available facts.
