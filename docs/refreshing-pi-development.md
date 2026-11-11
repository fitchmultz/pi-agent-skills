# Refresh the `pi-development` skill

This procedure brings `skills/pi-development/` up to the latest official Pi release and the latest `fitchmultz/pi` `main` commit. One run produces at most one pull request and merges it. A scheduled agent follows the procedure every day. Anyone can also follow it by hand.

Work only in `fitchmultz/pi-agent-skills`. The commands use `git`, `npm`, Node 24.21.0 or later, and the GitHub CLI `gh`. If your environment has a GitHub tool in place of `gh`, use its matching action. The conditions stay the same. Your environment supplies the Git identity for commits and the credentials for `git push`. If a commit or a push fails because one is missing, report `blocked`.

## The stamp

The stamp is two lines in the frontmatter of `skills/pi-development/SKILL.md`:

```yaml
metadata:
  last-verified-pi: "<official release, X.Y.Z>"
  fork-source: "<fitchmultz/pi main commit, 40 hexadecimal characters>"
```

The stamp records the official release and the fork commit that the skill was last checked against. The same pair is the floor: the skill supports nothing older.

No other place records the pair. These places repeat a stamp value, and `npm test` fails when one of them differs from the stamp:

| Place | Value |
| --- | --- |
| `skills/pi-development/SKILL.md` and `skills/pi-development/references/**/*.md`: every version and every commit ID outside the Component table | Official release, fork commit |
| `package.json` (`devDependencies`) and `package-lock.json`: `@earendil-works/pi-coding-agent` | Official release |
| `README.md`, `skills/clef/SKILL.md`, and `skills/code-smells/references/clef-gateway.md`. The test also reads `AGENTS.md` and every other Markdown file under `docs/` and `skills/` for the text `Pi X.Y.Z`. | Official release |

`CHANGELOG.md`, `docs/evaluation-results.md`, and the prompts in `skills/pi-development/evals/*.json` keep the versions that they describe. The tests do not read them.

Inside the skill, the tests accept three other kinds of number. The Component table in `references/current-version-hazards.md` holds the versions of other components. A commit of `earendil-works/pi` is written as ``Upstream `<id>` ``. `metadata.version` is the version of the skill text.

## Rules

You may change these files and no others:

- Files under `skills/pi-development/`, except `scripts/`.
- `test/pi-development.test.mjs`.
- `test/pi-development-facts.test.mjs`: only the `notHostNames` list.
- The places in the table above, only to make a value equal to the stamp. `package-lock.json` also takes every change that the `npm install` command in step 4 writes.

Never do any of these:

- Move the stamp before you have read the changes between the old stamp and the new stamp (step 3).
- Force-push, rebase, or amend a pushed commit.
- Open a second pull request while one from `refresh/pi-development` is open.
- Change `name` or `description` in the frontmatter, or a file under `scripts/`.
- Merge with auto-merge, with an administrator bypass, or while a condition in step 8 is false.
- Resolve a review conversation without a reply. Dismiss a review.
- Change repository settings, rulesets, workflows, or another repository.
- Weaken or delete a test to make the gate pass.

The refreshed text keeps two rules from the owner:

- **Latest only.** The skill targets the latest official release and the latest fork `main`. It never describes or supports a host older than the stamp. Do not add shims, fallbacks, or notes for older hosts.
- **Best on the fork, complete on official Pi.** The owner runs only the fork. Decide which API, default, or pattern is best by its behavior on fork `main`. Every extension must still work on official Pi. When the best path is fork-only, the text also gives the complete path for official Pi.

## Facts that `npm test` checks

`test/pi-development-facts.test.mjs` reads every code span in the Markdown files under `skills/pi-development/`, outside fenced code. It looks up each fact in the Pi package of one host:

