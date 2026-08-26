import type { ProviderConfig, SocialProviderId } from '../types.js'

export type ResolvedProviderUrls = {
  callbackURL: `/${string}`
  /** Login start path (button href + endpoint path), e.g. `/auth/google/login` */
  loginUrl: `/${string}`
}

const ensureLeadingSlash = (value: string): `/${string}` => {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') {
    return '/'
  }
  return (trimmed.startsWith('/') ? trimmed : `/${trimmed}`) as `/${string}`
}

export const resolveProviderUrls = ({
  provider,
  providerId,
}: {
  provider: ProviderConfig
  providerId: SocialProviderId
}): ResolvedProviderUrls => {
  const callbackURL = ensureLeadingSlash(
    provider.callbackURL ?? `/auth/${providerId}/callback`,
  )
  const loginUrl = ensureLeadingSlash(provider.loginUrl ?? `/auth/${providerId}/login`)

  return {
    callbackURL,
    loginUrl,
  }
}
