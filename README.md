# payload-simple-social-login

A Payload CMS plugin for social login (OAuth) on the admin panel and authenticated collections.

It adds an “or login with” UI to the login form and OAuth endpoints per provider. Supported in this version: **Google** and **Microsoft** (Entra ID).

## Installation

TODO

## Configuration

TODO

## Usage

TODO

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

```bash
cd dev
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