| Fact in a code span | Examples | The host has the fact when |
| --- | --- | --- |
| A name in camelCase or PascalCase, or with an underscore. In a dotted path, each such part is one name. | `ctx.managedHost`, `session_shutdown`, `PI_OFFLINE=1` | A declaration file (`*.d.ts`) contains the name as an identifier, or a JavaScript file contains it as a whole quoted string or as an upper-case identifier, or a file in `schemas/` has it as a property name. The files are those of the coding agent and of the `@earendil-works` packages that it depends on. The TypeBox that Pi bundles adds its declaration files. |
| A documentation file, with or without a heading | `docs/extensions.md`, `docs/extensions.md#background-tool-runs` | `docs/` in the coding-agent package has the file, and the file has the heading. |
| A schema file | `schemas/settings.schema.json` | `schemas/` in the coding-agent package has the file. |
| The bundled TypeBox version and `engines.node` in the Component table | `1.3.27` | The `package.json` files of the host state the same value. |

The check does not read a plain lowercase word such as `read`, an acronym, fenced code, or a statement about behavior. Step 4 covers those.

Each run has one host:

| Run | Host | What must be true |
| --- | --- | --- |
| `npm test` in your clone | The development SDK: the official release in `package.json` | The same as the `official` check. The output shows the fork rule as skipped. |
| `official` check | The latest official release | The host has every fact that has no fork-only mark, and has no fact that has the mark. |
| `fork` check | The `main` commit of `fitchmultz/pi` at the time of the check | The host has every fact. |

### The fork-only mark

The mark is this exact text:

```markdown
<!-- fork-only -->
```

Write the mark directly after the closing backtick of a code span, with no space between them:

```markdown
- **Process restart:** `ctx.managedHost`<!-- fork-only -->, `ManagedHost`<!-- fork-only -->, `docs/restart.md`<!-- fork-only -->.
```

- The mark states that official Pi does not have the fact. It applies to the last part of the span: the last name of a dotted path, or the heading of a documentation link. In `` `AgentSession.getBackgroundWork()`<!-- fork-only --> ``, the mark covers `getBackgroundWork`, not `AgentSession`.
- Mark a fact one time, in the sentence that states that only the fork has it. All other mentions of the fact in the skill then count as fork-only.
- Mark only a fact from the first table. A mark fails the check after a span such as `` `pi restart` ``, and after a path whose last part is a plain word, such as `` `pi.runtime` ``.

### Answer a failure of the check

The message gives each skill line, the fact, and the place in the host package where the check looked. Find the fact in the fork clone from step 3 before you change a line:

```bash
git -C "$fork_dir" grep -n 'someName' "$fork" -- packages          # the fork
git -C "$fork_dir" grep -n 'someName' "v$official" -- packages     # official Pi
```

| Message | Cause | Action |
| --- | --- | --- |
| `The skill cites facts that the fork X.Y.Z does not have` | The fork removed or renamed the fact, or the skill line was wrong. | Correct the line, or remove the statement. Do not add the mark. |
| `The skill cites facts that official Pi X.Y.Z does not have` | The fork has the fact and official Pi does not. | Add the mark to one mention, and make sure that the statement says that only the fork has the fact. |
| The same message | No host has the fact. | Correct the line, or remove the statement. |
| The same message | The name does not belong to Pi: a tool of another package, a field of `package.json`, a shell variable of a recipe, or a name that the skill says no host has. | Add the name to `notHostNames` in the test file. Use the group whose reason fits, or add a group with its reason. |
| `The skill marks facts as fork-only that official Pi X.Y.Z has` | Official Pi released the fact. | Remove every mark from the fact, and move its statement to the shared contracts. |
| `The skill states bundled versions that differ from` the host | The Component table has an old value. | Write the value of the host into the row. |
| `a mark does not directly follow a code span`, or `the mark covers no fact that this check reads` | The mark is in the wrong place. | Move the mark to a code span that holds a fact from the first table, or remove the mark. |

Never add to `notHostNames` a name that a Pi package holds. Never add the mark to a fact that the fork does not have.

