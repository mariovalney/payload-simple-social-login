import type { Endpoint } from 'payload'

import type { SocialProviderId } from '../types.js'

import {
  clearOAuthStateCookie,
  isOAuthStateValid,
  isSecureRequest,
  readOAuthStateCookie,
} from '../utils/oauthState.js'

export const createCallbackEndpoint = ({
  path,
  providerId,
}: {
  path: string
  providerId: SocialProviderId
}): Endpoint => ({
  handler: (req) => {
    const requestUrl = req.url ?? 'http://localhost'
    const secure = isSecureRequest(requestUrl)
    const clearCookie = clearOAuthStateCookie({ providerId, secure })

    const url = new URL(requestUrl)
    const queryState = url.searchParams.get('state') ?? undefined
    const cookieState = readOAuthStateCookie({
      headers: req.headers,
      providerId,
    })

    if (!isOAuthStateValid({ cookieState, queryState })) {
      return Response.json(
        {
          type: 'callback',
          error: 'invalid_state',
          ok: false,
          provider: providerId,
        },
        {
          headers: {
            'Set-Cookie': clearCookie,
          },
          status: 400,
        },
      )
    }

    return Response.json(
      {
        type: 'callback',
        ok: true,
        provider: providerId,
      },
      {
        headers: {
          'Set-Cookie': clearCookie,
        },
        status: 200,
      },
    )
  },
  method: 'get',
  path,
})
