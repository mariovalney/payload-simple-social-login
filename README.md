# payload-simple-social-login

A Payload CMS plugin for social login (OAuth) on the admin panel and authenticated collections.

It adds an “or login with” UI to the login form and OAuth endpoints per provider. Supported in this version: **Google** and **Microsoft** (Entra ID).

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (`MAJOR.MINOR.PATCH`). See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Installation

Install the package, add the plugin to your Payload config, then regenerate the admin import map so the login buttons resolve:

```bash
pnpm add payload-simple-social-login
pnpm payload generate:importmap
```

(or `npx payload generate:importmap` / your package manager’s equivalent)

Without this step, the `afterLogin` social buttons may not appear in the admin panel.

### AI install prompt

Paste this into any coding agent to wire the plugin with the defaults (email match on `admin.user`, no auto-create):

```text
Install and configure payload-simple-social-login in this Payload CMS project the simplest way:

1. Add the dependency (pnpm/npm/yarn as used here).
2. Register payloadSimpleSocialLogin in payload.config with only the providers we need (google and/or microsoft), reading clientId/clientSecret from env vars. Leave callbackURL, loginUrl, collections, and findUserCallback unset so defaults apply (match existing users by profile email on admin.user; default also respects `auth.verify`).
3. Check env vars from .env and add to .env.sample or .env.example (do not create anything new; if secrets are needed, add empty placeholders and ask the user to fill them in).
4. Document the OAuth redirect URIs as {APP_ORIGIN}{routes.api}/auth/{provider}/callback (e.g. http://localhost:3000/api/auth/google/callback).
5. Run the project's Payload generate:importmap command so admin login buttons appear.
```

## Configuration

```ts
import { buildConfig } from 'payload'
import { payloadSimpleSocialLogin } from 'payload-simple-social-login'
import type { FindUserCallback } from 'payload-simple-social-login/types'

export default buildConfig({
  // ...
  plugins: [
    payloadSimpleSocialLogin({
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          // callbackURL: '/auth/google/callback',
          // loginUrl: '/auth/google/login',
          // label: 'Continue with Google',
        },
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          // tenant: 'common',
        },
      },
      // collections: [{ collection: 'users' }],
      showButtonOnLogin: true,
      // disabled: false,
    }),
  ],
})
```

### Options

| Option | Description |
| --- | --- |
| `providers` | Required. Enable `google` and/or `microsoft` with `clientId` / `clientSecret`. |
| `providers.*.callbackURL` | OAuth callback path. Default `/auth/{providerId}/callback` (public URL under `routes.api`). |
| `providers.*.loginUrl` | Login start path (button `href` + endpoint). Default `/auth/{providerId}/login`. |
| `providers.*.label` | Button label; falls back to plugin i18n. |
| `providers.microsoft.tenant` | Entra tenant segment. Default `common`. |
| `collections` | Auth collections to resolve users for. When omitted: `[{ collection: admin.user }]` with email match. |
| `collections[].autoVerify` | Optional. Default find only: if the collection has `auth.verify` and the user is unverified, set `_verified: true` (only that field) and continue. Default `false`. Ignored when `findUserCallback` is set. |
| `collections[].findUserCallback` | Optional. Locate (or create, in your app) a user. When omitted: match by `profileEmail` and respect `auth.verify` / `autoVerify`. |
| `showButtonOnLogin` | Show buttons on the admin login form. Default `true`. |
| `disabled` | Skip registering endpoints and UI. Default `false`. |

### Finding users

After OAuth, the plugin normalizes `profileEmail` and `profileId` and calls each collection’s `findUserCallback` (or the default email match). The first returned user is logged in (JWT cookie) and the browser is redirected to the admin panel. If none match → `/admin/login?ssl-error=not_found`.

| Arg | Google | Microsoft |
| --- | --- | --- |
| `profileId` | `sub` | `id` |
| `profileEmail` | `email` | `mail ?? userPrincipalName` |

**Default email match and `auth.verify`.** When you omit `findUserCallback`, the plugin also checks the collection’s `auth.verify`. If verification is required and the matched user has `_verified === false`, login is denied with `ssl-error=unverified` (toast), instead of issuing a session that Payload’s JWT strategy would reject silently. Set `collections[].autoVerify: true` to update **only** `_verified` to `true` on that match and continue login. If the collection has no `auth.verify`, neither the reject nor the auto-update runs.