The `official` and `fork` checks resolve their hosts when they run. A check can thus test a release or a commit that is newer than `official` or `fork`. If a check reports a line that is correct at `v$official` and at `$fork`, the host changed after step 1. Read the newer source, and correct the line or remove the statement. The stamp stays at `official` and `fork`.

```bash
git -C "$fork_dir" fetch --quiet --filter=blob:none origin main    # for a newer official release, fetch its tag as in step 3
git -C "$fork_dir" grep -n 'someName' FETCH_HEAD -- packages
```

## Procedure

### 1. Read the stamp and the hosts

Start at the current `main` of this repository:

```bash
git clone https://github.com/fitchmultz/pi-agent-skills.git && cd pi-agent-skills
# In an existing clone: git fetch origin && git switch --detach origin/main
```

Then read the four values:

```bash
stamp_official=$(sed -n 's/^  last-verified-pi: "\(.*\)"$/\1/p' skills/pi-development/SKILL.md)
stamp_fork=$(sed -n 's/^  fork-source: "\(.*\)"$/\1/p' skills/pi-development/SKILL.md)
official=$(npm view @earendil-works/pi-coding-agent version)
fork=$(git ls-remote https://github.com/fitchmultz/pi.git refs/heads/main | cut -f1)
```

`stamp_official` and `official` are versions such as `X.Y.Z`. `stamp_fork` and `fork` are 40-character commit IDs. If a value is empty or has another shape, stop and report `blocked`. Change nothing.

Use `official` and `fork` for the whole run. Do not read them again, even when the fork moves during the run.

### 2. Find the state of earlier work

```bash
git ls-remote --exit-code origin refs/heads/refresh/pi-development
gh pr list --repo fitchmultz/pi-agent-skills --head refresh/pi-development --state open --json number,url,headRefOid
```

| Branch on `origin` | Open pull request | Action |
| --- | --- | --- |
| No | No | If `official` equals `stamp_official` and `fork` equals `stamp_fork`, report `current` and stop. Otherwise run `git switch -c refresh/pi-development origin/main` and continue at step 3. |
| Yes | Yes | Continue that pull request. Follow the steps below this table. |
| Yes | No | Read the newest pull request from the branch: `gh pr list --repo fitchmultz/pi-agent-skills --head refresh/pi-development --state all --limit 1 --json number,state`. If there is none, an earlier run stopped before it opened the pull request: continue the branch. If its state is `MERGED`, delete the branch with `git push origin --delete refresh/pi-development` and use the first row. If its state is `CLOSED`, a person closed it: report `blocked` and change nothing. |

To continue a branch:

1. Run `git switch refresh/pi-development`, then `git merge --ff-only origin/refresh/pi-development`.
2. If `origin/main` has commits that the branch lacks, run `git merge origin/main`. Resolve each conflict so that every file outside your scope matches `origin/main`.
3. Read `stamp_official` and `stamp_fork` again, now from the branch.
4. If `official` or `fork` differs from the stamp on the branch, continue at step 3. The new work is one more commit on the branch.
5. If both are equal and you merged `origin/main`, continue at step 5.
6. If both are equal and you merged nothing, continue at step 7 when a pull request is open, and at step 6 when none is open. Step 7 covers a head commit whose checks failed.

### 3. Read what changed

A partial clone of the fork is enough. It downloads about 15 MB, and later commands fetch only the files that they read.

```bash
fork_dir=$(mktemp -d)
git clone --quiet --filter=blob:none --no-checkout https://github.com/fitchmultz/pi.git "$fork_dir"
git -C "$fork_dir" fetch --quiet --no-tags --filter=blob:none https://github.com/earendil-works/pi.git \
  "refs/tags/v$stamp_official:refs/tags/v$stamp_official" "refs/tags/v$official:refs/tags/v$official"
git -C "$fork_dir" merge-base --is-ancestor "$stamp_fork" "$fork"
```

If the last command fails, the stamp commit is not in the history of fork `main`. Stop and report `blocked`.

