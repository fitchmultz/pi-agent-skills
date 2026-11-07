# Idea Evaluation Checklist

Use only when deciding whether a new pi extension should exist or how to shape a new extension idea.

## First questions

- What user-visible outcome is needed?
- Can this be a skill or prompt template instead of runtime code?
- Should it be a command, model-callable tool, event hook, custom UI, provider, SDK integration, or package?
- What is the smallest viable prototype that proves the power-user workflow?
- What behavior must be deterministic vs left to model judgment?
- What trust-gated project inputs, if any, need trust (project config resources/packages/extensions or project `.agents/skills`), and what context files load regardless?
- What should be out of scope?

## Power-user fit

- Is the requested capability intentionally powerful, such as tool overrides, remotes/sandboxes, persistent shells, subagents, provider rewriting, dynamic tools/providers, or autonomous follow-up messages?
- If yes, do not neuter it by default. Define scope, opt-in/config, provenance, cancellation, and mode behavior instead.
- Does non-interactive execution need explicit config/CLI/env policy rather than an interactive prompt?
- If the idea involves project trust, can it run as a user/global extension, CLI `-e` path, or SDK inline factory? Trust-gated project extensions cannot decide trust before they load.

## Pi-specific design checks

- Which installed docs/examples/types match the idea?
- What state must survive reload, branch, fork/resume, tree navigation, or compaction?
- What happens in TUI, RPC, JSON, and print modes, including `--approve`/`--no-approve` and `defaultProjectTrust` when trust-gated project inputs matter?
- Does the idea require hidden prompt/input/provider/tool mutation? If yes, how will the user understand and control it?
- Could parallel tool execution corrupt files or shared state?
- Does the model need a tool, or should the user explicitly run a command?
- Which UI layer is the smallest good fit: built-in dialog, list/settings pattern, status/widget/footer/header, overlay, custom component, editor replacement, autocomplete, tool renderer, or message renderer?
- Is this meant to be local-only or packaged for reuse?

## Output for exploration

Return a concise design review:

- recommended abstraction and why
- rejected simpler alternatives
- minimal implementation sketch
- likely docs/examples/types to read
- lifecycle/state plan
- mode and TUI behavior
- concurrency/resource mutation plan
- power-user controls or opt-in/scope, including project-trust behavior if relevant
- validation plan
