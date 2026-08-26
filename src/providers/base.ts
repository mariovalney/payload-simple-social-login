import type { ProviderConfig, SocialProviderId } from '../types.js'

export type RedirectToLoginArgs = {
  redirectUri: string
  state: string
}

export abstract class BaseProvider {
  readonly clientId: string
  readonly clientSecret: string
  readonly config: ProviderConfig
  abstract readonly id: SocialProviderId

  constructor(config: ProviderConfig) {
    this.config = config
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
  }

  /**
   * Build the IdP authorize URL the login endpoint should redirect to.
   * `state` is always required (CSRF).
   */
  abstract redirectToLogin(args: RedirectToLoginArgs): string
}
