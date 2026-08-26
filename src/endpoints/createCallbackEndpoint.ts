import type { Endpoint, PayloadRequest } from 'payload'

import type { BaseProvider } from '../providers/base.js'
import type { CollectionSocialLoginConfig, SocialLoginUser } from '../types.js'

import { defaultFindUserByEmail } from '../utils/defaultFindUserByEmail.js'
import { loginUserWithoutPassword } from '../utils/loginUserWithoutPassword.js'
import { normalizeProviderProfile } from '../utils/normalizeProviderProfile.js'
import {
  clearOAuthStateCookie,
  isOAuthStateValid,
  isSecureRequest,
  readOAuthStateCookie,
} from '../utils/oauthState.js'
import { resolveAbsoluteCallbackUrl } from '../utils/resolveAbsoluteCallbackUrl.js'

export type SslErrorCode = 'login' | 'not-found'

const SSL_ERROR_QUERY = 'ssl-error'

const redirectToLoginWithError = (
  req: PayloadRequest,
  clearCookie: string,
  error: SslErrorCode = 'login',
): Response => {
  const adminRoute = (req.payload.config.routes?.admin ?? '/admin').replace(/\/$/, '') || '/admin'
  const location = `${adminRoute}/login?${SSL_ERROR_QUERY}=${error}`

  return new Response(null, {
    headers: {
      Location: location,
      'Set-Cookie': clearCookie,
    },
    status: 302,
  })
}

const redirectToAdminWithSession = ({
  authCookie,
  clearCookie,
  req,
}: {
  authCookie: string
  clearCookie: string
  req: PayloadRequest
}): Response => {
  const adminRoute = (req.payload.config.routes?.admin ?? '/admin').replace(/\/$/, '') || '/admin'
  const headers = new Headers()
  headers.append('Set-Cookie', clearCookie)
  headers.append('Set-Cookie', authCookie)
  headers.set('Location', adminRoute)

  return new Response(null, {
    headers,
    status: 302,
  })
}

const resolveUserFromCollections = async ({
  collections,
  payload,
  profile,
  profileEmail,
  profileId,
  providerId,
}: {
  collections: CollectionSocialLoginConfig[]
  payload: PayloadRequest['payload']
  profile: Record<string, unknown>
  profileEmail: string
  profileId: null | string
  providerId: BaseProvider['id']
}): Promise<{ collection: CollectionSocialLoginConfig['collection']; user: SocialLoginUser } | null> => {
  for (const entry of collections) {
    const findUser =
      entry.findUserCallback ??
      (async ({ payload, profileEmail: email }) => {
        if (!email) {
          return null
        }
        return defaultFindUserByEmail({
          collection: entry.collection,
          payload,
          profileEmail: email,
        })
      })

    const user = await findUser({
      payload,
      profile,
      profileEmail,
      profileId,
      provider: providerId,
    })

    if (user) {
      return { collection: entry.collection, user }
    }
  }

  return null
}

export const createCallbackEndpoint = ({
  callbackURL,
  collections,
  path,
  provider,
}: {
  callbackURL: string
  collections: CollectionSocialLoginConfig[]
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
      return redirectToLoginWithError(req, clearCookie, 'login')
    }

    const idpError = url.searchParams.get('error')
    const code = url.searchParams.get('code')
    if (idpError || !code) {
      return redirectToLoginWithError(req, clearCookie, 'login')
    }

    try {
      const redirectUri = resolveAbsoluteCallbackUrl({
        callbackURL,
        req,
      })
      const { accessToken } = await provider.exchangeCode({ code, redirectUri })
      const profile = await provider.fetchProfile({ accessToken })
      const { profileEmail, profileId } = normalizeProviderProfile({
        profile,
        provider: provider.id,
      })

      if (!profileEmail) {
        return redirectToLoginWithError(req, clearCookie, 'login')
      }

      const matched = await resolveUserFromCollections({
        collections,
        payload: req.payload,
        profile,
        profileEmail,
        profileId,
        providerId: provider.id,
      })

      if (!matched) {
        return redirectToLoginWithError(req, clearCookie, 'not-found')
      }

      const userWithEmail =
        typeof matched.user.email === 'string' && matched.user.email.trim().length > 0
          ? matched.user
          : { ...matched.user, email: profileEmail }

      const { authCookie } = await loginUserWithoutPassword({
        collection: matched.collection,
        req,
        user: userWithEmail,
      })

      return redirectToAdminWithSession({
        authCookie,
        clearCookie,
        req,
      })
    } catch {
      return redirectToLoginWithError(req, clearCookie, 'login')
    }
  },
  method: 'get',
  path,
})
