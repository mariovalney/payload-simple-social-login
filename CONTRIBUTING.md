# Contributing

How to develop and test **payload-simple-social-login** locally. For installing and configuring the package in an app, see [README.md](README.md).

## Versioning

Releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR** — breaking changes for consumers of the plugin API or documented behavior
- **MINOR** — backward-compatible features
- **PATCH** — backward-compatible bug fixes

Document user-facing changes in [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog style) when cutting a release. Commit messages still use the [commit skill](.agents/skills/commit/SKILL.md) (`/commit`).

## Prerequisites

- Node.js
- pnpm

## Setup

From the repository root:

```bash
pnpm install
cp dev/.env.example dev/.env
```

Set at least `PAYLOAD_SECRET` in `dev/.env`. For live OAuth against Google / Microsoft, also set:

- `SOCIAL_LOGIN_GOOGLE_CLIENT_ID` / `SOCIAL_LOGIN_GOOGLE_CLIENT_SECRET`
- `SOCIAL_LOGIN_MICROSOFT_CLIENT_ID` / `SOCIAL_LOGIN_MICROSOFT_CLIENT_SECRET`

Redirect URIs in the IdP consoles must match the plugin callbacks (with Payload `routes.api`), e.g. `http://localhost:3000/api/auth/google/callback` and `http://localhost:3000/api/auth/microsoft/callback`.

## Repository layout

| Path | Role |
| --- | --- |
| `src/` | Plugin source (endpoints, providers, UI, types) |
| `src/exports/client.ts` | Admin client components entry (`payload-simple-social-login/client`) |
| `src/exports/types.ts` | Public TypeScript types (`payload-simple-social-login/types`) |
| `dev/` | Next.js + Payload test app that consumes the plugin |
| `.agents/skills/` | Agent skills (Payload, commit) — see below |
| `AGENTS.md` | Short pointer to those skills |

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the `dev/` app (Turbopack) |
| `pnpm test:int` | Integration / unit tests (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm generate:types` | Generate Payload types for the dev app |
| `pnpm generate:importmap` | Regenerate admin import map after UI export changes |

Full test suite (`pnpm test`) also runs Playwright e2e; for routine plugin work prefer `pnpm test:int`.

## Dev app

Open [http://localhost:3000/admin](http://localhost:3000/admin) after `pnpm dev`.

- Database: SQLite (`dev/payload.db`), created automatically
- Seed user (if missing): email `dev@payloadcms.com`, password `test`
- Plugin config in `dev/payload.config.ts` uses an explicit `collections` + `findUserCallback` that matches by `profileEmail` (same behavior as the plugin default, but demonstrates the API for Google and Microsoft)

After changing client exports (`src/exports/client.ts` or components), run `pnpm generate:importmap`.

## Agent skills

This repo expects contributors and coding agents to follow the local skills:

### Payload

Use [`.agents/skills/payload/SKILL.md`](.agents/skills/payload/SKILL.md) for Payload APIs, plugins, auth, endpoints, and config patterns. Deeper notes live in [`.agents/skills/payload/reference/`](.agents/skills/payload/reference/). See also [AGENTS.md](AGENTS.md). Prefer the skill, then [Payload docs](https://payloadcms.com/docs/plugins/build-your-own).

### Commits

Use the **commit** skill at [`.agents/skills/commit/SKILL.md`](.agents/skills/commit/SKILL.md) (invoke with `/commit`). Do not invent ad-hoc commit messages outside that workflow.

## Tests worth knowing

Integration tests live in `dev/int.spec.ts` and cover provider registration, OAuth state, token/profile mocks, find-user / session redirect, custom paths, and `findUserCallback` allow/deny. Run with `pnpm test:int`.

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`: `pnpm lint`, `pnpm test:int`, and `pnpm build`. Playwright e2e is not in CI yet.
