import type { ProviderConfig, SocialProviderId } from '../types.js'

export type RedirectToLoginArgs = {
  redirectUri: string
  state: string
}

export type ExchangeCodeArgs = {
  code: string
  redirectUri: string
}

export type ExchangeCodeResult = {
  accessToken: string
}

export type FetchProfileArgs = {
  accessToken: string
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

  /** Exchange an authorization `code` for an access token. */
  abstract exchangeCode(args: ExchangeCodeArgs): Promise<ExchangeCodeResult>

  /** Load the user profile via the IdP userinfo / Graph API (not JWT decode). */
  abstract fetchProfile(args: FetchProfileArgs): Promise<Record<string, unknown>>

  /**
   * Build the IdP authorize URL the login endpoint should redirect to.
   * `state` is always required (CSRF).
   */
  abstract redirectToLogin(args: RedirectToLoginArgs): string
}

export class OAuthProviderError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'OAuthProviderError'
    this.status = status
  }
}
