import type { CollectionSlug, Payload } from 'payload'

/**
 * Shared OAuth options for every provider.
 */
export type ProviderConfig = {
  /**
   * OAuth callback path (Payload root endpoint).
   * @default `/auth/{providerId}/callback`
   */
  callbackURL?: string
  /** OAuth application client ID. */
  clientId: string
  /** OAuth application client secret. */
  clientSecret: string
  /**
   * Label for the social login button.
   * Falls back to the plugin i18n string for this provider when omitted.
   */
  label?: string
  /**
   * Login start path. Same value for the button `href` base and the Payload endpoint path.
   * @default `/auth/{providerId}/login`
   */
  loginUrl?: string
}

/** Google-specific options beyond {@link ProviderConfig}. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no Google-only options yet
export type GoogleProviderSpecific = {}

export type GoogleProviderConfig = GoogleProviderSpecific & ProviderConfig

/** Microsoft/Entra-specific options beyond {@link ProviderConfig}. */
export type MicrosoftProviderSpecific = {
  /**
   * Entra ID tenant for authorize/token URLs.
   * - `common` (default) — personal Microsoft accounts (Hotmail, Outlook, etc.) and any work/school tenant
   * - `organizations` — work/school accounts only
   * - `consumers` — personal Microsoft accounts only
   * - A tenant ID or domain — restrict to that directory
   * @default `common`
   */
  tenant?: string
}

export type MicrosoftProviderConfig = MicrosoftProviderSpecific & ProviderConfig

export type SocialProviderId = 'google' | 'microsoft'

/**
 * Google UserInfo response (`GET https://openidconnect.googleapis.com/v1/userinfo`).
 *
 * Official field list:
 * {@link https://developers.google.com/identity/openid-connect/reference#userinfofields | Google OpenID Connect — UserInfo fields}
 *
 * Example (fictional):
 * ```ts
 * {
 *   sub: '100000000000000000001',
 *   name: 'Ada Lovelace',
 *   given_name: 'Ada',
 *   family_name: 'Lovelace',
 *   picture: 'https://lh3.googleusercontent.com/a/example-avatar',
 *   email: 'ada.lovelace@example.com',
 *   email_verified: true,
 *   hd: 'example.com', // Google Workspace only; omitted for personal Gmail
 * }
 * ```
 *
 * For matching a Payload user, prefer `email` (and optionally `email_verified`) plus
 * stable IdP id `sub`.
 */
export type GoogleUserInfoProfile = {
  /** User email address (requires `email` scope). */
  email?: string
  /** Whether Google has verified the email address. */
  email_verified?: boolean
  /** Surname / last name (requires `profile` scope). */
  family_name?: string
  /** Given / first name (requires `profile` scope). */
  given_name?: string
  /**
   * Hosted domain for Google Workspace / Cloud Identity accounts
   * (e.g. `example.com`). Absent for consumer Gmail accounts.
   */
  hd?: string
  /** Displayable full name (requires `profile` scope). */
  name?: string
  /** Profile picture URL (requires `profile` scope). */
  picture?: string
  /**
   * Stable Google account identifier. Unique across Google Accounts and never reused.
   * Prefer this over email when linking accounts long-term.
   */
  sub: string
}

/**
 * Default Microsoft Graph `/me` user properties
 * (`GET https://graph.microsoft.com/v1.0/me`).
 *
 * Graph returns only a **subset** of user fields by default. Full resource:
 * {@link https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0 | user resource type};
 * default set / `$select`:
 * {@link https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0 | Get user}.
 *
 * Example (fictional):
 * ```ts
 * {
 *   '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users/$entity',
 *   businessPhones: [],
 *   displayName: 'Ada Lovelace',
 *   givenName: 'Ada',
 *   jobTitle: null,
 *   mail: 'ada.lovelace@contoso.com',
 *   mobilePhone: null,
 *   officeLocation: null,
 *   preferredLanguage: null,
 *   surname: 'Lovelace',
 *   userPrincipalName: 'ada.lovelace@contoso.com',
 *   id: '00000000-0000-0000-0000-000000000001',
 * }
 * ```
 *
 * For matching a Payload user, prefer `mail` (fallback `userPrincipalName` when
 * `mail` is null) plus stable IdP id `id`.
 */
