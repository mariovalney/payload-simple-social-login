import type { Config } from 'payload'

import type { PayloadSimpleSocialLoginConfig } from './types.js'

export type {
  CollectionSocialLoginConfig,
  FindUserCallback,
  FindUserCallbackArgs,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  PayloadSimpleSocialLoginConfig,
  SocialProviderId
} from './types.js'

export const payloadSimpleSocialLogin =
  (pluginOptions: PayloadSimpleSocialLoginConfig) =>
  (config: Config): Config => {
    /**
     * Keep schema-affecting changes outside this early return if added later.
     * For now the plugin only registers runtime pieces (endpoints / UI).
     */
    if (pluginOptions.disabled) {
      return config
    }

    // Generic endpoints scaffold — OAuth handlers will be registered here later.
    config.endpoints = [...(config.endpoints ?? [])]

    return config
  }
