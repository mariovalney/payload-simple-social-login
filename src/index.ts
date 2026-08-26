import type { Config, Endpoint } from 'payload'

import { deepMergeSimple } from 'payload/shared'

import type { PayloadSimpleSocialLoginConfig, SocialProviderId } from './types.js'

import { createCallbackEndpoint } from './endpoints/createCallbackEndpoint.js'
import { createLoginEndpoint } from './endpoints/createLoginEndpoint.js'
import { createEnabledProviders } from './providers/createProvider.js'
import { translations } from './translations/index.js'
import { resolveProviderUrls } from './utils/resolveProviderUrls.js'

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
  (incomingConfig: Config): Config => {
    /**
     * Keep schema-affecting changes outside this early return if added later.
     * For now the plugin only registers runtime pieces (endpoints / UI / i18n).
     */
    if (pluginOptions.disabled) {
      return incomingConfig
    }

    const config: Config = {
      ...incomingConfig,
    }

    config.i18n = {
      ...(config.i18n ?? {}),
      translations: deepMergeSimple(translations, config.i18n?.translations ?? {}),
    }

    const enabledProviders = createEnabledProviders(pluginOptions.providers)
    const providerEndpoints: Endpoint[] = []
    const buttonProviders: Array<{
      href: string
      id: SocialProviderId
      label?: string
    }> = []

    const apiRoute = (config.routes?.api ?? '/api').replace(/\/$/, '') || '/api'

    for (const provider of enabledProviders) {
      const { callbackURL, loginUrl } = resolveProviderUrls({
        provider: provider.config,
        providerId: provider.id,
      })

      providerEndpoints.push(
        createLoginEndpoint({
          callbackURL,
          path: loginUrl,
          provider,
        }),
        createCallbackEndpoint({
          path: callbackURL,
          providerId: provider.id,
        }),
      )

      buttonProviders.push({
        id: provider.id,
        href: `${apiRoute}${loginUrl}`,
        ...(provider.config.label ? { label: provider.config.label } : {}),
      })
    }

    config.endpoints = [...(config.endpoints ?? []), ...providerEndpoints]

    if (pluginOptions.showButtonOnLogin !== false && buttonProviders.length > 0) {
      config.admin = {
        ...(config.admin ?? {}),
        components: {
          ...(config.admin?.components ?? {}),
          afterLogin: [
            ...(config.admin?.components?.afterLogin ?? []),
            {
              clientProps: {
                providers: buttonProviders,
              },
              path: 'payload-simple-social-login/client#SocialLoginButtons',
            },
          ],
        },
      }
    }

    return config
  }
