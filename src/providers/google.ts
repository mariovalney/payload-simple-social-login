import type { GoogleProviderConfig } from '../types.js'

import { BaseProvider, type RedirectToLoginArgs } from './base.js'

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPES = 'openid email profile'

export class GoogleProvider extends BaseProvider {
  readonly id = 'google'

  constructor(config: GoogleProviderConfig) {
    super(config)
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
