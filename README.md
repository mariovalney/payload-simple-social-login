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
| `collections[].findUserCallback` | Optional. Locate (or create, in your app) a user. When omitted: match by `profileEmail`. |
| `showButtonOnLogin` | Show buttons on the admin login form. Default `true`. |
| `disabled` | Skip registering endpoints and UI. Default `false`. |

### Finding users

After OAuth, the plugin normalizes `profileEmail` and `profileId` and calls each collection’s `findUserCallback` (or the default email match). The first returned user is logged in (JWT cookie) and the browser is redirected to the admin panel. If none match → `/admin/login?ssl-error=not-found`.

| Arg | Google | Microsoft |
| --- | --- | --- |
| `profileId` | `sub` | `id` |
| `profileEmail` | `email` | `mail ?? userPrincipalName` |

**This plugin never auto-creates users** and will not add a built-in create path. Payload has no standardized way to create auth users (required fields, password, verify, roles, tenants, hooks differ per app). Provisioning belongs in your `findUserCallback` if you want it.

**Link / unlink of OAuth accounts is also out of scope.** If you need that, model your own collection (e.g. `oauth-accounts` with `provider`, `profileId`, relation to the user) and override `findUserCallback` to resolve users through it.

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
| `not-found` | No Payload user returned from `findUserCallback` / default email match | Account not found |

### Out of scope

- Built-in auto-create of auth users (use `findUserCallback`)
- Built-in OAuth account link/unlink (custom collection + `findUserCallback`)
- Social login UI outside the admin panel
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

Typical **default** payload (fictional) — Graph returns only this common subset unless you `$select` more fields (this plugin does not `$select` today):

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
| `mail` | SMTP address; may be `null` — fall back to `userPrincipalName` |
| `userPrincipalName` | Sign-in name (often email-shaped) |
| `displayName`, `givenName`, `surname` | Display / name fields |
| `businessPhones`, `jobTitle`, `mobilePhone`, `officeLocation`, `preferredLanguage` | Often empty/`null` depending on the account |
| `@odata.context` | Graph metadata URL; ignore for matching |

## Developing this plugin

See [CONTRIBUTING.md](CONTRIBUTING.md).

## References

- [Building Your Own Plugin](https://payloadcms.com/docs/plugins/build-your-own)
- [Google OpenID Connect — UserInfo](https://developers.google.com/identity/openid-connect/reference#userinfofields)
- [Microsoft Graph — Get user](https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0)
- [Microsoft Graph — user resource](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0)
