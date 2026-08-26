import type { GoogleProviderConfig } from '../types.js'

import {
  BaseProvider,
  type ExchangeCodeArgs,
  type ExchangeCodeResult,
  type FetchProfileArgs,
  OAuthProviderError,
  type RedirectToLoginArgs,
} from './base.js'

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GOOGLE_SCOPES = 'openid email profile'

export class GoogleProvider extends BaseProvider {
  readonly id = 'google'

  constructor(config: GoogleProviderConfig) {
    super(config)
  }

  async exchangeCode({ code, redirectUri }: ExchangeCodeArgs): Promise<ExchangeCodeResult> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })

    const response = await fetch(GOOGLE_TOKEN_URL, {
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

    if (!response.ok || typeof data.access_token !== 'string') {
      const detail =
        typeof data.error_description === 'string'
          ? data.error_description
          : typeof data.error === 'string'
            ? data.error
            : `HTTP ${response.status}`
      throw new OAuthProviderError(`Google token exchange failed: ${detail}`, 502)
    }

    return { accessToken: data.access_token }
  }

  async fetchProfile({ accessToken }: FetchProfileArgs): Promise<Record<string, unknown>> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

    if (!response.ok) {
      const detail =
        typeof data.error_description === 'string'
          ? data.error_description
          : typeof data.error === 'string'
            ? data.error
            : `HTTP ${response.status}`
      throw new OAuthProviderError(`Google userinfo failed: ${detail}`, 502)
    }

    return data
  }

  redirectToLogin({ redirectUri, state }: RedirectToLoginArgs): string {
    const url = new URL(GOOGLE_AUTHORIZE_URL)
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GOOGLE_SCOPES)
    // Always show the account picker (not the same as consent).
    url.searchParams.set('prompt', 'select_account')
    url.searchParams.set('state', state)
    return url.toString()
  }
}
