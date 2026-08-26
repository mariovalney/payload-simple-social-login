---
name: release
description: >-
  Prepares a SemVer release for this Payload plugin: run checks, read the
  latest git tag, infer the next version, confirm it with the user, then write
  CHANGELOG.md and bump package.json. Does not publish; GitHub Release + Actions
  stay manual. Use when the user asks to release, bump version, or invokes
  /release.
disable-model-invocation: true
---

# Release

## Overview

**Prepares** the next package release for **payload-simple-social-login**. It does **not** publish.

The actual release stays **manual** on GitHub: after the prep commit is on `main`, the user creates a GitHub Release with tag `vX.Y.Z`, which runs [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) (lint, tests, `npm publish` via OIDC).

This skill only leaves the repo ready:

1. Verify the repo is ready (checks)
2. Read the latest git tag and `package.json` version
3. Infer the next SemVer bump from commits / `[Unreleased]` notes
4. **STOP** until the user **expressly decides** the new version
5. Only then: rewrite `CHANGELOG.md` and bump `package.json`

**Never** from this skill: `git tag`, `gh release create`, `npm publish`, or pushing a release tag. Do not offer to run those unless the user explicitly asks in a separate request; even then prefer reminding them that publish is the GitHub Release UI / Actions path.

For the release prep commit, use the **commit** skill (`.agents/skills/commit/SKILL.md` / `/commit`). Prefer `.agents/skills/payload/` when unsure about Payload APIs.

**Never** edit the versioned changelog or bump `package.json` in the same turn as the version proposal. Version confirmation and file writes are separate turns.

Do not use em dashes (`—` / `–`) in changelog or skill-facing copy; use periods, colons, or ASCII hyphens.

## Steps

### 1. Preconditions

- Run `git status --short` and `git status -sb`
- Prefer a clean working tree (no unstaged/uncommitted changes). If dirty, list files and ask whether to continue, stash, or stop
- Prefer branch `main` (or the repo default). If on another branch, warn and ask whether to continue
- Note whether the branch is ahead/behind of `origin`

If the user does not want to proceed, stop.

### 2. Checks

Keep this light. Use `pnpm` scripts from `package.json`.

- `pnpm lint`
- `pnpm test:int` (do **not** run e2e / Playwright)
- `pnpm build` (release must produce `dist/`)

If any check fails: report the failure and ask whether to continue anyway. If they decline, stop.

### 3. Latest tag and current version

In parallel:

- `git describe --tags --abbrev=0` (latest tag; if none, treat as first release after reading history)
- `git tag -l 'v*' --sort=-v:refname | head -5`
- Read `package.json` `version`
- Read `CHANGELOG.md` (`[Unreleased]` and latest dated section)

Record:

- `lastTag` (e.g. `v1.0.1`) or `none`
- `packageVersion` (e.g. `1.0.1`)
- Warn if `lastTag` (without `v`) ≠ `packageVersion` (repo may be mid-release or tags lag)

### 4. Infer next SemVer

From **last tag** (or initial commit if no tags) to `HEAD`:

- `git log <lastTag>..HEAD --oneline` (or full recent log if no tags)
- Read `[Unreleased]` in `CHANGELOG.md`

Classify using [SemVer](https://semver.org/) and this repo’s conventions ([CONTRIBUTING.md](../../../CONTRIBUTING.md)):

| Bump | When |
| --- | --- |
| **MAJOR** | Breaking changes for plugin consumers (API, documented behavior) |
| **MINOR** | Backward-compatible features |
| **PATCH** | Backward-compatible bug fixes / docs-only that warrant a release |

Inference heuristics (highest wins):

1. Explicit breaking language in commits / Unreleased → MAJOR
2. `[Feat]` commits or Unreleased `### Added` features → at least MINOR
3. `[Fix]` / Unreleased `### Fixed` only → PATCH
4. Docs-only / chore with no Unreleased consumer impact → suggest PATCH or ask if a release is needed at all

Compute `inferredVersion` from `packageVersion` (or from `lastTag` if package already matches).

If `[Unreleased]` is empty and there are no meaningful commits since the last tag, say so and ask whether to abort.

### 5. Present inference and STOP (version gate)

**CRITICAL:** Do **not** write the versioned changelog, bump `package.json`, or create any tag yet.

Show in chat:

- Last tag and `package.json` version
- Short rationale (commit summary + Unreleased highlights)
- Inferred bump: MAJOR / MINOR / PATCH → **suggested version** `X.Y.Z`
- Note: after prep is committed and pushed, publish is still manual (GitHub Release `vX.Y.Z` → Actions)

Ask the user to **expressly choose** the new version, for example:

- `1.1.0`
- `patch` / `minor` / `major` (apply that bump to current `packageVersion`)
- `não` / cancel

**STOP** until they reply with an explicit version decision.

Vague replies (“ok”, “pode”, “lgtm”, “ship it”) without a version or bump word are **not** enough. Ask again for the exact version or `major` / `minor` / `patch`.

### 6. Prepare release files (only after explicit version)

After the user has expressly decided `newVersion` (`X.Y.Z`):

1. Set today’s date from user context if available, else `date -u +%Y-%m-%d` (UTC)
2. Edit [CHANGELOG.md](../../../CHANGELOG.md):
   - Keep a top `## [Unreleased]` section (empty stub consistent with Keep a Changelog)
   - Move current Unreleased bullets into `## [newVersion] - YYYY-MM-DD` under the right `### Added` / `### Changed` / `### Fixed` / `### Notes` headings
   - If Unreleased was thin, flesh bullets from `git log` since last tag (user-facing; no internal-only noise)
   - Add or update footer links:
     - `[newVersion]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v{newVersion}`
     - Keep prior version links
3. Set `"version": "{newVersion}"` in `package.json` (required: publish workflow checks tag `v{newVersion}` equals this field)

No em dashes in new changelog text.

Do **not** create a git tag, GitHub Release, or run `npm publish`.

### 7. Hand off (prep done; publish stays manual)

- Show the new `## [newVersion]` section (full text) in chat
- Confirm `package.json` is `{newVersion}`
- Working tree dirty: `CHANGELOG.md` + `package.json`
- Tell the user to run `/commit` for the release prep commit, then push to `main` if needed

Then list **manual** publish steps (do not execute them):

1. Open GitHub → Releases → Draft a new release
2. Create tag `v{newVersion}` on the release prep commit (must match `package.json`)
3. Paste changelog notes for `{newVersion}` into the release body if desired
4. Publish the GitHub Release; Actions runs lint, `test:int`, and `npm publish`

Do **not** run `git commit` from this skill unless the user explicitly asks after seeing the changelog; prefer the commit skill workflow.

## Checklist

- [ ] Preconditions checked; dirty tree / wrong branch handled
- [ ] lint / test:int / build run; failures reported
- [ ] Last tag + package version recorded
- [ ] Next version inferred with SemVer rationale
- [ ] User **expressly chose** `X.Y.Z` (or major/minor/patch); agent stopped before file writes
- [ ] Only then: CHANGELOG versioned section + `package.json` bump
- [ ] Changelog shown; `/commit` + push suggested
- [ ] Manual GitHub Release steps listed; no tag / Actions / npm publish by the agent
