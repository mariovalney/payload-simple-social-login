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
      // serverURL: 'https://app.example.com',
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
| `providers.microsoft.tenant` | Entra tenant segment. Default `common`. Pin a tenant ID or domain when only one directory should sign in. See [Microsoft tenant](#microsoft-tenant). |
| `providers.*.serverURL` | Optional. Origin used to build this provider `redirect_uri` (`https://app.example.com`). String or `(req) => string \| null`. Takes precedence over the plugin `serverURL` and over `serverURL` from the Payload config. |
| `collections` | Auth collections to resolve users for. When omitted: `[{ collection: admin.user }]` with email match. |
| `collections[].autoVerify` | Optional. Default find only: if the collection has `auth.verify` and the user is unverified, set `_verified: true` (only that field) and continue. Default `false`. Ignored when `findUserCallback` is set. |
| `collections[].findUserCallback` | Optional. Locate (or create, in your app) a user. When omitted: match by `profileEmail` and respect `auth.verify` / `autoVerify`. |
| `serverURL` | Optional. Same as `providers.*.serverURL`, applied to every provider. Used when the provider does not define its own. See [Deploying behind a proxy](#deploying-behind-a-proxy). |
| `showButtonOnLogin` | Show buttons on the admin login form. Default `true`. |
| `disabled` | Skip registering endpoints and UI. Default `false`. |

### Deploying behind a proxy

The OAuth `redirect_uri` must be the **public** URL of the app, and both the login and the callback endpoints must send the exact same value, otherwise the IdP answers `redirect_uri_mismatch`.

The plugin resolves the origin in this order:

1. `serverURL` from the plugin options (`providers.*.serverURL` first, then the top level `serverURL`)
2. `serverURL` from the Payload config
3. The request origin, built from the `Host` header, and only when that origin is listed in `cors` / `csrf`
4. `req.url`, with a warning recommending `serverURL`

Step 4 is the fallback that breaks behind a proxy. `req.url` is **not** the public URL: Next builds it as `${protocol}://${fetchHostname}:${port}${req.url}`, where the hostname falls back to `localhost` and the port is the internal container port, so the callback becomes something like `https://localhost:80/api/auth/microsoft/callback`. The real public host travels in the `Host` header. Payload also defaults `serverURL` to an empty string, so this fallback is the common path, not an edge case.

Steps 3 and 4 mirror what Payload core does in `getRequestOrigin` (used for verification and reset password links): the `Host` header is only trusted when it is in the CORS / CSRF allowlist, since it is client controlled. A `cors: '*'` is not an allowlist and is never trusted.

Pick one of these in production:

```ts
export default buildConfig({
  // Recommended: single public origin for the whole app
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL, // https://app.example.com
  // or, keeping serverURL empty, allowlist the public origin
  cors: ['https://app.example.com'],
  csrf: ['https://app.example.com'],
})
```

When one process serves more than one public host (admin on one domain, SSO on another), use the function form. It runs per request, so nothing needs to mutate the shared `req.payload.config.serverURL`:

```ts
payloadSimpleSocialLogin({
  providers: { microsoft: { clientId, clientSecret } },
  serverURL: (req) => {
    const host = req.headers.get('host')
    return host ? `https://${host}` : null
  },
})
```

Return `null` or `undefined` to fall back to the next source in the chain. Register every resulting redirect URI in the IdP console.

The `Secure` flag of the OAuth `state` cookie follows the same logic: `x-forwarded-proto` first, then the resolved origin.

### How accounts are matched

**The plugin only accepts emails verified by the provider.** There is no option to sign in with an unverified address: without one, login fails with `email_unverified` and neither `findUserCallback` nor `onSuccess` runs.

Since 1.1.3, `profileEmail` is only set to an address the provider vouches for, trimmed and lowercased (Payload stores auth emails in lowercase and the default match is an exact `equals`):

| Arg | Google | Microsoft |
| --- | --- | --- |
| `profileId` | `sub` | `id` |
| `profileEmail` | `email`, only when `email_verified === true` | `userPrincipalName` only; never `mail` |

- **Google:** the [UserInfo endpoint](https://developers.google.com/identity/openid-connect/reference#userinfofields) returns `email_verified` as a boolean. Any other value (`false`, missing, a string, a number) means no `profileEmail`.
- **Microsoft:** the [user principal name](https://learn.microsoft.com/graph/api/resources/user?view=graph-rest-1.0) must belong to a domain the tenant verified in DNS, and for a personal Microsoft account it is the sign-in address Microsoft verified. A missing UPN, a UPN that is not email-shaped, or a guest UPN (contains `#EXT#`, any case) means no `profileEmail`.
- **Why `mail` is ignored:** a tenant admin can set `mail` to any address without proving they own its domain, so it does not identify a person across tenants. Microsoft's own guidance is that [apps should never use the email claim for authorization](https://learn.microsoft.com/graph/applications-authenticationbehaviors#prevent-the-issuance-of-email-claims-with-unverified-domain-owners). Users whose `mail` differs from their UPN sign in by the UPN; make sure the Payload account uses that address.

