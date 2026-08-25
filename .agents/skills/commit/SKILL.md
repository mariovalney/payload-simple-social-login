---
name: commit
description: Creates a standardized commit message from staged files and optionally runs the commit.
disable-model-invocation: true
---

# Commit

## Overview

Creates a standardized commit message from staged files and optionally runs the commit.

**Always validate the commit message with the user before running `git commit`.** Creating `COMMIT_MSG.md` and committing in the same turn is forbidden, even when the user asked to commit up front.

This repository is a Payload plugin. Do **not** expect `docs/ENTITIES.md`, OpenAPI sync, coverage plans, or `yarn`-only scripts from other projects. When unsure about Payload behavior, use `.agents/skills/payload/` (then Payload docs).

## Steps

### 1. Check Git Status

- Run `git status --short`
- If there are no staged files, inform the user and stop
- If there are staged files, proceed

### 2. Checks

Keep this step light. Use `pnpm` scripts from this repo’s `package.json`.

- If staged files touch Payload schema/config (`dev/payload.config.ts`, auth collections, plugin fields that change generated types): run `pnpm generate:types`
- If staged files include JS/TS under `src/` or `dev/` (excluding generated/`*.spec` noise as needed): run `pnpm lint`
  - Lint must not scan Next build output. If `pnpm lint` fails only on `**/.next/**`, treat as tooling misconfig (fix ignores) — not a source failure
- Run `pnpm test:int` only (do **not** run e2e / Playwright as part of commit)
- If lint, generate, or integration tests fail: inform the user and ask whether to continue anyway
- If the user chooses not to continue, stop
- If they continue after failures, set an internal flag that files may have been fixed later (used in step 10)

### 3. Check for Stray `console.*`

- For each staged file under `src/`:
  - Search for `console.(log|error|warn|info|debug)`
  - Read surrounding context (5–7 lines)
  - **IGNORE** legitimate catch / error handling (`console.error(error)` in catch)
  - **IGNORE** test files under `dev/` (`*.spec.ts`, etc.)
  - **IGNORE** when the same line or the line above has an intentional comment (e.g. `// intentional console`, `// skip console`)
  - Otherwise treat as stray
- If stray calls are found: list file + line + short context, ask whether to continue, and **STOP** until the user replies
- If they choose not to continue, stop

### 4. Analyze Changes

- `git diff --cached --stat` and `git diff --cached --name-only`
- Categorize:
  - Plugin: `src/`
  - Dev app: `dev/`
  - Docs: `README.md`, `TODO.md`, `AGENTS.md`
  - Build/config: `package.json`, lockfiles, eslint/tsconfig/swc/vitest/playwright
  - Agent tooling: `.cursor/`, `.agents/`

### 5. Determine Commit Tag

- `[Feat]` – new plugin/dev functionality
- `[Fix]` – bug or type fixes
- `[Test]` – only test files changed
- `[Refact]` – refactor, no behavior change
- `[Build]` – package.json, scripts, tooling config
- `[Docs]` – documentation only
- `[Style]` – formatting only
- `[IA]` – only `.cursor/` / `.agents/` changes

**Priority:** Test → Fix → Feat → Refact → Docs → IA → Build

### 6. Create Commit Title

- English, concise, focus on *what* (not *how*)
- Max ~50–60 characters
- Format: `[Tag] Short description`
- Examples: `[Feat] Add users auth to dev app`, `[Docs] Rewrite plugin README`

### 7. Create Detailed Message (if needed)

If multiple files or non-trivial changes, add a body:

- What changed and why (value-focused)
- Group by area with short bullets when several areas are touched
- List main files (at most 5–7)
- Mention breaking changes or new deps if any
- **Never** include `Co-authored-by`

### 8. README Check

If staged changes affect scripts, dependencies, or local setup documented in `README.md`, update `README.md` and stage it before committing.

### 9. Create `COMMIT_MSG.md`

Write `COMMIT_MSG.md` at the repo root:

```
[Tag] Title

Detailed message (if needed)
```

Ready for `git commit -F COMMIT_MSG.md`.

### 10. Unknown Changes (conditional)

Run **only** if the step 2 failure flag is set:

- Compare initially staged files with current `git status --short`
- If there are unstaged modifications (other than `COMMIT_MSG.md`), show diffs, ask the user to stage / ignore / cancel
- Otherwise proceed

If the flag is not set, skip to step 11.

### 11. Present and Confirm (always — never skip)

**CRITICAL:** Always stop here and wait for the user. Do **not** run `git commit` in the same turn you create `COMMIT_MSG.md`, even if the user already said “commit”, “pode comitar”, “ship it”, or similar.

- Show the **full** contents of `COMMIT_MSG.md` in the chat (do **not** open it with `cursor`, `code`, or any external editor)
- Tell the user the file is at the repo root if they want to edit it in Cursor
- Ask explicitly whether the **message** is OK and whether to run `git commit -F COMMIT_MSG.md` now (yes/no)
- **STOP** until they reply. Only after an explicit yes (e.g. “yes”, “y”, “sim”, “s”) may you commit
- On **yes**: commit, confirm success, delete `COMMIT_MSG.md`
- On **no** / edit requests: leave or update `COMMIT_MSG.md`; if they edit the message, show it again and re-ask before committing

## Checklist

- [ ] Staged files present
- [ ] generate:types / lint / test:int run as applicable; failures reported
- [ ] Stray console checked (or user continued)
- [ ] Changes categorized; tag and title chosen
- [ ] Body written if needed
- [ ] README updated if setup/scripts changed
- [ ] `COMMIT_MSG.md` created and **shown in chat for validation** (never skip; not opened via `code`/`cursor` CLI)
- [ ] User **explicitly approved the message** after seeing it; only then commit; remove `COMMIT_MSG.md` on success
