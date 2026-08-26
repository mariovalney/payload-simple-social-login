import type { MicrosoftProviderConfig } from '../types.js'

import {
  BaseProvider,
  type ExchangeCodeArgs,
  type ExchangeCodeResult,
  type FetchProfileArgs,
  OAuthProviderError,
  type RedirectToLoginArgs,
} from './base.js'

const DEFAULT_TENANT = 'common'
const MICROSOFT_SCOPES = 'openid email profile User.Read'
const MICROSOFT_GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me'

export class MicrosoftProvider extends BaseProvider {
  readonly id = 'microsoft'
  readonly tenant: string

  constructor(config: MicrosoftProviderConfig) {
    super(config)
    this.tenant = config.tenant?.trim() || DEFAULT_TENANT
  }

  async exchangeCode({ code, redirectUri }: ExchangeCodeArgs): Promise<ExchangeCodeResult> {
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(this.tenant)}/oauth2/v2.0/token`
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      scope: MICROSOFT_SCOPES,
    })

    const response = await fetch(tokenUrl, {
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
      throw new OAuthProviderError(`Microsoft token exchange failed: ${detail}`, 502)
    }

    return { accessToken: data.access_token }
  }

  async fetchProfile({ accessToken }: FetchProfileArgs): Promise<Record<string, unknown>> {
    const response = await fetch(MICROSOFT_GRAPH_ME_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

    if (!response.ok) {
      const detail =
        typeof data.error === 'object' &&
        data.error !== null &&
        'message' in data.error &&
        typeof (data.error as { message?: unknown }).message === 'string'
          ? (data.error as { message: string }).message
          : `HTTP ${response.status}`
      throw new OAuthProviderError(`Microsoft Graph profile failed: ${detail}`, 502)
    }

    return data
  }

  redirectToLogin({ redirectUri, state }: RedirectToLoginArgs): string {
    const url = new URL(
      `https://login.microsoftonline.com/${encodeURIComponent(this.tenant)}/oauth2/v2.0/authorize`,
    )
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', MICROSOFT_SCOPES)
    url.searchParams.set('response_mode', 'query')
    // Always show the account picker.
    url.searchParams.set('prompt', 'select_account')
    url.searchParams.set('state', state)
    return url.toString()
  }
}
