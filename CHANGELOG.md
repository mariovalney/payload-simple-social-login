# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-27

### Added

- `createSocialAuthEndpoints`: public factory to register a login + callback pair with the same provider config as the plugin (`GoogleProviderConfig` / `MicrosoftProviderConfig`)
- Optional `onSuccess` / `onError` callbacks on custom flows: receive token and IdP profile, return your own `Response` (no automatic Payload login)
- Per-flow OAuth `state` cookies (`payload-auth-state-{provider}_{callback path}`) so multiple flows for the same provider do not overwrite each other

### Notes

- Default admin login (plugin without `onSuccess`) is unchanged: paths, `ssl-error` redirects, JWT session, and `findUserCallback` / `autoVerify` behavior
- Custom flows do not require the plugin in `plugins[]`; register returned endpoints on `config.endpoints`
- The callback endpoint always clears the OAuth `state` cookie on the final response; `onSuccess` / `onError` do not need to handle it
- OAuth `state` cookie names changed from `payload-ssl-state-{provider}`; in-flight OAuth redirects (within ~10 minutes) may need to be restarted

## [1.0.2] - 2026-08-26

### Fixed

- Default find-user path respects collection `auth.verify`: unverified users get `ssl-error=unverified` and a toast instead of a silent JWT bounce to `/admin/login` with no message

### Added

- `collections[].autoVerify`: on the default find only, set `_verified: true` (only that field) when `auth.verify` is on and the matched user is unverified

### Notes

- Custom `findUserCallback` owns `_verified` handling; without a check, Payload’s JWT strategy may still refuse the session silently
- `autoVerify` has no effect when `findUserCallback` is set or the collection has no `auth.verify`

## [1.0.1] - 2026-08-26

### Fixed

- Point package `exports` / `main` / `types` at `dist/` so npm consumers resolve built JS (npm does not rewrite those fields from `publishConfig`)
- Move `@payloadcms/ui` to a peer dependency (`^3.0.0`) so installs do not pull a mismatched UI version; widen `payload` peer to `^3.0.0`

## [1.0.0] - 2026-08-26

First stable release.

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

[1.1.0]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.1.0
[1.0.2]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.0.2
[1.0.1]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.0.1
[1.0.0]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.0.0
