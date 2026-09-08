import type { Endpoint } from 'payload'

import type {
  CreateSocialAuthEndpointsArgs,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  SocialProviderId,
} from '../types.js'

import { createProvider } from '../providers/createProvider.js'
import { getOAuthStateCookieName } from '../utils/oauthState.js'
import { resolveProviderUrls } from '../utils/resolveProviderUrls.js'
import { createCallbackEndpoint } from './createCallbackEndpoint.js'
import { createLoginEndpoint } from './createLoginEndpoint.js'

const toProviderConfig = (
  args: CreateSocialAuthEndpointsArgs,
): GoogleProviderConfig | MicrosoftProviderConfig => {
  const {
    collections: _collections,
    onError: _onError,
    onSuccess: _onSuccess,
    provider: _provider,
    serverURL: _serverURL,
    ...config
  } = args

  return config
}

export const createSocialAuthEndpoints = <T extends SocialProviderId>(
  args: CreateSocialAuthEndpointsArgs<T>,
): Endpoint[] => {
  const { collections, onError, onSuccess, provider: providerId, serverURL } = args
  const providerConfig = toProviderConfig(args)
  const provider = createProvider(providerId, providerConfig as never)

  const { callbackURL, loginUrl } = resolveProviderUrls({
    provider: provider.config,
    providerId,
  })

  const stateCookieName = getOAuthStateCookieName({
    callbackURL,
    providerId,
  })

  return [
    createLoginEndpoint({
      callbackURL,
      path: loginUrl,
      provider,
      serverURL,
      stateCookieName,
    }),
    createCallbackEndpoint({
      callbackURL,
      collections,
      onError,
      onSuccess,
      path: callbackURL,
      provider,
      serverURL,
      stateCookieName,
    }),
  ]
}
