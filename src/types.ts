import type { CollectionSlug, Payload } from 'payload'

/**
 * Shared OAuth options for every provider.
 * Fields (clientId, clientSecret, scopes, etc.) will be added later.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- shared fields TBD
export type ProviderConfig = {}

/** Google-specific options beyond {@link ProviderConfig}. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Google fields TBD
export type GoogleProviderSpecific = {}

export type GoogleProviderConfig = GoogleProviderSpecific & ProviderConfig

/** Microsoft/Entra-specific options beyond {@link ProviderConfig}. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Microsoft fields TBD
export type MicrosoftProviderSpecific = {}

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
}
