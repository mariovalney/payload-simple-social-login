import type { Endpoint, PayloadRequest } from 'payload'

import type { BaseProvider } from '../providers/base.js'
import type {
  CollectionSocialLoginConfig,
  SocialAuthErrorCode,
  SocialAuthOnError,
  SocialAuthOnSuccess,
  SocialLoginServerURL,
  SocialLoginUser,
} from '../types.js'

import { UnverifiedSocialUserError } from '../errors/UnverifiedSocialUserError.js'
import { defaultFindUserByEmail } from '../utils/defaultFindUserByEmail.js'
import { loginUserWithoutPassword } from '../utils/loginUserWithoutPassword.js'
import { normalizeProviderProfile } from '../utils/normalizeProviderProfile.js'
import {
  appendClearStateCookie,
  clearOAuthStateCookie,
  isOAuthStateValid,
  isSecureRequest,
  readOAuthStateCookie,
} from '../utils/oauthState.js'
import { resolveAbsoluteCallbackUrl } from '../utils/resolveAbsoluteCallbackUrl.js'

export type SslErrorCode = SocialAuthErrorCode

const SSL_ERROR_QUERY = 'ssl-error'

const redirectToLoginWithError = (
  req: PayloadRequest,
  error: SslErrorCode = 'login',
): Response => {
  const adminRoute = (req.payload.config.routes?.admin ?? '/admin').replace(/\/$/, '') || '/admin'
  const location = `${adminRoute}/login?${SSL_ERROR_QUERY}=${error}`

  return new Response(null, {
    headers: {
      Location: location,
    },
    status: 302,
  })
}

const defaultCustomErrorResponse = (code: SslErrorCode): Response => {
  const status = code === 'not_found' ? 404 : 400
  return Response.json({ error: code }, { status })
}

