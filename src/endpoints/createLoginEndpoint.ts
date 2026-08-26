import type { Endpoint, PayloadRequest } from 'payload'

import type { BaseProvider } from '../providers/base.js'

import {
  buildOAuthStateCookie,
  createOAuthState,
  isSecureRequest,
} from '../utils/oauthState.js'

const resolveAbsoluteCallbackUrl = ({
  callbackURL,
  req,
}: {
  callbackURL: string
  req: PayloadRequest
}): string => {
  const apiRoute = (req.payload.config.routes?.api ?? '/api').replace(/\/$/, '') || '/api'
  const path = `${apiRoute}${callbackURL.startsWith('/') ? callbackURL : `/${callbackURL}`}`

  const serverURL = req.payload.config.serverURL?.replace(/\/$/, '')
  if (serverURL) {
    return `${serverURL}${path}`
  }

  const requestUrl = req.url ?? 'http://localhost'
  return new URL(path, requestUrl).toString()
}

export const createLoginEndpoint = ({
  callbackURL,
  path,
  provider,
}: {
  callbackURL: string
  path: string
  provider: BaseProvider
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
          providerId: provider.id,
          secure,
          state,
        }),
      },
      status: 302,
    })
  },
  method: 'get',
  path,
})
