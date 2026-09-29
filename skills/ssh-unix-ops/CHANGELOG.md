# Changelog

Historical archive notes. Bundled changes are recorded in the [repository changelog](../../CHANGELOG.md); the helper reports its version through `--version`.

## Unreleased

### Changed
- Renamed the skill from `ssh-linux-ops` to `ssh-unix-ops` to reflect Linux, macOS, and WSL2 SSH targets.

## [0.3.0] - 2026-04-02

### Added
- Public packaging files: `LICENSE`, `VERSION`, `CHANGELOG.md`, `agents/openai.yaml`, `.gitignore`
- Local packaging checks, integration self-test, negative tests, trigger evals, and output-quality evals
- Machine-readable `--json` output for `doctor`, `write`, `upload`, `download`, `backup`, `restore`, and `sha256`
- Dedicated negative test script and trigger-eval corpus
- Explicit installation and release guidance for public distribution

### Changed
- Default SSH behavior now uses `BatchMode=yes` for noninteractive safety
- Symlink and special-file policies are explicit and documented
- Tree transfers now default to `--no-same-owner`
- `backup` is documented as a rollback copy rather than a durable backup system

### Fixed
- Exit-code contract now cleanly distinguishes semantic diffs from operator and operational failures
- Read-style and mutation-style commands now apply consistent symlink safety rules
