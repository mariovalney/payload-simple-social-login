import type { Config, Payload } from 'payload'

import config from '@payload-config'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { payloadSimpleSocialLogin } from '../src/index.js'
import { MicrosoftProvider } from '../src/providers/microsoft.js'

const dummyGoogle = {
  clientId: 'test-google-client-id',
  clientSecret: 'test-google-client-secret',
}

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('Plugin integration tests', () => {
  test('plugin loads with the Payload config', () => {
    expect(payload).toBeDefined()
    expect(payload.collections['users']).toBeDefined()
    expect(payload.collections).not.toHaveProperty('plugin-collection')
  })

  test('enabled google provider registers login and callback endpoints with default paths', () => {
    const baseConfig = {
      collections: [],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      providers: {
        google: dummyGoogle,
      },
    })(baseConfig)

    expect(next.endpoints?.some((endpoint) => endpoint.path === '/auth/google/login')).toBe(true)
    expect(next.endpoints?.some((endpoint) => endpoint.path === '/auth/google/callback')).toBe(
      true,
    )
    expect(next.admin?.components?.views?.['social-login-google']).toBeUndefined()
  })

  test('appends SocialLoginButtons to afterLogin and preserves existing entries', () => {
    const existingAfterLogin = '/components/ExistingAfterLogin'
    const baseConfig = {
      admin: {
        components: {
          afterLogin: [existingAfterLogin],
        },
      },
      collections: [],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      providers: {
        google: {
          ...dummyGoogle,
          label: 'Continue with Google',
        },
      },
    })(baseConfig)

    const afterLogin = next.admin?.components?.afterLogin
    expect(afterLogin).toHaveLength(2)
    expect(afterLogin?.[0]).toBe(existingAfterLogin)

    const social = afterLogin?.[1]
    expect(social).toMatchObject({
      clientProps: {
        providers: [
          {
            id: 'google',
            href: '/api/auth/google/login',
            label: 'Continue with Google',
          },
        ],
      },
      path: 'payload-simple-social-login/client#SocialLoginButtons',
    })
  })

  test('showButtonOnLogin false does not register afterLogin component', () => {
    const baseConfig = {
      collections: [],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      providers: {
        google: dummyGoogle,
      },
      showButtonOnLogin: false,
    })(baseConfig)

    expect(next.endpoints?.some((endpoint) => endpoint.path === '/auth/google/login')).toBe(true)
    expect(next.admin?.components?.afterLogin).toBeUndefined()
  })

  test('disabled plugin does not register provider endpoints or afterLogin', () => {
    const baseConfig = {
      admin: {
        components: {
          afterLogin: ['/components/ExistingAfterLogin'],
        },
      },
      collections: [],
      endpoints: [{ handler: () => Response.json({}), method: 'get', path: '/existing' }],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      disabled: true,
      providers: {
        google: dummyGoogle,
      },
    })(baseConfig)

    expect(next.endpoints).toEqual(baseConfig.endpoints)
    expect(next.admin?.components?.afterLogin).toEqual(['/components/ExistingAfterLogin'])
  })

  test('callback rejects missing or invalid oauth state', async () => {
    const endpoint = payload.config.endpoints?.find(
      (item) => item.path === '/auth/google/callback' && item.method === 'get',
    )
    expect(endpoint).toBeDefined()

    const missingRequest = new Request('http://localhost:3000/api/auth/google/callback', {
      method: 'GET',
    })
    const missingPayloadRequest = await createPayloadRequest({ config, request: missingRequest })
    const missingResponse = await endpoint!.handler(missingPayloadRequest)
    expect(missingResponse.status).toBe(400)
    await expect(missingResponse.json()).resolves.toMatchObject({
      error: 'invalid_state',
      ok: false,
      provider: 'google',
    })

    const mismatchRequest = new Request(
      'http://localhost:3000/api/auth/google/callback?state=query-state',
      {
        headers: {
          Cookie: 'payload-ssl-state-google=cookie-state',
        },
        method: 'GET',
      },
    )
    const mismatchPayloadRequest = await createPayloadRequest({
      config,
      request: mismatchRequest,
    })
    const mismatchResponse = await endpoint!.handler(mismatchPayloadRequest)
    expect(mismatchResponse.status).toBe(400)
  })

  test('callback accepts matching oauth state and clears cookie', async () => {
    const state = 'valid-oauth-state-value'
    const request = new Request(
      `http://localhost:3000/api/auth/google/callback?state=${state}`,
      {
        headers: {
          Cookie: `payload-ssl-state-google=${state}`,
        },
        method: 'GET',
      },
    )

    const payloadRequest = await createPayloadRequest({ config, request })
    const endpoint = payload.config.endpoints?.find(
      (item) => item.path === '/auth/google/callback' && item.method === 'get',
    )

    expect(endpoint).toBeDefined()
    const response = await endpoint!.handler(payloadRequest)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toMatchObject({
      type: 'callback',
      ok: true,
      provider: 'google',
    })

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('payload-ssl-state-google=')
    expect(setCookie).toMatch(/Max-Age=0|Expires=/i)
  })

  test('login endpoint redirects with regenerated state cookie', async () => {
    const request = new Request('http://localhost:3000/api/auth/google/login', {
      method: 'GET',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    const endpoint = payload.config.endpoints?.find(
      (item) => item.path === '/auth/google/login' && item.method === 'get',
    )

    expect(endpoint).toBeDefined()
    const response = await endpoint!.handler(payloadRequest)
    expect(response.status).toBe(302)

    const location = response.headers.get('location')
    expect(location).toBeTruthy()

    const authorizeUrl = new URL(location!)
    expect(authorizeUrl.origin).toBe('https://accounts.google.com')
    expect(authorizeUrl.pathname).toBe('/o/oauth2/v2/auth')
    expect(authorizeUrl.searchParams.get('response_type')).toBe('code')
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/google/callback',
    )

    const state = authorizeUrl.searchParams.get('state')
    expect(state).toBeTruthy()
    expect(state!.length).toBeGreaterThan(16)

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain(`payload-ssl-state-google=${state}`)
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Lax/i)
  })

  test('merges plugin i18n translations into config', () => {
    const baseConfig = {
      collections: [],
      i18n: {
        translations: {
          en: {
            'plugin-simple-social-login': {
              orLoginWith: 'or continue with',
            },
          },
        },
      },
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      providers: {
        google: dummyGoogle,
      },
    })(baseConfig)

    expect(next.i18n?.translations).toMatchObject({
      en: {
        'plugin-simple-social-login': {
          orLoginWith: 'or continue with',
          providers: {
            google: 'Google',
            microsoft: 'Microsoft',
          },
        },
      },
      pt: {
        'plugin-simple-social-login': {
          orLoginWith: 'ou entre com',
        },
      },
    })
  })

  test('microsoft provider defaults tenant to common and accepts a custom tenant', () => {
    const defaultProvider = new MicrosoftProvider({
      clientId: 'ms-client',
      clientSecret: 'ms-secret',
    })
    const defaultUrl = new URL(
      defaultProvider.redirectToLogin({
        redirectUri: 'http://localhost:3000/api/auth/microsoft/callback',
        state: 'test-state',
      }),
    )
    expect(defaultUrl.pathname).toBe('/common/oauth2/v2.0/authorize')
    expect(defaultUrl.searchParams.get('state')).toBe('test-state')

    const tenantProvider = new MicrosoftProvider({
      clientId: 'ms-client',
      clientSecret: 'ms-secret',
      tenant: 'contoso.onmicrosoft.com',
    })
    const tenantUrl = new URL(
      tenantProvider.redirectToLogin({
        redirectUri: 'http://localhost:3000/api/auth/microsoft/callback',
        state: 'test-state',
      }),
    )
    expect(tenantUrl.pathname).toBe('/contoso.onmicrosoft.com/oauth2/v2.0/authorize')
  })
})
