import type {
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  PayloadSimpleSocialLoginConfig,
  SocialProviderId,
} from '../types.js'
import type { BaseProvider } from './base.js'

import { GoogleProvider } from './google.js'
import { MicrosoftProvider } from './microsoft.js'

type ProviderConfigById = {
  google: GoogleProviderConfig
  microsoft: MicrosoftProviderConfig
}

export const createProvider = <T extends SocialProviderId>(
  id: T,
  config: ProviderConfigById[T],
): BaseProvider => {
  switch (id) {
    case 'google':
      return new GoogleProvider(config as GoogleProviderConfig)
    case 'microsoft':
      return new MicrosoftProvider(config as MicrosoftProviderConfig)
    default: {
      const _exhaustive: never = id
      throw new Error(`Unsupported social provider: ${String(_exhaustive)}`)
    }
  }
}

export const createEnabledProviders = (
  providers: PayloadSimpleSocialLoginConfig['providers'],
): BaseProvider[] => {
  const enabled: BaseProvider[] = []

  if (providers.google) {
    enabled.push(createProvider('google', providers.google))
  }
  if (providers.microsoft) {
    enabled.push(createProvider('microsoft', providers.microsoft))
  }

  return enabled
}
