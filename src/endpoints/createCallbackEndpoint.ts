import type { Endpoint, PayloadRequest } from 'payload'

import type { BaseProvider } from '../providers/base.js'

import {
  clearOAuthStateCookie,
  isOAuthStateValid,
  isSecureRequest,
  readOAuthStateCookie,
} from '../utils/oauthState.js'
import { resolveAbsoluteCallbackUrl } from '../utils/resolveAbsoluteCallbackUrl.js'

const SSL_ERROR_QUERY = 'ssl-error'

const jsonWithCookie = (
  body: Record<string, unknown>,
  status: number,
  clearCookie: string,
): Response =>
  Response.json(body, {
    headers: {
      'Set-Cookie': clearCookie,
    },
    status,
  })

const redirectToLoginWithError = (req: PayloadRequest, clearCookie: string): Response => {
  const adminRoute = (req.payload.config.routes?.admin ?? '/admin').replace(/\/$/, '') || '/admin'
  const location = `${adminRoute}/login?${SSL_ERROR_QUERY}=1`

  return new Response(null, {
    headers: {
      Location: location,
      'Set-Cookie': clearCookie,
    },
    status: 302,
  })
}

export const createCallbackEndpoint = ({
  callbackURL,
  path,
  provider,
}: {
  callbackURL: string
  path: string
  provider: BaseProvider
}): Endpoint => ({
  handler: async (req) => {
    const requestUrl = req.url ?? 'http://localhost'
    const secure = isSecureRequest(requestUrl)
    const clearCookie = clearOAuthStateCookie({ providerId: provider.id, secure })

    const url = new URL(requestUrl)
    const queryState = url.searchParams.get('state') ?? undefined
    const cookieState = readOAuthStateCookie({
      headers: req.headers,
      providerId: provider.id,
    })

    if (!isOAuthStateValid({ cookieState, queryState })) {
      return redirectToLoginWithError(req, clearCookie)
    }

    const idpError = url.searchParams.get('error')
    const code = url.searchParams.get('code')
    if (idpError || !code) {
      return redirectToLoginWithError(req, clearCookie)
    }

    try {
      const redirectUri = resolveAbsoluteCallbackUrl({
        callbackURL,
        req,
      })
      const { accessToken } = await provider.exchangeCode({ code, redirectUri })
      const profile = await provider.fetchProfile({ accessToken })

      return jsonWithCookie(
        {
          type: 'callback',
          ok: true,
          profile,
          provider: provider.id,
        },
        200,
        clearCookie,
      )
    } catch {
      return redirectToLoginWithError(req, clearCookie)
    }
  },
  method: 'get',
  path,
})
