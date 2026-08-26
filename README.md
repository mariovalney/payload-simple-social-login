# payload-simple-social-login

A Payload CMS plugin for social login (OAuth) on the admin panel and authenticated collections.

It adds an “or login with” UI to the login form and OAuth endpoints per provider. Supported in this version: **Google** and **Microsoft** (Entra ID).

## Installation

Install the package, add the plugin to your Payload config, then regenerate the admin import map so the login buttons resolve:

```bash
pnpm add payload-simple-social-login
pnpm payload generate:importmap
```

(or `npx payload generate:importmap` / your package manager’s equivalent)

Without this step, the `afterLogin` social buttons may not appear in the admin panel.

## Configuration

TODO

## Provider profiles

After a successful OAuth callback, the plugin loads the user profile from the IdP
(**not** by decoding the access token). The object is what you receive as
`profile` in `findUserCallback` (and in the temporary JSON stub while login is
still WIP).

Use the exported TypeScript types `GoogleUserInfoProfile` and
`MicrosoftGraphMeProfile` for field names and JSDoc. Extra keys may appear
depending on scopes / tenant; treat unknown fields as optional.

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

## Development

Local environment for developing and testing the plugin (`dev/`).

### Prerequisites

- Node.js
- pnpm

### Setup

From the repository root:

```bash
pnpm install
cp dev/.env.example dev/.env
```

Set a `PAYLOAD_SECRET` in `dev/.env`.

### Run the test app

From the repository root:

```bash
pnpm dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin).

The database is SQLite (`dev/payload.db`), created automatically — no external MongoDB required.

### Test credentials

The seed creates an admin user if one does not already exist:

| Field    | Value                |
| -------- | -------------------- |
| Email    | `dev@payloadcms.com` |
| Password | `test`               |

### Commits

Use the **commit** skill (`/commit`, `.agents/skills/commit/`) for all commits. Do not invent ad-hoc messages outside that workflow.

## References

- [Building Your Own Plugin](https://payloadcms.com/docs/plugins/build-your-own)
- [Google OpenID Connect — UserInfo](https://developers.google.com/identity/openid-connect/reference#userinfofields)
- [Microsoft Graph — Get user](https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0)
- [Microsoft Graph — user resource](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0)
