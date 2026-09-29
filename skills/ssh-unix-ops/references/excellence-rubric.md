# Excellence Rubric

A top-tier SSH skill should satisfy all of the following.

## 1) Standards compliance

- Valid `SKILL.md` frontmatter
- Name matches directory name
- Description is specific enough for reliable auto-invocation
- Relative paths are used for skill-local files

## 2) Safety by default

- Avoids ad-hoc `ssh "..."` quoting for non-trivial operations
- Forces a known shell for scripted execution
- Enables strict failure behavior for pipelines and unset vars
- Treats paths and contents as data, not shell syntax
- Uses atomic writes for file mutation

## 3) Narrow, composable primitives

- Clear separation between command execution, reading, writing, exact editing, backup/restore, hashing, and tree transfer/diffing
- Each primitive has obvious inputs, outputs, and failure modes
- Degraded-mode behavior is documented when prerequisites are missing

## 4) Evidence-backed guidance

- Documents observed failure modes, not just hypothetical ones
- Includes copy/paste-safe examples for common tasks
- Explains when **not** to use the skill
- Covers host-specific realities such as WSL2/Windows-mounted filesystems when relevant

## 5) Verification discipline

- Requires post-mutation verification
- Supports diff-based previews before mutation
- Supports rollback from explicit backups
- Fails loudly on ambiguous edits or missing matches
- Encourages service-native validation after config changes
- Includes a packaged self-test that can be run against a real host

## 6) Trust posture

- Preserves host key verification by default
- Does not normalize insecure SSH options
- Makes trust downgrades explicit, local, and user-directed

## 7) Maintainability

- Skill docs are concise, skimmable, and operational
- Helper scripts are readable and dependency-light
- The package is easy to extend without rewriting the core workflow