Read all of these diffs completely:

```bash
# The fork: package changelogs, then the fork inventory, docs, and schemas.
git -C "$fork_dir" diff "$stamp_fork" "$fork" -- 'packages/*/CHANGELOG.md'
git -C "$fork_dir" diff "$stamp_fork" "$fork" -- FORK.md packages/coding-agent/docs packages/coding-agent/schemas

# Official Pi: the release notes of every release after the stamp, with docs and schemas.
# This diff is empty when official equals stamp_official.
git -C "$fork_dir" diff "v$stamp_official" "v$official" -- 'packages/*/CHANGELOG.md' packages/coding-agent/docs packages/coding-agent/schemas
```

A changelog entry is one bullet that a diff adds, changes, or removes. List every entry. The list becomes the body of the pull request in step 6.

Read source in the same clone when you check a statement:

```bash
git -C "$fork_dir" show "$fork:packages/coding-agent/docs/extensions.md"       # a file on fork main
git -C "$fork_dir" grep -n 'someName' "$fork" -- packages                    # a name on fork main
git -C "$fork_dir" grep -n 'someName' "v$official" -- packages               # the same name in the official release
```

### 4. Change the skill

For each entry, find the statements that it affects. Search the skill for every name in the entry:

```bash
grep -rn 'someName' skills/pi-development
```

Then apply the first case that fits:

| The entry | Change |
| --- | --- |
| Makes a statement in the skill wrong | Correct the statement. |
| Removes something that the skill names | Remove the statement. Do not describe what the older host did. |
| Ships in official Pi something that the skill marks as fork-only, or lists in the "After" section of `references/current-version-hazards.md` | Move the statement to the shared contracts. Remove every `<!-- fork-only -->` mark from the fact. |
| Adds or changes an API, event, setting, tool, or behavior that an extension author must know | Add it to the reference that owns the topic. `SKILL.md` lists the references and their topics. |
| Affects no extension author | Change nothing. Record `no change needed` with a reason of a few words. |

Follow these rules for every statement that you write or keep:

- Check the statement against the declaration or the implementation at `$fork`, and at `v$official` when the statement covers official Pi. A changelog entry tells you where to look. It is not the evidence.
- Say which host the statement covers: both, or the fork only. For a fork-only capability, keep or add the complete path for official Pi.
- Mark each name, documentation file, and heading that only the fork has. [The fork-only mark](#the-fork-only-mark) gives the exact form.
- Place a capability that `v$official` lacks by its origin. If `FORK.md` at `$fork` lists the capability, it belongs in "Fork-only capabilities". If not, the fork merged it from upstream before a release: it belongs in the "After" section, with its source cited as ``Upstream `<commit ID>` ``.
- Keep `SKILL.md` below 500 lines. Put detail in the reference that owns the topic.
- When a fact that `skills/pi-development/evals/evals.json` expects has changed, correct that `expected_output`. Keep every evaluation ID. Keep the versions in prompts that describe a migration.

Then raise the numbers:

1. In the Component table of `references/current-version-hazards.md`, write the current release of each component. For an npm package, run `npm view <package> version`. For a Git package, read `package.json` on its default branch. For a version that Pi bundles, read `packages/coding-agent/package.json` at `$fork` and at `v$official`.
2. When `official` differs from `stamp_official`, write the new release into the "After" section of that file: its heading, its text, its table header, and the link to the section in "Targets and floors". Keep only the rows that the new official release still lacks. If no row remains, remove the section and the link.
3. Move the stamp: write `official` and `fork` into the two frontmatter lines. Raise the patch number of `metadata.version`.
4. When `official` differs from `stamp_official`, raise the development SDK and the other repeats:

   ```bash
   npm install --ignore-scripts --save-dev --save-exact "@earendil-works/pi-coding-agent@$official"
   node --test test/pi-development.test.mjs
   ```

   The test output names each file and line that still differs from the stamp. Correct each one.

### 5. Run the gate

```bash
npm ci --ignore-scripts
npm test
npm run smoke
npm run pack:check
```

Every command must exit with status 0. Correct the skill, not the test. Two lists in the tests follow the skill:

- The list of reference files and evaluation IDs in `test/pi-development.test.mjs` follows a file or an ID that you added or renamed.
- `notHostNames` in `test/pi-development-facts.test.mjs` follows a name that does not belong to Pi.

`npm test` looks up the facts that the skill cites in the development SDK, which is official Pi. When it fails in `test/pi-development-facts.test.mjs`, follow [Answer a failure of the check](#answer-a-failure-of-the-check). Only the `fork` check in step 7 looks up the facts in the fork.

`npm test` also runs the helper tests of other skills. Those tests need Python 3, `uv`, and PMD with Java. [Maintaining the skills](maintaining-skills.md#validation) lists the tools. Install a missing tool when you can. If you cannot, you may accept a failure only in `test/code-smells-collect.test.mjs` or `test/code-smells-structure.test.mjs`, and only when the error names the missing tool. Name those files in the pull request body. The `official` and `fork` checks run them.

### 6. Commit, push, and open the pull request

```bash
git add -A
git diff --cached --name-only        # every path must be in your scope
git commit -m "Refresh pi-development to Pi $official and fork $(printf %.9s "$fork")"
git push origin refresh/pi-development
```

Skip the commit when nothing changed. If no pull request is open, open one against `main`, ready for review. If one is open, update its title, correct the first sentence of its body, and add the new entries to its table.

- **Title:** `Refresh pi-development to Pi <official> and fork <first 9 characters of fork>`
- **Body:** these sections. Together they cover the whole range from the stamp on `main` to the new stamp.

```markdown
Refresh `pi-development` from official Pi `<official release of the stamp on main>` and fork `<fork commit of the stamp on main>` to official Pi `<official>` and fork `<fork>`.

## Changelog entries

| Source | Entry | Skill change |
| --- | --- | --- |
| fork `packages/coding-agent/CHANGELOG.md` | <the entry in one line> | `references/<file>.md:<line>`: <what changed> |
| official `packages/ai/CHANGELOG.md` | <the entry in one line> | no change needed: <reason> |

## Docs, schemas, and FORK.md

<One line for each changed file: the skill line that it changed, or "no change needed".>

## Numbers

<The Component table rows that changed, and the repeats of the stamp that changed.>

## Checks

<Each gate command with its exit status. Each test file that the environment could not run.>
```

List every entry, including each entry that needs no change. If both diffs in step 3 are empty, write that sentence in place of the table. The pull request adds no entry to `CHANGELOG.md`: its body is the record.

### 7. Wait for the four checks and answer every finding

Four checks must complete on the head commit of the pull request:

| Check | App that reports it |
| --- | --- |
| `official` | GitHub Actions (`15368`) |
| `fork` | GitHub Actions (`15368`) |
| `Pi Durable Review` | Pi Durable (`5180273`) |
| `Cursor Automation: PR Bug Review - Maintained Repos` | Cursor (`1210556`) |

```bash
pr=<number of the pull request>
head=$(git rev-parse HEAD)
gh api "repos/fitchmultz/pi-agent-skills/commits/$head/check-runs?per_page=100" \
  --jq '.check_runs[] | [.name, .app.id, .status, (.conclusion // "-")] | @tsv'
```

Read the checks every 60 seconds until all four have the status `completed` for `$head`. If a check is still missing or running 45 minutes after your last push, leave the pull request open and report `waiting`. The next run continues it.

Then read the findings. Both reviewers post findings as review conversations before their check completes. A reviewer can also post a finding as a review summary or a comment.

```bash
gh api graphql -F n="$pr" -f query='query($n:Int!){repository(owner:"fitchmultz",name:"pi-agent-skills"){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved path line comments(first:50){nodes{databaseId author{login} body}}}}}}}'
gh pr view "$pr" --repo fitchmultz/pi-agent-skills --json reviews,comments
```

For every finding, including one that you judge to be wrong:

1. Fix the finding, or rebut it with evidence: a source line at `$fork` or `v$official`, or the output of a command.
2. Reply in the conversation of the finding. State the commit that fixes it, or give the evidence.
3. Resolve the conversation. A finding in a review summary or a comment has no conversation: answer it with a comment on the pull request that quotes it.

```bash
gh api "repos/fitchmultz/pi-agent-skills/pulls/$pr/comments/<databaseId of the first comment>/replies" -f body='<reply>'
gh api graphql -f id='<id of the conversation>' -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}'
```

For a check that completed without `success`:

| Check result on `$head` | Action |
| --- | --- |
| `official` or `fork` failed because of your change | Read the log with `gh run view --job <job id> --log-failed`. Fix the cause. For a failure in `test/pi-development-facts.test.mjs`, follow [Answer a failure of the check](#answer-a-failure-of-the-check). |
| `official` or `fork` failed for a reason outside your scope, such as a test of another skill or the runner | Run `gh run rerun <run id> --failed` once. If the check fails again, comment the cause on the pull request once, leave the pull request open, and report `blocked`. |
| A review check ended without `success`. `Pi Durable Review` reports `failure` when it filed findings. `neutral` or `cancelled` is an error in the reviewer. | Answer every open finding first. If you then have no fix to push, push an empty commit to get a new review: `git commit --allow-empty -m "Request a new review"`. |

After a fix, run the gate again, commit, and push without force. Then repeat this step for the new head commit.

Leave the pull request open and report `blocked` in two cases. In the first case, a reviewer repeats a finding that you rebutted. In the second case, a review check ends without `success` on two head commits in a row while no finding is open. Do not repeat a comment that the pull request already has.

### 8. Merge

Merge only when every condition is true for the head commit that GitHub reports now:

```bash
gh pr view "$pr" --repo fitchmultz/pi-agent-skills --json headRefOid,mergeable,isDraft,files
```

- `headRefOid` equals `$head`, the commit whose checks you read.
- `official` and `fork` concluded `success`.
- `Pi Durable Review` concluded `success`.
- `Cursor Automation: PR Bug Review - Maintained Repos` concluded `success`. A `neutral` result is an error in Cursor. GitHub accepts `neutral` for a required check, and this procedure does not.
- The query in step 7 shows no unresolved review conversation, and every finding has a reply.
- The pull request has no conflict with `main` and is not a draft.
- Every changed file is in your scope.

```bash
gh pr merge "$pr" --repo fitchmultz/pi-agent-skills --squash --match-head-commit "$head"
```

If GitHub refuses the merge, do not bypass the refusal. Leave the pull request open and report `blocked` with the message from GitHub.

After the merge, read the stamp on `main`. It must equal `official` and `fork`:

```bash
git fetch origin
git show origin/main:skills/pi-development/SKILL.md |
  sed -n -e 's/^  last-verified-pi: "\(.*\)"$/\1/p' -e 's/^  fork-source: "\(.*\)"$/\1/p'
```

GitHub deletes the branch on merge. If `refresh/pi-development` still exists on `origin`, delete it with `git push origin --delete refresh/pi-development`.

### 9. Report

End the run with one of these results, as the first word of your answer:

| Result | Meaning |
| --- | --- |
| `current` | The stamp equals both hosts and no earlier work is open. Nothing changed. |
| `merged` | The pull request merged and the stamp on `main` equals `official` and `fork`. |
| `waiting` | The pull request is open and a check did not complete in time. |
| `blocked` | The run could not continue. Name the step, the cause, and what must change. |

After the result, state these facts:

- The stamp before and after, and the values of `official` and `fork`.
- The URL and the head commit of the pull request.
- The conclusion of each of the four checks.
- The number of findings, and how many you fixed and how many you rebutted.
- Each gate command with its exit status, and anything that you could not check.
