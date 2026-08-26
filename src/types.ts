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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Google fields TBD
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

export type FindUserCallbackArgs = {
  payload: Payload
  profile: Record<string, unknown>
  provider: SocialProviderId
}

/** Resolve an existing user from the provider profile, or `null` if none. */
export type FindUserCallback = (args: FindUserCallbackArgs) => Promise<unknown>

export type CollectionSocialLoginConfig = {
  collection: CollectionSlug
  findUserCallback: FindUserCallback
}

export type PayloadSimpleSocialLoginConfig = {
  /**
   * Authenticated collections this plugin should serve.
   * If omitted, a default (likely `admin.user`) will be used later.
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
