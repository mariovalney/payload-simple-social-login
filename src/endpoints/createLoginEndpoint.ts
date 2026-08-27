import type { Endpoint } from 'payload'

import type { BaseProvider } from '../providers/base.js'

import {
  buildOAuthStateCookie,
  createOAuthState,
  isSecureRequest,
} from '../utils/oauthState.js'
import { resolveAbsoluteCallbackUrl } from '../utils/resolveAbsoluteCallbackUrl.js'

export const createLoginEndpoint = ({
  callbackURL,
  path,
  provider,
  stateCookieName,
}: {
  callbackURL: string
  path: string
  provider: BaseProvider
  stateCookieName: string
}): Endpoint => ({
  handler: (req) => {
    const redirectUri = resolveAbsoluteCallbackUrl({ callbackURL, req })
    const state = createOAuthState()
    const authorizeUrl = provider.redirectToLogin({ redirectUri, state })
    const secure = isSecureRequest(req.url)

    return new Response(null, {
      headers: {
        Location: authorizeUrl,
        'Set-Cookie': buildOAuthStateCookie({
          secure,
          state,
          stateCookieName,
        }),
      },
      status: 302,
    })
  },
  method: 'get',
  path,
})
