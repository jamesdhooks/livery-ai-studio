---
name: beta-release-flow
description: "Use when preparing a beta release: verify build/tests, bump version, update CHANGELOG.md, commit all pending changes, and create/push the next beta tag (format vX.Y.Z-beta). Keywords: release, beta, version bump, changelog, tag, commit, push."
---

# Beta Release Flow

Use this skill to run the project's beta release process end-to-end.

## Scope

This workflow targets this repository's release convention:
- Version format: `X.Y.Z-beta`
- Tag format: `vX.Y.Z-beta`
- Version sources:
	- `version.py` (`__version__`)
	- `frontend/package.json` (`version`)

## Inputs

Ask the user only if needed:
- bump type: `patch` (default), `minor`, `major`
- optional release notes bullets for CHANGELOG entry
- target branch (default: current checked-out branch)

If no bump type is provided, default to `patch` and keep `-beta` suffix.

## Workflow

1. Validate git state and branch
- Run `git status --porcelain` and `git branch --show-current`.
- Do not discard or revert user changes.
- Include all pending changes in the release commit.

2. Determine next beta version
- Read current version from `version.py` (`__version__ = "X.Y.Z-beta"`).
- Compute next version:
	- `patch`: `X.Y.(Z+1)-beta`
	- `minor`: `X.(Y+1).0-beta`
	- `major`: `(X+1).0.0-beta`
- Derive next tag as `v<next_version>`.

3. Update version files
- Update `version.py` `__version__` to next version.
- Update `frontend/package.json` `version` to next version.
- Ensure both match exactly.

4. Update changelog
- Insert a new top section at the top of `CHANGELOG.md`:
	- Header: `## [X.Y.Z-beta] — YYYY-MM-DD`
	- Include `### Added`, `### Changed`, `### Fixed` sections.
	- If no user-provided notes exist, add `- Release housekeeping.` under `### Changed`.
- Add/update the bottom link reference:
	- `[X.Y.Z-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/vX.Y.Z-beta`
- Avoid duplicate identical link-reference lines.

5. Verify build quality
- Run frontend tests: `cd frontend && npm test`.
- Run frontend build: `cd frontend && npm run build`.
- If either fails, stop and report errors before committing/tagging.

6. Commit all pending changes
- Stage all changes: `git add -A`.
- Commit message format:
	- Subject: `chore: release vX.Y.Z-beta`
	- Body sections:
		- `RELEASE`
		- `- Bump version to X.Y.Z-beta in version.py and frontend/package.json`
		- `- Update CHANGELOG.md for vX.Y.Z-beta`
		- `- Include all pending repository changes`

7. Tag and push
- Create annotated tag:
	- `git tag -a vX.Y.Z-beta -m "Release vX.Y.Z-beta"`
- Push commit and tag:
	- `git push`
	- `git push origin vX.Y.Z-beta`

8. Report outcome
- Return:
	- final version and tag
	- commit SHA
	- commands run summary
	- test/build status
	- any warnings (for example, if existing pending changes were included)

## Safety Rules

- Never use destructive git commands like reset/checkout to discard changes.
- Never amend existing commits unless user explicitly asks.
- If tag already exists locally or remotely, stop and ask whether to bump again or replace tag.
- If working tree changes during workflow unexpectedly, report and ask before proceeding.

## Quick Invocation Examples

- "Run beta release flow"
- "Release next beta patch"
- "Bump beta version, update changelog, commit all, and push tag"
