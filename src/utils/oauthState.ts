import { randomBytes, timingSafeEqual } from 'crypto'
import { generateCookie, parseCookies } from 'payload/shared'

import type { SocialProviderId } from '../types.js'

export const OAUTH_STATE_MAX_AGE_SECONDS = 600

export const getOAuthStateCookieName = (providerId: SocialProviderId): string =>
  `payload-ssl-state-${providerId}`

export const createOAuthState = (): string => randomBytes(32).toString('base64url')

export const buildOAuthStateCookie = ({
  providerId,
  secure,
  state,
}: {
  providerId: SocialProviderId
  secure: boolean
  state: string
}): string =>
  generateCookie({
    name: getOAuthStateCookieName(providerId),
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: '/',
    returnCookieAsObject: false,
    sameSite: 'Lax',
    secure,
    value: state,
  }) as string

export const clearOAuthStateCookie = ({
  providerId,
  secure,
}: {
  providerId: SocialProviderId
  secure: boolean
}): string =>
  generateCookie({
    name: getOAuthStateCookieName(providerId),
    expires: new Date(0),
    httpOnly: true,
    path: '/',
    returnCookieAsObject: false,
    sameSite: 'Lax',
    secure,
    value: '',
  }) as string

export const readOAuthStateCookie = ({
  headers,
  providerId,
}: {
  headers: Headers
  providerId: SocialProviderId
}): string | undefined => {
  const cookies = parseCookies(headers)
  return cookies.get(getOAuthStateCookieName(providerId))
}

export const isOAuthStateValid = ({
  cookieState,
  queryState,
}: {
  cookieState: string | undefined
  queryState: string | undefined
}): boolean => {
  if (!cookieState || !queryState) {
    return false
  }

  const cookieBuffer = Buffer.from(cookieState)
  const queryBuffer = Buffer.from(queryState)

  if (cookieBuffer.length !== queryBuffer.length) {
    return false
  }

  return timingSafeEqual(cookieBuffer, queryBuffer)
}

export const isSecureRequest = (url: string | undefined): boolean => {
  if (!url) {
    return false
  }

  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
