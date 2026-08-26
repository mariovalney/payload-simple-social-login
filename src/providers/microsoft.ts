import type { MicrosoftProviderConfig } from '../types.js'

import { BaseProvider, type RedirectToLoginArgs } from './base.js'

const DEFAULT_TENANT = 'common'
const MICROSOFT_SCOPES = 'openid email profile'

export class MicrosoftProvider extends BaseProvider {
  readonly id = 'microsoft'
  readonly tenant: string

  constructor(config: MicrosoftProviderConfig) {
    super(config)
    this.tenant = config.tenant?.trim() || DEFAULT_TENANT
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
