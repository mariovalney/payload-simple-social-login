# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Notes

- Stable **1.0.0** will ship via GitHub Release after npm Trusted Publishing is configured

## [0.1.0] - 2026-08-26

First npm publish of **payload-simple-social-login** for Payload CMS (0.x = initial development under SemVer).

### Added

- Google and Microsoft (Entra ID) OAuth providers (authorize, token exchange, UserInfo / Graph `/me`)
- Admin login buttons (`afterLogin`) with i18n (`en` / `pt`) and optional per-provider `label`
- Login and callback root endpoints with CSRF `state` cookie
- User resolution via `collections` / `findUserCallback` (default: email match on `admin.user`)
- Passwordless Payload session (`jwtSign` + auth cookie) and redirect to the admin panel
- Error redirects with toast codes `ssl-error=login` and `ssl-error=not-found`
- Exported config/profile types via `payload-simple-social-login/types`, plus normalized `profileEmail` / `profileId` in `findUserCallback`
- Plugin options: `providers`, `callbackURL`, `loginUrl`, `tenant` (Microsoft), `collections`, `showButtonOnLogin`, `disabled`
- Package entry points: `.` (plugin), `./client` (admin UI), `./types` (TypeScript types)

### Notes

- The plugin does not auto-create users or link/unlink OAuth accounts; apps own that via `findUserCallback` when needed
- Provider access tokens are not stored; only the Payload session cookie is issued

[Unreleased]: https://github.com/mariovalney/payload-simple-social-login/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v0.1.0
