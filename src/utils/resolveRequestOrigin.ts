import type { PayloadRequest, SanitizedConfig } from 'payload'

type TrustedOriginsConfig = Pick<SanitizedConfig, 'cors' | 'csrf'>

/**
 * Explicit CORS / CSRF allowlist, or `null` when the config trusts every origin (`cors: '*'`).
 *
 * Mirrors `getTrustedOrigins` from Payload core (`payload/dist/utilities/getRequestOrigin.js`),
 * which is not exported by any public entry of the `payload` package. A wildcard is never an
 * allowlist: it returns `null` so the `Host` header is not trusted.
 */
const getTrustedOrigins = (config: Partial<TrustedOriginsConfig>): null | string[] => {
  const origins = new Set<string>()
  const { cors, csrf } = config

  if (cors === '*') {
    return null
  }

  if (Array.isArray(cors)) {
    cors.forEach((origin) => origins.add(origin))
  } else if (cors && typeof cors === 'object') {
    const corsOrigins = cors.origins

    if (corsOrigins === '*') {
      return null
    }

    if (Array.isArray(corsOrigins)) {
      corsOrigins.forEach((origin) => origins.add(origin))
    }
  }

  if (Array.isArray(csrf)) {
    csrf.forEach((origin) => origins.add(origin))
  }

  return [...origins]
}

/**
 * Protocol from `x-forwarded-proto`, normalized as a URL protocol (`https:`).
 *
 * Proxies append to the header, so the client protocol is the leftmost value.
 */
export const getForwardedProtocol = (
  req: Pick<PayloadRequest, 'headers'>,
): string | undefined => {
  const header = req.headers?.get('x-forwarded-proto')
  const protocol = header?.split(',')[0]?.trim().toLowerCase()

  return protocol ? `${protocol}:` : undefined
}

const getRequestUrlProtocol = (req: Pick<PayloadRequest, 'url'>): string | undefined => {
  if (!req.url) {
    return undefined
  }

  try {
    return new URL(req.url).protocol
  } catch {
    return undefined
  }
}

/**
 * Trusted public origin of the request (`https://app.example.com`), or an empty string.
 *
 * Built from the `Host` header (never from `req.url`, whose host is the internal one behind a
 * proxy) and accepted only when it is listed in the CORS / CSRF allowlist, same rule Payload
 * core applies in `getRequestOrigin`. Otherwise it warns and returns an empty string.
 */
export const resolveRequestOrigin = ({ req }: { req: PayloadRequest }): string => {
  const host = req.headers?.get('host')
  const protocol = getForwardedProtocol(req) ?? getRequestUrlProtocol(req) ?? 'http:'
  const origin = host ? `${protocol}//${host}` : ''

  const trustedOrigins = getTrustedOrigins(req.payload?.config ?? {})
  if (trustedOrigins !== null && origin && trustedOrigins.includes(origin)) {
    return origin
  }

  req.payload?.logger?.warn(
    `Request origin "${origin}" is not in the CORS/CSRF allowlist. It is recommended to explicitly set "serverURL" (Payload config or plugin option) so the OAuth redirect_uri matches the public URL of the app.`,
  )

  return ''
}
