import type { PayloadRequest } from 'payload'

export const resolveAbsoluteCallbackUrl = ({
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
