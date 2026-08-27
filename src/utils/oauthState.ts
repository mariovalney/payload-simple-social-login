import { randomBytes, timingSafeEqual } from 'crypto'
import { generateCookie, parseCookies } from 'payload/shared'

import type { SocialProviderId } from '../types.js'

export const OAUTH_STATE_MAX_AGE_SECONDS = 600

export const normalizeCallbackPathForCookie = (callbackURL: string): string => {
  const trimmed = callbackURL.trim().replace(/^\/+/, '')

  return trimmed
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '')
    .toLowerCase()
}

export const getOAuthStateCookieName = ({
  callbackURL,
  providerId,
}: {
  callbackURL: string
  providerId: SocialProviderId
}): string => {
  const normalized = normalizeCallbackPathForCookie(callbackURL)
  return `payload-auth-state-${providerId}_${normalized}`
}

export const createOAuthState = (): string => randomBytes(32).toString('base64url')

export const buildOAuthStateCookie = ({
  secure,
  state,
  stateCookieName,
}: {
  secure: boolean
  state: string
  stateCookieName: string
}): string =>
  generateCookie({
    name: stateCookieName,
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: '/',
    returnCookieAsObject: false,
    sameSite: 'Lax',
    secure,
    value: state,
  }) as string

export const clearOAuthStateCookie = ({
  secure,
  stateCookieName,
}: {
  secure: boolean
  stateCookieName: string
}): string =>
  generateCookie({
    name: stateCookieName,
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
  stateCookieName,
}: {
  headers: Headers
  stateCookieName: string
}): string | undefined => {
  const cookies = parseCookies(headers)
  return cookies.get(stateCookieName)
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

export const appendClearStateCookie = (response: Response, clearCookie: string): Response => {
  const headers = new Headers(response.headers)
  headers.append('Set-Cookie', clearCookie)

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
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