const redirectToAdminWithSession = ({
  authCookie,
  req,
}: {
  authCookie: string
  req: PayloadRequest
}): Response => {
  const adminRoute = (req.payload.config.routes?.admin ?? '/admin').replace(/\/$/, '') || '/admin'
  const headers = new Headers()
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
  req,
}: {
  collections: CollectionSocialLoginConfig[]
  payload: PayloadRequest['payload']
  profile: Record<string, unknown>
  profileEmail: string
  profileId: null | string
  providerId: BaseProvider['id']
  req: PayloadRequest
}): Promise<{ collection: CollectionSocialLoginConfig['collection']; user: SocialLoginUser } | null> => {
  for (const entry of collections) {
    const findUser =
      entry.findUserCallback ??
      (async ({ payload, profileEmail: email }) => {
        if (!email) {
          return null
        }
        return defaultFindUserByEmail({
          autoVerify: entry.autoVerify === true,
          collection: entry.collection,
          payload,
          profileEmail: email,
          req,
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

const completeAdminLogin = async ({
  collections,
  profile,
  profileEmail,
  profileId,
  provider,
  req,
}: {
  collections: CollectionSocialLoginConfig[]
  profile: Record<string, unknown>
  profileEmail: string
  profileId: null | string
  provider: BaseProvider
  req: PayloadRequest
}): Promise<Response> => {
  const matched = await resolveUserFromCollections({
    collections,
    payload: req.payload,
    profile,
    profileEmail,
    profileId,
    providerId: provider.id,
    req,
  })

  if (!matched) {
    return redirectToLoginWithError(req, 'not_found')
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
    req,
  })
}

const handleCallbackError = async ({
  clearCookie,
  code,
  error,
  onError,
  onSuccess,
  req,
}: {
  clearCookie: string
  code: SslErrorCode
  error?: unknown
  onError?: SocialAuthOnError
  onSuccess?: SocialAuthOnSuccess
  req: PayloadRequest
}): Promise<Response> => {
  try {
    if (onSuccess) {
      const response = onError
        ? await onError({ code, error, req })
        : defaultCustomErrorResponse(code)
      return appendClearStateCookie(response, clearCookie)
    }

    return appendClearStateCookie(redirectToLoginWithError(req, code), clearCookie)
  } catch {
    if (onSuccess) {
      return appendClearStateCookie(defaultCustomErrorResponse(code), clearCookie)
    }

    return appendClearStateCookie(redirectToLoginWithError(req, code), clearCookie)
  }
}

export const createCallbackEndpoint = ({
  callbackURL,
  collections,
  onError,
  onSuccess,
  path,
  provider,
  serverURL,
  stateCookieName,
}: {
  callbackURL: string
  collections?: CollectionSocialLoginConfig[]
  onError?: SocialAuthOnError
  onSuccess?: SocialAuthOnSuccess
  path: string
  provider: BaseProvider
  serverURL?: SocialLoginServerURL
  stateCookieName: string
}): Endpoint => ({
  handler: async (req) => {
    const requestUrl = req.url ?? 'http://localhost'

    /**
     * Resolved here (not only where the token exchange needs it) so the `Secure` flag of the
     * state cookie follows the same origin the login endpoint used.
     */
    let redirectUri: null | string = null
    let redirectUriError: Error | null = null
    try {
      redirectUri = resolveAbsoluteCallbackUrl({ callbackURL, req, serverURL })
    } catch (error) {
      redirectUriError =
        error instanceof Error ? error : new Error('Unable to resolve the OAuth callback URL')
    }

    const secure = isSecureRequest({ req, resolvedURL: redirectUri ?? requestUrl })
    const clearCookie = clearOAuthStateCookie({ secure, stateCookieName })

    const url = new URL(requestUrl)
    const queryState = url.searchParams.get('state') ?? undefined
    const cookieState = readOAuthStateCookie({
      headers: req.headers,
      stateCookieName,
    })

    if (!isOAuthStateValid({ cookieState, queryState })) {
      return handleCallbackError({
        clearCookie,
        code: 'login',
        onError,
        onSuccess,
        req,
      })
    }

    const idpError = url.searchParams.get('error')
    const code = url.searchParams.get('code')
    if (idpError || !code) {
      return handleCallbackError({
        clearCookie,
        code: 'login',
        onError,
        onSuccess,
        req,
      })
    }

    try {
      if (!redirectUri) {
        throw redirectUriError ?? new Error('Unable to resolve the OAuth callback URL')
      }

      const { accessToken } = await provider.exchangeCode({ code, redirectUri })
      const profile = await provider.fetchProfile({ accessToken })
      const { profileEmail, profileId } = normalizeProviderProfile({
        profile,
        provider: provider.id,
      })

      if (onSuccess) {
        try {
          const response = await onSuccess({
            accessToken,
            profile,
            profileEmail,
            profileId,
            provider: provider.id,
            req,
          })
          return appendClearStateCookie(response, clearCookie)
        } catch (error) {
          return handleCallbackError({
            clearCookie,
            code: 'login',
            error,
            onError,
            onSuccess,
            req,
          })
        }
      }

      if (!collections?.length) {
        return handleCallbackError({
          clearCookie,
          code: 'login',
          onError,
          onSuccess,
          req,
        })
      }

      if (!profileEmail) {
        return handleCallbackError({
          clearCookie,
          code: 'login',
          onError,
          onSuccess,
          req,
        })
      }

      try {
        const response = await completeAdminLogin({
          collections,
          profile,
          profileEmail,
          profileId,
          provider,
          req,
        })

        return appendClearStateCookie(response, clearCookie)
      } catch (error) {
        if (error instanceof UnverifiedSocialUserError) {
          return handleCallbackError({
            clearCookie,
            code: 'unverified',
            error,
            onError,
            onSuccess,
            req,
          })
        }

        return handleCallbackError({
          clearCookie,
          code: 'login',
          error,
          onError,
          onSuccess,
          req,
        })
      }
    } catch (error) {
      if (error instanceof UnverifiedSocialUserError) {
        return handleCallbackError({
          clearCookie,
          code: 'unverified',
          error,
          onError,
          onSuccess,
          req,
        })
      }

      return handleCallbackError({
        clearCookie,
        code: 'login',
        error,
        onError,
        onSuccess,
        req,
      })
    }
  },
  method: 'get',
  path,
})
