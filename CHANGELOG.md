# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-10-11

### Security

- Social login could match a Payload account by an email address the identity provider does not vouch for. On Microsoft the plugin preferred the `mail` attribute, which tenant admins can set to any address without proving domain ownership; on Google it ignored `email_verified`. With the default `common` tenant this allowed signing in as another user. Accounts are now matched only by provider-verified addresses
- Microsoft: `profileEmail` comes from `userPrincipalName` only. `mail` is never used, not even as a fallback. Missing, non-email and guest (`#EXT#`) UPNs produce no `profileEmail`
- Google: `profileEmail` is set only when `email_verified` is `true` (boolean, as documented for the UserInfo endpoint)
- Both providers trim and lowercase the address, and the default lookup compares the normalized value
- Without a verified address, every flow stops before `onSuccess`, `findUserCallback` or any database lookup

### Breaking changes

Released as a patch so every `^1` install receives the fix, but it changes behavior:

- Microsoft users whose `mail` differs from their `userPrincipalName` now sign in by the UPN. Update the Payload account email to the UPN, or match by `profileId` in `findUserCallback`
- Microsoft guest accounts (`#EXT#` UPN) and accounts whose UPN is not an email can no longer sign in through email matching
- Google accounts whose email is not verified can no longer sign in
- Custom flows: `onSuccess` is no longer called without a verified email; `onError` receives `code: 'email_unverified'` instead (default response `400 { "error": "email_unverified" }`)
- Types: `profileEmail` is `string` (was `null | string`) in `SocialAuthOnSuccessArgs` and `FindUserCallbackArgs`; `SocialAuthErrorCode` gains `'email_unverified'`, so exhaustive `switch` statements over it need a new case
- A callback without a usable email now redirects to `ssl-error=email_unverified` instead of `ssl-error=login`

### Added

- Error code `email_unverified`, with an admin toast and en/pt translations (`providerEmailNotVerified`)

### Notes

- `tenant` still defaults to `common`. With UPN-only matching, accepting any tenant no longer allows account takeover; pin `tenant` when only one directory should sign in (e.g. the admin panel)
- Code in `findUserCallback` or `onSuccess` that reads `profile.email` or `profile.mail` bypasses these checks. Use `profileEmail` / `profileId`
- There is no option to accept unverified emails. Directories that registered users by `mail` can add it as an extra lookup key in `findUserCallback` only with `tenant` pinned to a trusted directory; the README has an example and the risks

## [1.1.2] - 2026-09-08

### Fixed

- OAuth `redirect_uri` behind a proxy: when the Payload config has no `serverURL`, the request origin now comes from the `Host` header (protocol from `x-forwarded-proto`) instead of the host of `req.url`, which behind a proxy is the internal one (`https://localhost:80/...`) and broke the login with `redirect_uri_mismatch`
- `Secure` flag of the OAuth `state` cookie now follows `x-forwarded-proto` and the resolved origin, not the protocol of `req.url`

### Added

- `serverURL` option, as a string or a per request function `(req) => string | null`, available on the plugin options, on each provider (`providers.*.serverURL`) and on the args of `createSocialAuthEndpoints`. Precedence: provider, plugin, Payload config. The function form serves more than one public host from a single process without mutating `req.payload.config.serverURL`
- `SocialLoginServerURL` type exported from `payload-simple-social-login/types`

### Notes

- Backward compatible: with no new option and no `serverURL` in the config, the origin derived from the `Host` header is used only when it is in the `cors` / `csrf` allowlist (same rule Payload core applies in `getRequestOrigin`), otherwise the plugin logs a warning recommending `serverURL` and keeps the previous `req.url` fallback
- Login and callback endpoints resolve the same URL, so a `serverURL` function is called on both requests of the flow and must be deterministic for them

## [1.1.1] - 2026-08-28

### Changed

- Error code `not-found` renamed to `not_found`: the callback now redirects to `ssl-error=not_found`, and the same value is used by the `SocialAuthErrorCode` union and the `{ error }` body of the default `onError` response

### Notes

- Not backward compatible for consumers that match the old hyphenated value: update any `onError` handler, link, or toast override that reads `not-found`

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

[1.1.3]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.1.3
[1.1.2]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.1.2
[1.1.1]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.1.1
[1.1.0]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.1.0
[1.0.2]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.0.2
[1.0.1]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.0.1
[1.0.0]: https://github.com/mariovalney/payload-simple-social-login/releases/tag/v1.0.0