**Custom `findUserCallback` owns verification.** If you override the callback, the plugin does **not** enforce `_verified`. You can mark the user verified (e.g. after a trusted IdP email), return `null`, or return an unverified user. In that last case the plugin still issues a JWT and the admin panel may bounce to `/admin/login` with no toast (`user: null` from Payload’s JWT strategy).

**This plugin never auto-creates users** and will not add a built-in create path. Payload has no standardized way to create auth users (required fields, password, verify, roles, tenants, hooks differ per app). Provisioning belongs in your `findUserCallback` if you want it.

**Link / unlink of OAuth accounts is also out of scope.** If you need that, model your own collection (e.g. `oauth-accounts` with `provider`, `profileId`, relation to the user) and override `findUserCallback` to resolve users through it.

#### Example: autoVerify

Use when the collection has `auth: { verify: true }` and a successful OAuth login is enough to mark the existing Payload user verified. Does not create users; only sets `_verified: true` on match. 

**Has no effect if you set `findUserCallback`.** Then you own `_verified` yourself.

```ts
collections: [
  {
    collection: 'users',
    autoVerify: true,
  },
]
```

#### Example: find-or-create (app-owned)

```ts
collections: [
  {
    collection: 'users',
    findUserCallback: async ({ payload, profileEmail, profileId }) => {
      if (!profileEmail) return null

      const existing = await payload.find({
        collection: 'users',
        limit: 1,
        overrideAccess: true,
        where: { email: { equals: profileEmail } },
      })

      if (existing.docs[0]) return existing.docs[0]

      return payload.create({
        collection: 'users',
        data: {
          email: profileEmail,
          // Optional: store IdP subject on a custom field for linking.
          // googleSub / microsoftId: profileId,
          // Auth collections still require a password; use an unguessable value (user signs in via social, not password).
          password: crypto.randomUUID(),
        },
        overrideAccess: true,
      })
    },
  },
]
```

### Errors

OAuth callback failures redirect to the admin login form with `?ssl-error=<code>` and a toast:

| Code | When | Toast |
| --- | --- | --- |
| `login` | Invalid/missing state, missing code, IdP error, token/profile failure, missing `profileEmail` | Generic “try again” |
| `not_found` | No Payload user returned from `findUserCallback` / default email match | Account not found |
| `unverified` | Default findUser: collection has `auth.verify`, matched user has `_verified: false`, and `autoVerify` is not enabled | Please verify your email before logging in |

### Custom endpoints

Use `createSocialAuthEndpoints` when you need extra OAuth flows (frontend app, account linking, JSON callback) without duplicating provider logic. It accepts the **same** provider config as the plugin (`clientId`, `clientSecret`, optional `loginUrl` / `callbackURL`, `tenant` for Microsoft).

Register the returned pair on `config.endpoints`. You do **not** need the plugin in `plugins[]` for custom-only flows; use both when you want admin login plus extra URLs.

**Admin default (plugin):** pass `collections` and omit `onSuccess`. Same as `payloadSimpleSocialLogin`: find user, JWT cookie, redirect to `/admin`.

**Custom flow:** pass `onSuccess` (and optional `onError`). After token exchange and IdP profile fetch, your callback returns a `Response`. No automatic Payload login. Missing `profileEmail` does **not** abort the callback (`profileEmail` may be `null`).

The callback endpoint always clears the OAuth `state` cookie on the final response. You do not set that cookie in `onSuccess` / `onError`.

Each flow gets its own `state` cookie name from provider + `callbackURL`, so two Google flows (e.g. admin + app) do not overwrite each other. Register **each** redirect URI in the IdP console.

```ts
import { buildConfig } from 'payload'
import { createSocialAuthEndpoints, payloadSimpleSocialLogin } from 'payload-simple-social-login'
import type { SocialAuthOnSuccess } from 'payload-simple-social-login/types'

const google = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
}

const appGoogleSuccess: SocialAuthOnSuccess = async ({ req, profile, profileEmail }) => {
  // Your logic: find-or-create, link account, issue your own session, etc.
  return new Response(null, {
    headers: { Location: '/app' },
    status: 302,
  })
}

export default buildConfig({
  endpoints: [
    ...createSocialAuthEndpoints({
      provider: 'google',
      ...google,
      loginUrl: '/app/google/login',
      callbackURL: '/app/google/callback',
      onSuccess: appGoogleSuccess,
      onError: () =>
        new Response(null, {
          headers: { Location: '/app/login?error=oauth' },
          status: 302,
        }),
    }),
  ],
  plugins: [
    payloadSimpleSocialLogin({
      providers: { google },
    }),
  ],
})
```

