import type { PayloadRequest } from 'payload'

import type { SocialLoginServerURL } from '../types.js'

import { resolveRequestOrigin } from './resolveRequestOrigin.js'

const normalizeOrigin = (value: null | string | undefined): string =>
  typeof value === 'string' ? value.trim().replace(/\/$/, '') : ''

/**
 * Origin from the `serverURL` option, resolved per request when it is a function.
 */
export const resolveServerURLOption = ({
  req,
  serverURL,
}: {
  req: PayloadRequest
  serverURL?: SocialLoginServerURL
}): string =>
  normalizeOrigin(typeof serverURL === 'function' ? serverURL(req) : serverURL)

/**
 * Absolute OAuth `redirect_uri` for a callback path.
 *
 * Resolution order:
 * 1. `serverURL` option (endpoint args, provider config, or plugin options)
 * 2. `serverURL` from the Payload config
 * 3. Request origin, from the `Host` header and only when it is in the CORS / CSRF allowlist
 * 4. `req.url`, which behind a proxy is the internal URL (warned about on step 3)
 *
 * Login and callback endpoints must resolve the same value, otherwise the token exchange
 * fails with `redirect_uri_mismatch`.
 */
export const resolveAbsoluteCallbackUrl = ({
  callbackURL,
  req,
  serverURL,
}: {
  callbackURL: string
  req: PayloadRequest
  serverURL?: SocialLoginServerURL
}): string => {
  const apiRoute = (req.payload.config.routes?.api ?? '/api').replace(/\/$/, '') || '/api'
  const path = `${apiRoute}${callbackURL.startsWith('/') ? callbackURL : `/${callbackURL}`}`

  const optionURL = resolveServerURLOption({ req, serverURL })
  if (optionURL) {
    return `${optionURL}${path}`
  }

  const configURL = normalizeOrigin(req.payload.config.serverURL)
  if (configURL) {
    return `${configURL}${path}`
  }

  const requestOrigin = resolveRequestOrigin({ req })
  if (requestOrigin) {
    return `${requestOrigin}${path}`
  }

  try {
    return new URL(path, req.url ?? 'http://localhost').toString()
  } catch {
    throw new Error(
      `Unable to resolve an absolute callback URL for "${path}". Set "serverURL" in the Payload config or in the plugin options.`,
    )
  }
}
