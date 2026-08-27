import type { Config } from 'payload'

import { deepMergeSimple } from 'payload/shared'

import type { CollectionSocialLoginConfig, PayloadSimpleSocialLoginConfig } from './types.js'

import { createSocialAuthEndpoints } from './endpoints/createSocialAuthEndpoints.js'
import { createEnabledProviders } from './providers/createProvider.js'
import { translations } from './translations/index.js'
import { resolveProviderUrls } from './utils/resolveProviderUrls.js'

export { createSocialAuthEndpoints } from './endpoints/createSocialAuthEndpoints.js'

const resolveCollections = ({
  config,
  pluginOptions,
}: {
  config: Config
  pluginOptions: PayloadSimpleSocialLoginConfig
}): CollectionSocialLoginConfig[] => {
  if (pluginOptions.collections?.length) {
    return pluginOptions.collections
  }

  const adminUser = config.admin?.user
  if (!adminUser) {
    return []
  }

  return [{ collection: adminUser }]
}

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
    const collections = resolveCollections({ config, pluginOptions })
    const providerEndpoints = [...(config.endpoints ?? [])]
    const buttonProviders: Array<{
      href: string
      id: (typeof enabledProviders)[number]['id']
      label?: string
    }> = []

    const apiRoute = (config.routes?.api ?? '/api').replace(/\/$/, '') || '/api'

    for (const provider of enabledProviders) {
      const { loginUrl } = resolveProviderUrls({
        provider: provider.config,
        providerId: provider.id,
      })

      providerEndpoints.push(
        ...createSocialAuthEndpoints({
          ...provider.config,
          collections,
          provider: provider.id,
        }),
      )

      buttonProviders.push({
        id: provider.id,
        href: `${apiRoute}${loginUrl}`,
        ...(provider.config.label ? { label: provider.config.label } : {}),
      })
    }

    config.endpoints = providerEndpoints

    if (enabledProviders.length > 0) {
      const afterLogin = [...(config.admin?.components?.afterLogin ?? [])]

      afterLogin.push({
        path: 'payload-simple-social-login/client#SocialLoginErrorToast',
      })

      if (pluginOptions.showButtonOnLogin !== false && buttonProviders.length > 0) {
        afterLogin.push({
          clientProps: {
            providers: buttonProviders,
          },
          path: 'payload-simple-social-login/client#SocialLoginButtons',
        })
      }

      config.admin = {
        ...(config.admin ?? {}),
        components: {
          ...(config.admin?.components ?? {}),
          afterLogin,
        },
      }
    }

    return config
  }