Types: `CreateSocialAuthEndpointsArgs`, `SocialAuthOnSuccess`, `SocialAuthOnSuccessArgs`, `SocialAuthOnError`, `SocialAuthOnErrorArgs`, `SocialAuthErrorCode` from `payload-simple-social-login/types`.

### Out of scope

- Built-in auto-create of auth users (use `findUserCallback`)
- Built-in OAuth account link/unlink (custom collection + `findUserCallback`)
- Social login UI outside the admin panel (use `createSocialAuthEndpoints` + your own UI)
- Providers other than Google and Microsoft
- IdP logout / token revocation (this plugin does not store provider tokens; Payload session logout is enough)

## Provider profiles

After a successful OAuth callback, the plugin loads the user profile from the IdP (**not** by decoding the access token). You receive it as `profile` in `findUserCallback`, plus normalized `profileEmail` / `profileId`.

Use the exported TypeScript types from `payload-simple-social-login/types` (`GoogleUserInfoProfile`, `MicrosoftGraphMeProfile`, `FindUserCallback`, etc.). Extra keys may appear depending on scopes / tenant; treat unknown fields as optional.

### Google (OpenID Connect UserInfo)

Endpoint: `GET https://openidconnect.googleapis.com/v1/userinfo`

Docs: [UserInfo response fields](https://developers.google.com/identity/openid-connect/reference#userinfofields)

Typical payload (fictional):

```json
{
  "sub": "100000000000000000001",
  "name": "Ada Lovelace",
  "given_name": "Ada",
  "family_name": "Lovelace",
  "picture": "https://lh3.googleusercontent.com/a/example-avatar",
  "email": "ada.lovelace@example.com",
  "email_verified": true,
  "hd": "example.com"
}
```

| Field | Notes |
| --- | --- |
| `sub` | Stable Google account id (preferred for long-term linking) |
| `email` / `email_verified` | From `email` scope; good match key for existing Payload users |
| `name`, `given_name`, `family_name`, `picture` | From `profile` scope |
| `hd` | Hosted domain for Google Workspace only; omitted for personal Gmail |

### Microsoft (Microsoft Graph `/me`)

Endpoint: `GET https://graph.microsoft.com/v1.0/me`

Docs: [Get user](https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0) · [user resource](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0)

Typical **default** payload (fictional). Graph returns only this common subset unless you `$select` more fields (this plugin does not `$select` today):

```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users/$entity",
  "businessPhones": [],
  "displayName": "Ada Lovelace",
  "givenName": "Ada",
  "jobTitle": null,
  "mail": "ada.lovelace@contoso.com",
  "mobilePhone": null,
  "officeLocation": null,
  "preferredLanguage": null,
  "surname": "Lovelace",
  "userPrincipalName": "ada.lovelace@contoso.com",
  "id": "00000000-0000-0000-0000-000000000001"
}
```

| Field | Notes |
| --- | --- |
| `id` | Stable Entra / MSA object id (GUID; preferred for long-term linking) |
| `mail` | SMTP address; may be `null`. Fall back to `userPrincipalName` |
| `userPrincipalName` | Sign-in name (often email-shaped) |
| `displayName`, `givenName`, `surname` | Display / name fields |
| `businessPhones`, `jobTitle`, `mobilePhone`, `officeLocation`, `preferredLanguage` | Often empty/`null` depending on the account |
| `@odata.context` | Graph metadata URL; ignore for matching |

## Developing this plugin

See [CONTRIBUTING.md](CONTRIBUTING.md).

## References

- [Building Your Own Plugin](https://payloadcms.com/docs/plugins/build-your-own)
- [Google OpenID Connect: UserInfo](https://developers.google.com/identity/openid-connect/reference#userinfofields)
- [Microsoft Graph: Get user](https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0)
- [Microsoft Graph: user resource](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0)
