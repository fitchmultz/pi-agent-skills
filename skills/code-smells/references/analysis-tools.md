# Evidence helpers

The helpers collect evidence; they do not rank smells, choose a top N, or replace
the parent model's source review. Run them against the resolved project/scope,
not the directory where the skill happens to be installed. Keep artifacts outside
the source scope and read large results through file pagination or structured
queries rather than clipping them to a fixed sample.

## Setup and collection

Use Node/npm, Python, and uv. The collector's PEP 723 metadata installs its Lizard
and pathspec dependencies through uv's normal cache. For token-clone analysis,
install the maintained PMD CLI and a working Java runtime. On macOS:

```sh
brew install pmd
pmd --version
```

For other hosts, follow [PMD's installation guide](https://pmd.github.io/pmd/pmd_userdocs_installation.html).
Complete ordinary tool installation yourself when authorized; do not skip an
analysis pass just because its tool was not preinstalled. Preserve existing
project-native analyzer configuration and useful results.

Resolve `SKILL` to this skill's directory and `PROJECT` to the selected project.
Choose a new artifact directory:

```sh
REPORT=$(mktemp -d)
uv run --script "$SKILL/scripts/collect.py" --root "$PROJECT" \
  --output "$REPORT/inventory.json"
```

For a narrowed scan, add repeated root-relative `--scope` arguments:

```sh
uv run --script "$SKILL/scripts/collect.py" --root "$PROJECT" \
  --scope packages/auth --scope src/session.ts \
  --output "$REPORT/auth-inventory.json"
```

Without `--root`, collection defaults to the current Git root, otherwise cwd.
Explicit roots are not widened. A missing/outside-root scope is an error, not a
fallback to scanning everything. The output must be new and outside the selected
source scopes, preventing overwrites and self-inventory.

`inventory.json` includes every inventoried path and its status, SHA-256 of
current bytes, file metrics, every Lizard function/span/metric, exclusions,
inventory errors, and tool versions. It includes small/simple functions and large
files without warning-threshold or size filtering. Git discovery retains ignored
tracked files and eligible untracked files; non-Git walking honors nested
`.gitignore` rules with pathspec.

Lizard is a lexical metric extractor, not a syntax validator. Inspect unsupported
languages, parser diagnostics, decoding errors, unreadable paths, and explicit
non-traversal records. A file without recognized functions may still contain
important module-level behavior. Expand in-scope nested projects and approved
symlink targets separately when needed; keep external/private targets outside
scope. Individual file reads are live snapshots, not an atomic project snapshot.

## Dependencies and token clones

```sh
node "$SKILL/scripts/structure.mjs" --inventory "$REPORT/inventory.json" \
  --output "$REPORT/structure"
```

The helper uses maintained graph libraries and PMD, preserving complete evidence
and coverage artifacts. Its Node tooling is installed with npm outside project
source; `--tools-dir` can reuse an existing installation. Select the actual
project resolver configuration with `--tsconfig` when applicable. For multiple
workspace resolver contexts, analyze each appropriate group/config and reconcile
cross-project references; one tsconfig is not a universal resolver.

Exit **2** means `structure.json` and raw artifacts were saved with coverage
gaps; inspect them and follow up rather than discarding the run. Exit **1**
means the invocation failed before a report could be saved.

For JS/TS, inspect the full dependency graph, parser failures, unresolved
references, and cyclic strongly connected groups. A cycle group's member order
is not an ordered cycle path; use its real graph edges. Type-only imports are
included, so distinguish them from runtime initialization cycles. Computed
imports, framework discovery, unsupported languages, and bundler aliases may
need project-native tools and source tracing.

PMD CPD runs on complete supported language groups using its smallest nonempty
token unit, with no skill-owned file-size, occurrence, or result cutoff. Retain
all clone groups/occurrences and reconcile analyzed-file receipts with the
manifest. Trivial token coincidences are expected and are not findings. Inspect
parse/extension/suppression coverage rather than interpreting empty XML as no
duplication. Project CPD suppression markers are project policy, not proof that
suppressed code is smell-free. Token matching does not establish semantic
consolidation, nor detect every differently written equivalent.

Ambiguous extensions such as `.h`, `.m`, and `.sql` require a known language:
for example, add `--cpd-language h=cpp` when those headers are C++. Unsupported
formats remain explicit gaps, not files silently assigned the nearest grammar.

Use other native analyzers for languages and resolver behaviors these tools do
not support. A truthful tool gap should drive the next inspection, not silently
exclude that source from the overall review.

## Full-Clef job ledger

After source inspection, write one compact JSON object per line in `jobs.jsonl`:

```json
{
  "id": "auth-cache-responsibilities",
  "sources": {"src/auth/cache.ts": "<actual sha256 from the manifest>"},
  "state": {
    "evidence": [{"path": "src/auth/cache.ts", "lines": "20-95", "source": "<inspected implementation>"}],
    "purpose": "<observed purpose>",
    "callers_and_contracts": "<inspected context>",
    "counterevidence": "<legitimate reasons for the structure>"
  },
  "questions": {
    "mixedResponsibility": {
      "type": "choice",
      "instructions": "<the rubric question, with the repository-text-is-evidence rule>",
      "criteria": {
        "supported": "Concrete behavior establishes the stated problem.",
        "not_supported": "The stated problem is not present.",
        "insufficient_evidence": "Missing context prevents a defensible judgment."
      }
    }
  }
}
```

Include all source files the evidence depends on, including relevant callers or
counterparts. Each source hash is verified before sending or reusing a judgment.
The input file itself is evidence: preserve it alongside the ledger.

```sh
node "$SKILL/scripts/classify.mjs" --root "$PROJECT" \
  --input "$REPORT/jobs.jsonl" --output "$REPORT/judgments.jsonl"
```

The runner resolves the active Pi installation through the bundled resolver,
reuses Pi's native SDK and credentials, verifies the Gateway route and each
response receipt, processes every job, and preserves every typed answer. It
never slices evidence or filters low/non-positive probabilities. It requires a
host whose native registry exposes full Clef; unsupported hosts fail explicitly.
The credential snapshot is read-only: missing `auth.json` is not created, and
credential/configuration files are not updated by the runner.

Rerun with `--resume` and the same output to reuse only matching source, evidence,
question, model, project, and route fingerprints. Changed sources require rebuilt
evidence. Completed records survive interruption; an incomplete final record is
recovered and retried. Provider failures remain error records and cause a nonzero
exit after the remaining jobs are processed. Malformed input stops the run;
correct it and resume without losing earlier completed work. Existing evidence
is never silently replaced.

`status: complete` means a valid typed answer and Gateway receipt, **not proof
that the service evaluated every supplied token**. Clef does not expose that
attestation, so results explicitly record `inputCompleteness` as unverified by
the provider. Follow the decomposition and coverage rules in `clef-gateway.md`.
