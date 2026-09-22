# Skill evaluations

The bundle has two separate checks: offline package/runtime tests and opt-in model evaluations. Passing discovery or a mocked-provider test does not establish skill quality.

## Offline checks

```bash
npm ci --ignore-scripts
npm test
npm run smoke
npm run pack:check
```

The native evaluation tests drive real Pi sessions, skill expansion, tools, filesystem changes, and a failing-then-passing Node test. Only their model stream is scripted. They also check cancellation, provider failures, manual-only skills, routing, and rejected writes. They run without model credentials, including through the compatibility workflow's independent host installations.

## Model access

Live evaluations use the selected host's `ModelRuntime` and configured Pi credentials. The default is `openai-codex/gpt-6-astra` at `max` thinking. Use `--provider openai` for an API key. The exact model must be available; there is no model or provider fallback. A run records the effective model limits and thinking level rather than assuming the vendor's advertised limits apply to this host.

```bash
npm run eval:model -- --case clarify-and-continue
npm run eval:model -- --provider openai --suite held-out
```

Set `PI_HOST_INDEX` to another installed host's absolute `dist/index.js` to evaluate that host with its own dependencies. `PI_COMPAT_HOST` labels the report. Do not mix package dependencies or modify a running Pi installation.

The manual **Skill model evaluations** GitHub workflow uses the pinned official host and requires the repository's `OPENAI_API_KEY` secret. It is separate from required offline PR checks. Missing credentials fail an explicitly requested model run; they do not silently skip it. No credentials are bundled or provisioned by this repository.

## Controlled comparisons

Keep both skill directories unchanged while comparing them:

```bash
npm run eval:model -- \
  --baseline /absolute/baseline/skills \
  --skills /absolute/candidate/skills \
  --suite behavior --repeat 2 --jobs 4 \
  --out .eval-results/behavior.jsonl

npm run eval:model -- \
  --baseline /absolute/baseline/skills \
  --skills /absolute/candidate/skills \
  --suite routing --jobs 4

npm run eval:model -- \
  --baseline /absolute/baseline/skills \
  --skills /absolute/candidate/skills \
  --suite held-out --repeat 2 --jobs 4
```

Repeat the commands with each supported host. Use the same provider, thinking level, profile, cases, deadline, and concurrency for both variants. Variants run consecutively for each case, reversing order on alternate repetitions. Parallel jobs use separate disposable workspaces and sessions.

The default profile has no ambient instructions, extensions, or skills. Add `--profile evals/profiles/authorized.md` to exercise the documented caller policy. It supplies scope, approval, review, and evidence-reuse rules without granting access to real remote systems. Intentional policy changes must be identified separately from wording optimizations; compare equivalent policies when claiming an optimization.

`--no-skills-control` adds a behavior-suite control using the same tasks and tools without skill discovery or slash-command expansion. It helps distinguish useful skill instructions from behavior the model already provides. `--case ID` and `--skill NAME` narrow a run. Each case has a five-minute default deadline; set `--timeout` in milliseconds when needed and report the change.

## What the suites measure

| Suite | Boundary |
| --- | --- |
| `behavior` | Task outcomes across all twelve skills: explicit invocation, natural selection, questions and continuation, read-only scope, actual code edits and RED/GREEN tests, truthful evidence, review findings, merge holds, and image inspection. |
| `routing` | Existing `skills/*/evals/trigger-evals.json` prompts through native discovery. This measures skill selection, not complete task execution. |
| `held-out` | Independently written routing prompts, kept separate from the existing trigger examples. `bro` is deliberately absent from automatic discovery and is tested by explicit invocation in the behavior suite. |

The native SDK and live provider are real. Browser, GitHub merge, delegation, and question tools are deterministic fixtures. Browser screenshots are generated locally and opened through Pi's native image-reading tool. They do not prove a live website, authenticated browser extension, remote reviewer, or GitHub operation works. The report retains the images actually read by the model in its adjacent `.artifacts` directory; temporary workspaces are removed. Existing helper tests and separate real integration checks cover those boundaries where applicable. Image cases require `rsvg-convert` from librsvg; missing prerequisites fail rather than count as passes.

Fixture Bash supports a declared command list, with real Git inspection and isolated Node test execution. Native file tools are restricted to fixture files and read-only skill/runtime sources. Graders and trigger expectations are not supplied to the evaluated agent. Node permissions restrict filesystem access and subprocesses, but do not prevent networking. Run only trusted bundle changes: this is an evaluation fixture, not a sandbox for hostile model-written code. The browser and merge fixtures themselves never call their named remote services.

## Results and interpretation

Each JSONL report contains run settings, host identity, harness and skill hashes, case outcomes, tool traces, command outputs, changed fixture contents, provider-request metadata, token usage, elapsed time, and a summary. It never records authorization headers or credential values. Files are created exclusively so a new run cannot overwrite old evidence. Source changes invalidate a comparison.

Candidate failures produce a nonzero exit status. Baseline and no-skills failures remain in the report rather than being hidden. Inspect failures before attributing them to a skill: fixture defects, authentication failures, and deadlines are different from incorrect agent behavior. Do not remove a failed case or weaken its requirement to improve the score.

Compare successful task outcomes first, then unnecessary questions, repeated checks, tool calls, token use, and elapsed time. Provider caching, load, and nondeterminism affect costs and timings; use repetitions and inspect traces. Small synthetic suites support bounded claims, not a guarantee of general reliability. Publish exact counts and any remaining failures or untested boundaries alongside an optimization claim.