When there is no such address, the callback stops with `email_unverified` before `onSuccess`, before any `findUserCallback`, and before any database lookup. No flow receives `profileEmail: null`.

> [!WARNING]
> In `findUserCallback` and `onSuccess`, match, link, or create accounts with `profileEmail` (or `profileId`), never with `profile.email` or `profile.mail`. The raw `profile` is passed through untouched, so reading the email from it skips every check above. The only exception is a pinned, trusted tenant: see [Example: also accept Microsoft `mail`](#example-also-accept-microsoft-mail-trusted-tenant-only).

#### Microsoft tenant

The default `tenant: 'common'` stays, because accepting work, school, and personal accounts from any tenant is a legitimate use. Since matching uses only the UPN, accepting any tenant does not let one directory sign in as another directory's users.

When only one directory should sign in (an internal admin panel, for example), pin it anyway:

```ts
microsoft: {
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  tenant: process.env.MICROSOFT_TENANT_ID!, // or 'contoso.com'
},
```

### Finding users

After OAuth, the plugin normalizes `profileEmail` and `profileId` (see [How accounts are matched](#how-accounts-are-matched)) and calls each collection’s `findUserCallback` (or the default email match). The first returned user is logged in (JWT cookie) and the browser is redirected to the admin panel. If none match → `/admin/login?ssl-error=not_found`.

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

#### Example: also accept Microsoft `mail` (trusted tenant only)

This does not relax the rule above: the user still needs a verified UPN to reach the callback, and `mail` only becomes an extra lookup key decided by your app. Some directories register people in Payload by their `mail` while their UPN is different (e.g. UPN `ada@contoso.onmicrosoft.com`, `mail` `ada@contoso.com`). Since 1.1.3 those users get `not_found`. If you cannot change the Payload emails to the UPN, a `findUserCallback` can fall back to `mail`.

> [!CAUTION]
> `mail` is not verified by Microsoft: any admin of the tenant that signs in can set it to any address, including one that belongs to a user of yours. Accepting it means trusting every admin of that tenant with every account in your collection. Only do this with `tenant` pinned to a directory you control or fully trust, never with `common`, `organizations` or `consumers`. With those, anyone can create a tenant and sign in as any of your users.

```ts
payloadSimpleSocialLogin({
  providers: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      // Required by the fallback below: only this directory can reach the callback.
      tenant: process.env.MICROSOFT_TENANT_ID!,
    },
  },
  collections: [
    {
      collection: 'users',
      findUserCallback: async ({ payload, profile, profileEmail, provider }) => {
        const findByEmail = async (email: string) => {
          const result = await payload.find({
            collection: 'users',
            limit: 1,
            overrideAccess: true,
            where: { email: { equals: email } },
          })
          const user = result.docs[0]
          return user ? { ...user } : null
        }

        // The verified UPN always wins, so `mail` can never shadow another account's UPN match.
        const byUpn = await findByEmail(profileEmail)
        if (byUpn || provider !== 'microsoft') return byUpn

        // Safe only because `tenant` is pinned to a trusted directory.
        const mail = typeof profile.mail === 'string' ? profile.mail.trim().toLowerCase() : ''
        return mail ? findByEmail(mail) : null
      },
    },
  ],
})
```

Things to keep in mind:

- This only helps users with a valid UPN. Guests (`#EXT#`), accounts without an email-shaped UPN and Google accounts with an unverified email stop with `email_unverified` before any `findUserCallback` runs, so a callback cannot accept them.
- A custom `findUserCallback` owns `auth.verify`: the plugin does not check `_verified` here.
- The callback runs for every provider of that collection. Keep the `provider` check so Google never uses this path.
- To trust more than one directory, register one flow per tenant with [`createSocialAuthEndpoints`](#custom-endpoints) (each with its own `tenant`, `loginUrl` and `callbackURL`) instead of widening `tenant`. Graph `/me` does not tell which tenant the user came from, so the pinned `tenant` is the only check available.

### Errors

OAuth callback failures redirect to the admin login form with `?ssl-error=<code>` and a toast:

| Code | When | Toast |
| --- | --- | --- |
| `email_unverified` | The provider returned no email it vouches for (Google `email_verified` not `true`; Microsoft UPN missing, not an email, or a guest). See [How accounts are matched](#how-accounts-are-matched) | No verified email on this account |
| `login` | Invalid/missing state, missing code, IdP error, token/profile failure | Generic “try again” |
| `not_found` | No Payload user returned from `findUserCallback` / default email match | Account not found |
| `unverified` | Default findUser: collection has `auth.verify`, matched user has `_verified: false`, and `autoVerify` is not enabled | Please verify your email before logging in |

`email_unverified` and `unverified` are different checks: the first is about the provider account (no verified email from Google or Microsoft), the second about the Payload user (`_verified: false` in a collection with `auth.verify`).

In custom flows the same codes reach `onError` as `code` (without `onError`, the response is `{ "error": "<code>" }` with status `404` for `not_found` and `400` otherwise).

Toast messages come from the `plugin-simple-social-login` i18n namespace and can be overridden in `i18n.translations`:

| Code | Key | Default (`en`) |
| --- | --- | --- |
| `email_unverified` | `providerEmailNotVerified` | This account has no verified email address we can use. Sign in with an account whose email is verified, or ask an admin for access. |
| `login` | `loginFailed` | Something went wrong. Please try again. |
| `not_found` | `userNotFound` | No account found for this email. Ask an admin for access. |
| `unverified` | `emailNotVerified` | Please verify your email before logging in. |

### Custom endpoints

Use `createSocialAuthEndpoints` when you need extra OAuth flows (frontend app, account linking, JSON callback) without duplicating provider logic. It accepts the **same** provider config as the plugin (`clientId`, `clientSecret`, optional `loginUrl` / `callbackURL`, `serverURL`, `tenant` for Microsoft).

Register the returned pair on `config.endpoints`. You do **not** need the plugin in `plugins[]` for custom-only flows; use both when you want admin login plus extra URLs.

**Admin default (plugin):** pass `collections` and omit `onSuccess`. Same as `payloadSimpleSocialLogin`: find user, JWT cookie, redirect to `/admin`.

**Custom flow:** pass `onSuccess` (and optional `onError`). After token exchange and IdP profile fetch, your callback returns a `Response`. No automatic Payload login. `profileEmail` is always a verified, lowercased address: when the provider gives none, `onSuccess` is not called and `onError` receives `code: 'email_unverified'` (without `onError`, the response is `400 { "error": "email_unverified" }`).

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

const appGoogleSuccess: SocialAuthOnSuccess = async ({ req, profileEmail, profileId }) => {
  // Your logic: find-or-create, link account, issue your own session, etc.
  // Match by profileEmail / profileId, never by profile.email or profile.mail.
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

Types: `CreateSocialAuthEndpointsArgs`, `SocialLoginServerURL`, `SocialAuthOnSuccess`, `SocialAuthOnSuccessArgs`, `SocialAuthOnError`, `SocialAuthOnErrorArgs`, `SocialAuthErrorCode` from `payload-simple-social-login/types`.

### Out of scope

- Built-in auto-create of auth users (use `findUserCallback`)
- Built-in OAuth account link/unlink (custom collection + `findUserCallback`)
- Social login UI outside the admin panel (use `createSocialAuthEndpoints` + your own UI)
- Providers other than Google and Microsoft
- IdP logout / token revocation (this plugin does not store provider tokens; Payload session logout is enough)

## Provider profiles

After a successful OAuth callback, the plugin loads the user profile from the IdP (**not** by decoding the access token). You receive it as `profile` in `findUserCallback`, plus normalized `profileEmail` / `profileId`. Use `profile` for display fields only; account matching belongs to `profileEmail` / `profileId` (see [How accounts are matched](#how-accounts-are-matched)).

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
| `email` / `email_verified` | From `email` scope. `email` becomes `profileEmail` only when `email_verified` is `true` |
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
| `mail` | SMTP address; may be `null`. Editable by tenant admins without domain proof; never used for matching |
| `userPrincipalName` | Sign-in name in a tenant-verified domain; becomes `profileEmail` (guests with `#EXT#` excluded) |
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
- [Microsoft Graph: prevent email claims with unverified domain owners](https://learn.microsoft.com/graph/applications-authenticationbehaviors#prevent-the-issuance-of-email-claims-with-unverified-domain-owners)
