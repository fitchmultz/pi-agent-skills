---
name: code-smells
description: "Detect and list code smells in the current project or a user-selected directory, file, or subsystem. Read-only analysis with bundled evidence helpers and full Cloudflare Clef through AI Gateway. Use for smell inventories, duplication, tangled dependencies, and low cohesion; the parent model ranks findings and honors requests such as top 10. Not automatic refactoring or a diff-only PR review."
compatibility: "Node 24, Python 3.10+, uv, PMD/Java for clone evidence, and Pi with authenticated native full Clef routed through Cloudflare AI Gateway."
---

# Code Smells

Find maintainability problems from code and its callers, not arbitrary size or
confidence thresholds. Borrow Orrery's useful separation of structural evidence
and semantic judgment, not its indexing budgets, sampling, or smell cutoffs.
The parent model owns investigation, corroboration, ranking, and the final list.

Keep project source read-only. Write analysis artifacts outside the source scope;
do not refactor, delete files, change project configuration, or open issues unless
requested. If fixes are also requested, record findings first, then continue the
authorized fixes as a separate step. Routine analysis-tool setup is part of the
work, not a reason to hand the user installation chores.

## Scope and requested output

- Default to the current repository root, or the working directory outside Git.
  Analyze current on-disk contents, including tracked changes and non-ignored
  untracked source. A clean diff says nothing about project-wide smells.
- A supplied path, set of paths, symbol, or named subsystem narrows the scan.
  Resolve its actual implementation paths from project evidence. Never silently
  replace an invalid target with a whole-project scan.
- Read project instructions, manifests, entrypoints, and existing analysis
  tooling. Briefly state the resolved scope; ask only when discovery leaves
  materially different targets unresolved.
- Read outside callers, dependencies, and duplicate counterparts as needed to
  establish an in-scope finding, without adding unrelated out-of-scope findings.
- A request such as **“give me the top 10” limits presentation, not analysis**.
  Investigate the full requested scope before ranking and selecting the final
  list. Helpers must not use it as a file, candidate, or classifier-call cap.
  Do not invent extra findings to fill a requested count.

```text
/skill:code-smells
/skill:code-smells packages/server/src/auth
/skill:code-smells focus on session storage and token refresh
/skill:code-smells give me the top 10
```

## Collect and investigate

Read `references/analysis-tools.md` for executable helper commands and coverage
contracts, and `references/smell-rubric.md` for the judgment criteria.

1. Run `scripts/collect.py` for a complete file/function inventory with source
   hashes, spans, and raw metrics. It uses Lizard's source API, not its
   warning-threshold filter. Inspect every coverage status and exclusion; no
   size, function count, complexity score, filename, or generic directory name
   is a reason by itself to stop investigating authored code.
2. Use `scripts/structure.mjs` and applicable project-native analyzers for full
   graph and clone evidence. Preserve their complete artifacts. Resolve actual
   parser, language, alias, suppression, and dependency gaps rather than treating
   an empty result or successful exit as proof of clean code. Reuse valid
   existing analysis instead of needlessly repeating it.
3. Review the source across every in-scope subsystem, including module-level
   code and supported/unsupported parser cases. Raw metrics and clone matches
   help organize the work; they do not decide which files deserve semantic
   review. Inspect responsibilities, state ownership, control flow, contracts,
   caller behavior, and cross-subsystem duplication. Search for differently
   written equivalents as well as token clones.
4. Check exports, framework discovery, scripts, dynamic registration, and
   external consumers before calling code unused. Confirm dependency edges and
   distinguish type-only from runtime coupling. Read all implementations and
   intentional differences before recommending consolidation.
5. Track completed and unresolved review areas against the manifest and source
   hashes. For large projects, partition by real responsibilities and delegate
   useful independent work, then reconcile cross-part interactions. Inspect
   relevant nested projects/submodules or safe symlink targets separately when
   they belong to the requested scope; a collector non-traversal record is not
   permission to forget their code.

There are **no skill-owned top-N, file-size, file-count, function-count,
source-head, call-count, hop, confidence, time, or spend cutoffs**. Existing
project policies remain project policies and must be labeled as such. Exclude
irrelevant dependencies, generated/vendored/minified output, binaries, lockfiles,
and data-only artifacts by their actual role, not a numeric shortcut. Keep
exclusions visible. Never send credentials or unrelated private material to Clef.

## Semantic judgments with full Clef

Read `references/clef-gateway.md`. Use full `@cf/cloudflare/clef` through Cloudflare
AI Gateway; no Flash, chat-model, OpenRouter, or ungated fallback.

Use `scripts/classify.mjs` to process candidate JSONL jobs with verified source
hashes and a resumable ledger. Supply source, locations, purpose, relevant
imports/callers, contracts, and counterevidence. Use the rubric's explicit
`supported`, `not_supported`, and `insufficient_evidence` choices. Preserve all
answers; no probability cutoff admits or discards findings.

Actual model/service limits require decomposition, not omission. Partition
large evidence at logical boundaries, inspect every part, and reconcile their
interactions. Do not send only a file head or rely on service truncation. Clef
does not attest that all supplied text was evaluated; a successful response is
not proof of complete source coverage. Obtain missing context and retry
unassessed jobs when the cause is resolved. Continue independent local work.

Clef judges supplied evidence; it does not discover facts or generate the
explanation. The parent model verifies its judgments against the code and
explains the maintenance consequence. Keep measured facts, heuristic candidates,
and semantic findings distinct. Provider errors and insufficient evidence are
unresolved work, never negative smell judgments or a clean bill of health.

## Rank and report

Consolidate symptoms of the same cause and rank corroborated findings by actual
maintenance impact. Apply any user-requested output count here, after analysis;
otherwise do not impose a default number. Avoid style nits and speculative
rewrites.

For each finding give its impact and category, `path:line` evidence (all relevant
sides for duplication or a cycle), why the structure makes changes harder or
riskier, and the smallest useful improvement. Attribute analyzer/Clef evidence
and disclose material uncertainty; probabilities are not severity or proof.

Close with the scope actually reviewed, exclusions, analysis/clef coverage,
remaining gaps, and artifact paths when useful. If there are no supported
findings, say so only for the inspected evidence. A requested top-10 report can
have complete analysis behind it; a short report must never conceal a partial
scan.