export type MicrosoftGraphMeProfile = {
  /** OData metadata URL; present on Graph JSON responses. */
  '@odata.context'?: string
  /** Business / work phone numbers. */
  businessPhones?: string[]
  /** Name shown in the address book. */
  displayName?: null | string
  /** First / given name. */
  givenName?: null | string
  /**
   * Stable Microsoft identity object id (GUID). Prefer this over email when
   * linking accounts long-term.
   */
  id: string
  /** Job title. */
  jobTitle?: null | string
  /**
   * SMTP email address. May be `null` for some personal or incomplete accounts —
   * then use `userPrincipalName`.
   */
  mail?: null | string
  /** Mobile phone number. */
  mobilePhone?: null | string
  /** Physical office location. */
  officeLocation?: null | string
  /** Preferred UI language (e.g. `en-US`). */
  preferredLanguage?: null | string
  /** Last / family name. */
  surname?: null | string
  /**
   * User principal name (sign-in name), often `user@tenant.onmicrosoft.com` or
   * a verified email domain.
   */
  userPrincipalName?: null | string
}

/** Profile shape returned by {@link SocialProviderId} after OAuth userinfo / Graph. */
export type SocialProviderProfile = GoogleUserInfoProfile | MicrosoftGraphMeProfile

/** Minimal user document returned from {@link FindUserCallback}. */
export type SocialLoginUser = {
  [key: string]: unknown
  email?: string
  id: number | string
}

export type FindUserCallbackArgs = {
  payload: Payload
  /**
   * Raw IdP profile from UserInfo (Google) or Graph `/me` (Microsoft).
   * Narrow with `provider`, or cast to {@link GoogleUserInfoProfile} /
   * {@link MicrosoftGraphMeProfile}. See those types for fields and docs links.
   */
  profile: Record<string, unknown>
  /**
   * Normalized email from the IdP profile, or `null` if missing.
   * Google: `email`. Microsoft: `mail ?? userPrincipalName`.
   */
  profileEmail: null | string
  /**
   * Stable IdP subject / object id, or `null` if missing.
   * Google: `sub`. Microsoft: `id`.
   */
  profileId: null | string
  provider: SocialProviderId
}

/**
 * Resolve an existing user from the provider profile, or `null` if none.
 *
 * May create and return a user (find-or-create) — the plugin never auto-creates
 * by itself. Returning `null` denies login (`ssl-error=not-found`).
 *
 * When omitted, the default email match also rejects unverified users on
 * collections with `auth.verify` (`ssl-error=unverified`), unless
 * `autoVerify` is enabled on that collection entry. A custom callback
 * owns that check: if you return an unverified user, the plugin still issues a
 * JWT and Payload’s admin JWT strategy may refuse the session silently.
 */
export type FindUserCallback = (args: FindUserCallbackArgs) => Promise<null | SocialLoginUser>

export type CollectionSocialLoginConfig = {
  /**
   * When using the default email match on a collection with `auth.verify`,
   * set `_verified: true` (only that field) if the matched user is unverified,
   * then continue login. Ignored when `findUserCallback` is set or the
   * collection has no `auth.verify`.
   * @default false
   */
  autoVerify?: boolean
  collection: CollectionSlug
  /**
   * Locate (or optionally create) a Payload user for this collection.
   * When omitted, the plugin matches by `profileEmail` and respects `auth.verify`
   * (and `autoVerify` when set). When set, you own verification / `_verified` handling.
   */
  findUserCallback?: FindUserCallback
}

export type PayloadSimpleSocialLoginConfig = {
  /**
   * Authenticated collections this plugin should serve.
   * When omitted, defaults to `[{ collection: admin.user }]` with email match.
   */
  collections?: CollectionSocialLoginConfig[]
  /**
   * Disable the plugin without uninstalling it.
   * Endpoints and UI are not registered when true.
   */
  disabled?: boolean
  /**
   * OAuth providers to enable. At least the `providers` object is required;
   * individual providers are optional until configured.
   */
  providers: {
    google?: GoogleProviderConfig
    microsoft?: MicrosoftProviderConfig
  }
  /**
   * Show social login buttons on the admin login form (`afterLogin`).
   * @default true
   */
  showButtonOnLogin?: boolean
}
