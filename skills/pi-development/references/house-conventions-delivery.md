# House conventions: repository delivery

Read this before you add a package, change its manifest, scripts, CI, or documents, raise its Pi floor, write a changelog note or a pull request title, or release one of Mitch's Pi packages or the `fitchmultz/pi` fork.

- These rules are binding there. A rule about packages applies to a `fitchmultz` repository whose `package.json` has a `pi` key.
- The shared automation repository `fitchmultz/.github` owns CI and release mechanics: `fleet.json`, `docs/integration.md`, `docs/qualification.md`, `docs/npm-releases.md`. Read the current file there. Do not copy it into a package.
- A sentence that starts with `On the fork,` describes fork-only host behavior. A sentence about the fork repository says "the fork repository".
- The layout and naming rules are for new packages and new files. Do not move a shipped entry point, script name, or document without a task that asks for it.
- This file grants no authority to push, merge, tag, or publish. The authority rules are in `SKILL.md` and in [publishing/workflow.md](publishing/workflow.md#authorization-boundary).
- Related owners: [house-conventions-ux.md](house-conventions-ux.md) for what the person sees, [house-conventions-tool-contract.md](house-conventions-tool-contract.md) for what the model sees.

Words: the *fleet* is the list of repositories in `fleet.json`. An *npm channel* is a fleet entry with `npmRelease: "automatic"`. A *Git-only* package has no `npmPackage` in its fleet entry and installs with `pi install git:github.com/fitchmultz/<repo>`. The *floor* is the oldest official Pi version that a package supports.

## Layout

- The extension entry is `extensions/<name>.ts`, and it is thin. The implementation is in `src/`, tests in `test/`, maintenance scripts in `scripts/`, documents in `docs/`, and skills, prompts, and themes in `skills/`, `prompts/`, and `themes/`.
- Always write the `pi` manifest, with `./` paths, and set `"type": "module"`. The keyword, the dependency classes, and what a package must not ship are in [Package contract](publishing/workflow.md#package-contract).
- `files` is an allowlist: the entry and source directories, `README.md`, `CHANGELOG.md`, and `LICENSE`. Leave out tests, CI files, and scripts that the installed package does not run.
- `CHANGELOG.md` must be in the tarball. Pi reads it from the package root to show update notes.
- A Git-only package sets `"private": true`, so that `npm publish` fails.
- Where package data goes is in [State](house-conventions-tool-contract.md#state).

## Language and build

- Ship TypeScript source that Pi loads without a compile step: erasable syntax only, relative imports with the `.ts` extension, `noEmit`.
- Use `NodeNext` modules, target `ES2024`, `strict`, and the compiler options in section 4.2 of the engineering standard (`docs/strict-quality-standard.md` in `fitchmultz/.github`).
- Pin the Pi packages that the package imports, and `typescript`, `oxlint`, `tsrs`, and `oxfmt`, to exact versions in `devDependencies`.
- A package that builds `dist/` has a `prepare` script that produces it after `npm install --omit=dev`. That is the command Pi runs for a Git install.
- The `compilerOptions.paths` entry for `@earendil-works/pi-ai` is in [Tool schemas and arguments](current-version-hazards.md#tool-schemas-and-arguments).

## Lint, format, and tests

- Lint with `oxlint` using `tsrs` (`tsrs-lint` for type-aware linting, replacing `oxlint-tsgolint`) and format with `oxfmt`, keeping `tsc` (including secondary configs such as declarations or JXA) as a separate required compiler gate. The configuration is `.oxlintrc.json` and `.oxfmtrc.json` at the root.
- Follow the engineering standard at the version that the repository's `AGENTS.md` names. Record an exception in the repository. Do not add a suppression comment.
- Tests use `node --test` on files named `test/<subject>.test.ts`. `npm test` runs all of them offline, with no credentials and no paid calls.
- Keep at least one test that loads the extension through the real host and exercises the changed tool, command, or event.
- In that test, take the host from the variables that shared CI sets: `PI_HOST_INDEX` (the SDK entry) and `PI_HOST_CLI` (the CLI). Assert `PI_COMPAT_EXPECTED_VERSION` and `PI_COMPAT_EXPECTED_PACKAGE_DIR` when they are set. Without them, use the development pin.
- A test must fail when the behavior breaks.
- The fork repository uses Biome and vitest through its own commands. Do not add `oxlint` there.

## The gate

- `npm run check` is the complete gate. It runs the format check, lint, type check, tests, and a pack check. It runs each step even after a failure, and fails if any step fails.
- `npm run check:compat` is the command that shared CI runs one time for each host. It has every step whose result depends on the host: type check, tests, and the real-host test. It can leave out a host-independent step only when another required CI job runs that step.
- Before a push, run the focused checks that prove the change: the tests that cover the changed code (`node --test test/<subject>.test.ts`), plus `npm run typecheck` or `npm run lint` when they are quick. Do not run the complete gate first. Push and open the pull request early: CI runs every step of the gate on each push to the pull request.
- When a repository's `AGENTS.md` says that a gate runs only locally, with no CI job that runs it, that rule wins: run that gate before the push.
- The step scripts are `format:check`, `lint`, `typecheck`, `test`, and `pack:check`, with `format` and `lint:fix` to write fixes. Never name one step `check`.
- In a repository where `check` does not exist or is one step, the complete gate is the one that its `AGENTS.md` names. Change the script names only when the task is that change.
- In the fork repository, `npm run check` is read-only; `npm run check:fix` writes Biome fixes, and pre-commit runs fix then check. Review any hook-written diff. Run check after a code change, then the tests for the changed behavior as the fork's `AGENTS.md` describes; neither check command runs the tests. This does not replace a public package's complete gate above.

## CI

- A public package is in the fleet: an entry in `fleet.json` and a workflow named `Pi compatibility`.
- The workflow calls `fitchmultz/.github/.github/workflows/pi-compatibility.yml` at a full commit SHA and passes the same SHA as `automation-ref`. Use the caller template in `docs/integration.md`. Keep the two SHAs equal.
- The job `compatibility` of that template gives the check `compatibility / compatibility`. `main` requires it.
- Add your own jobs only for a check that the shared workflow cannot do: a desktop application, a browser, a paid provider.
- Shared CI selects the hosts in each run: the latest official release and the current fork `main`. Do not write a host version or a fork commit into a workflow or a script of a package.
- Renovate stays off through the shared preset. Dependabot does security fixes only. Do not add a second dependency updater.
- A public repository uses GitHub-hosted runners. Only a private repository can route jobs to the self-hosted runners, through `vars.SELF_HOSTED_RUNNERS`.

## Pi floor

- The floor is the exact version of `@earendil-works/pi-coding-agent` in `devDependencies`. Pin the other `@earendil-works/*` development dependencies to the same version.
- State the floor in prose one time, in the requirements of `docs/reference.md`: "Pi X.Y.Z or later". Other documents link there.
- A script or a workflow that needs the floor reads it from `package.json`.
- Do not put the floor in `peerDependencies` or in `engines`.
- Do not state a fork commit in a package. The fork target is the current `main`, and shared CI resolves it.
- Raise the floor to each new official release, in one pull request for each repository, titled `Raise the Pi floor to X.Y.Z`.
- That pull request reads the Pi changelog between the two versions, updates the pins, the lockfile, and the one prose line, and removes code that only served the older version.
- Keep no fallback for a host older than the floor.

## Release

An npm channel has a fleet entry with `npmRelease: "automatic"` and the workflows `npm-version.yml` and `npm-release.yml`. The flow is in `docs/npm-releases.md` of `fitchmultz/.github`.

- On an npm channel, a merge to `main` that changes the installed package is the release. After each merge, `npm-version.yml` compares the package built from `main` with the latest version on npm. A merge that changes only CI, tests, development scripts, `devDependencies`, or `CHANGELOG.md` releases nothing and waits for the next merge that changes the package.
- When the package changed, the release bot commits `chore(release): X.Y.Z` directly to `main`, with the new version, the lockfile, and the changelog. There is no version pull request. That commit starts `npm-release.yml`, which tests the packed package on both hosts, then creates the tag and the GitHub Release and publishes to npm.
- On an npm channel, do not edit `version`, create a tag, create a GitHub Release, or run `npm publish`.
- Publication uses npm trusted publishing. There is no npm token to read.
- The bot creates patch versions only. A minor or a major version is the owner's decision.
- Before the merge, add the note under the unreleased heading of `CHANGELOG.md`, or in a new file `changelog.d/<name>.md` so that parallel pull requests do not conflict. The bot moves both into the version section and deletes the fragment file.
- Keep the package's own release gate in its `npm-release.yml`. The shared checks do not replace it.
- To stop releases, set the repository variable `NPM_RELEASE_ENABLED` to `false`. Never delete a published version, move a tag, or replace a release asset.
- A release is done when `npm view <name> version` equals the manifest version on `main` and the tag `vX.Y.Z` exists. A green workflow is not that proof.
- A Git-only package has no release automation. Keep the notes under the unreleased heading. Change `version` or create a tag only when the task asks for a release.
- Pi shows the update notes of a Git package only when its `version` increases.
- The manual flow in [publishing/workflow.md](publishing/workflow.md) is only for a package that has no release automation.
- After merging an update to one of Mitch's Pi packages, extensions, or skills (and after npm publication completes on an automatic npm channel), fast-forward the canonical `main` checkout and update the installed copy across Mitch's devices with `pi update <source> --no-approve` (or `pi update --extensions --no-approve` for all packages; `pi update` with no target updates Pi). Report any offline or unreachable device as pending without stalling reachable devices. Do not send intercom messages or kill/restart other running sessions: on the fork, when `restartWhenStale`<!-- fork-only --> is enabled (`true`), idle managed sessions automatically restart only when an extension-supplying package changes on disk (see [Stale extension code and activation](lifecycle-checklist.md#stale-extension-code-and-activation)); skills-only packages are not detected by `restartWhenStale`<!-- fork-only --> and take effect in new sessions or on `/reload` (or `/restart`), while Pi runtime updates (`pi update` or `pi update --fork`) require a new session or managed restart (`/restart` or `pi restart`, not `/reload`). On official Pi, start a new Pi process to pick up the update.
- On the fork, `pi update --fork` builds and selects the latest `fitchmultz/pi` `main`. It builds nothing when the active release already is that commit for the running Node version, platform and architecture; add `--force` to rebuild. After merging a fork update, fast-forward the canonical `main` checkout and run `pi update --fork` across Mitch's devices without sending intercom messages or killing/restarting other running sessions; `restartWhenStale`<!-- fork-only --> does not detect runtime updates, so sessions load the new build on a new launch or managed restart (`/restart` or `pi restart`).
- In the fork repository, follow `AGENTS.md` and `FORK.md` at the target revision for commits, changelog entries, release, and activation.

## Changelog and titles

- `CHANGELOG.md` is at the root: `# Changelog`, then the unreleased heading, then the versions, newest first.
- Keep the unreleased heading that the file has. The bot finds `## Unreleased` and `## [Unreleased]`. A new file uses `## Unreleased`.
- A version heading is `## X.Y.Z - YYYY-MM-DD`. Pi also reads `## [X.Y.Z]`.
- Write one flat bullet for each change that a user can notice: what the user or the model now sees or can do, then why if it is not obvious, then the issue number. Use present tense and plain words. Do not describe the code.
- A change with no effect that a user can notice (tests, CI, refactoring) gets no bullet.
- Do not edit a released section.
- The pull request title is a release note. The version section that the bot writes into the changelog, which the GitHub Release copies, has three parts in this order: the notes from the unreleased heading and from `changelog.d`, one line with the title of the first commit merged since the last release, and GitHub's generated list of the pull requests merged since then. Write the title for a user.
- The commit on `main` carries the pull request title. With a merge commit, that line reads `Merge pull request #63 from …`.
- A pull request in an ordered series ends its title with `(n/total)`.

## Documents

- `README.md` is the short entry point: what the package does, the install command without a version, a first thing to try, limits, links to `docs/`, license.
- `docs/reference.md` documents each tool, command, setting, environment variable, and file that the package reads or writes, and the requirements (Pi floor, Node).
- Settings are under the heading `## Settings`, in one table: key, type, default, effect.
- `docs/development.md` documents local setup, the gate, host qualification, and the release flow. For the release flow, link to the shared guide.
- `AGENTS.md` holds durable rules for agents in that repository: the gate command, the engineering standard and its version, test ownership, and the shared "Dependency maintenance" section. It holds no history and no status.
- Write each document as current behavior.
- Refer to the tool names, versions, and install commands of another package with a link. Do not copy them.
- The pull request that changes behavior also updates the unreleased note, `docs/reference.md` for a tool, command, or setting, `README.md` for install, first use, or a limit, and `AGENTS.md` for a rule for agents.

## Notes and evidence

- Task notes, plans, and reports are in `.pi/notes/` and are never committed.
- Commit evidence only when a document or a check refers to it. Put it under `docs/` and outside `files`.
- Scratch output goes to a temporary directory or to an ignored `.artifacts/` directory.
