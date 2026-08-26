import type { Config, Payload } from 'payload'

import config from '@payload-config'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { payloadSimpleSocialLogin } from '../src/index.js'
import { GoogleProvider } from '../src/providers/google.js'
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

  test('appends SocialLoginErrorToast and SocialLoginButtons to afterLogin and preserves existing entries', () => {
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
    expect(afterLogin).toHaveLength(3)
    expect(afterLogin?.[0]).toBe(existingAfterLogin)
    expect(afterLogin?.[1]).toMatchObject({
      path: 'payload-simple-social-login/client#SocialLoginErrorToast',
    })

    const social = afterLogin?.[2]
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

  test('showButtonOnLogin false still registers SocialLoginErrorToast', () => {
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
    expect(next.admin?.components?.afterLogin).toEqual([
      {
        path: 'payload-simple-social-login/client#SocialLoginErrorToast',
      },
    ])
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

  test('callback redirects to admin login when oauth state is missing or invalid', async () => {
    const endpoint = payload.config.endpoints?.find(
      (item) => item.path === '/auth/google/callback' && item.method === 'get',
    )
    expect(endpoint).toBeDefined()

    const missingRequest = new Request('http://localhost:3000/api/auth/google/callback', {
      method: 'GET',
    })
    const missingPayloadRequest = await createPayloadRequest({ config, request: missingRequest })
    const missingResponse = await endpoint!.handler(missingPayloadRequest)
    expect(missingResponse.status).toBe(302)
    expect(missingResponse.headers.get('location')).toBe('/admin/login?ssl-error=login')

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
    expect(mismatchResponse.status).toBe(302)
    expect(mismatchResponse.headers.get('location')).toBe('/admin/login?ssl-error=login')
  })

  test('callback redirects to admin login when authorization code is missing', async () => {
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
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/admin/login?ssl-error=login')

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('payload-ssl-state-google=')
    expect(setCookie).toMatch(/Max-Age=0|Expires=/i)
  })

  test('callback redirects to admin login when IdP returns error query', async () => {
    const state = 'valid-oauth-state-value'
    const request = new Request(
      `http://localhost:3000/api/auth/google/callback?state=${state}&error=access_denied`,
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
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/admin/login?ssl-error=login')
  })

  test('callback logs in matching user and redirects to admin', async () => {
    const state = 'valid-oauth-state-value'
    const profile = { email: 'dev@payloadcms.com', sub: 'google-user-1' }

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve(
          Response.json({ access_token: 'google-access-token', token_type: 'Bearer' }),
        )
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer google-access-token',
        })
        return Promise.resolve(Response.json(profile))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }) as typeof fetch

    try {
      const request = new Request(
        `http://localhost:3000/api/auth/google/callback?state=${state}&code=auth-code`,
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
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin')

      const cookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean)

      expect(cookies.some((cookie) => cookie?.includes('payload-ssl-state-google='))).toBe(true)
      expect(cookies.some((cookie) => cookie?.match(/Max-Age=0|Expires=/i))).toBe(true)
      expect(cookies.some((cookie) => cookie?.includes('payload-token=') || cookie?.includes('-token='))).toBe(
        true,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('callback redirects with not-found when no Payload user matches profile email', async () => {
    const state = 'valid-oauth-state-value'
    const profile = { email: 'unknown@example.com', sub: 'google-user-unknown' }

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve(Response.json({ access_token: 'google-access-token' }))
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return Promise.resolve(Response.json(profile))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }) as typeof fetch

    try {
      const request = new Request(
        `http://localhost:3000/api/auth/google/callback?state=${state}&code=auth-code`,
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
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin/login?ssl-error=not-found')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('callback redirects to admin login when token exchange fails', async () => {
    const state = 'valid-oauth-state-value'
    const originalFetch = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve(Response.json({ error: 'invalid_grant' }, { status: 400 }))) as typeof fetch

    try {
      const request = new Request(
        `http://localhost:3000/api/auth/google/callback?state=${state}&code=bad-code`,
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
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin/login?ssl-error=login')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('google and microsoft providers exchange code and fetch profile', async () => {
    const google = new GoogleProvider(dummyGoogle)
    const microsoft = new MicrosoftProvider({
      clientId: 'ms-client',
      clientSecret: 'ms-secret',
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve(Response.json({ access_token: 'g-token' }))
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return Promise.resolve(Response.json({ email: 'g@example.com', sub: 'g1' }))
      }
      if (url.includes('login.microsoftonline.com') && url.includes('/token')) {
        return Promise.resolve(Response.json({ access_token: 'ms-token' }))
      }
      if (url.includes('graph.microsoft.com/v1.0/me')) {
        return Promise.resolve(Response.json({ id: 'ms1', mail: 'ms@example.com' }))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }) as typeof fetch

    try {
      await expect(
        google.exchangeCode({
          code: 'code',
          redirectUri: 'http://localhost:3000/api/auth/google/callback',
        }),
      ).resolves.toEqual({ accessToken: 'g-token' })
      await expect(google.fetchProfile({ accessToken: 'g-token' })).resolves.toMatchObject({
        email: 'g@example.com',
      })

      await expect(
        microsoft.exchangeCode({
          code: 'code',
          redirectUri: 'http://localhost:3000/api/auth/microsoft/callback',
        }),
      ).resolves.toEqual({ accessToken: 'ms-token' })
      await expect(microsoft.fetchProfile({ accessToken: 'ms-token' })).resolves.toMatchObject({
        mail: 'ms@example.com',
      })
    } finally {
      globalThis.fetch = originalFetch
    }
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

  test('custom loginUrl and callbackURL register matching endpoints', () => {
    const baseConfig = {
      admin: { user: 'users' },
      collections: [],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      providers: {
        google: {
          ...dummyGoogle,
          callbackURL: '/oauth/google/done',
          loginUrl: '/oauth/google/start',
        },
      },
    })(baseConfig)

    expect(next.endpoints?.some((endpoint) => endpoint.path === '/oauth/google/start')).toBe(true)
    expect(next.endpoints?.some((endpoint) => endpoint.path === '/oauth/google/done')).toBe(true)

    const buttonHref = (
      next.admin?.components?.afterLogin?.find(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'path' in entry &&
          entry.path === 'payload-simple-social-login/client#SocialLoginButtons',
      ) as { clientProps?: { providers?: Array<{ href: string }> } } | undefined
    )?.clientProps?.providers?.[0]?.href

    expect(buttonHref).toBe('/api/oauth/google/start')
  })

  test('login endpoint uses custom callbackURL in redirect_uri', async () => {
    const baseConfig = {
      admin: { user: 'users' },
      collections: [],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      providers: {
        google: {
          ...dummyGoogle,
          callbackURL: '/oauth/google/done',
          loginUrl: '/oauth/google/start',
        },
      },
    })(baseConfig)

    const endpoint = next.endpoints?.find(
      (item) => item.path === '/oauth/google/start' && item.method === 'get',
    )
    expect(endpoint).toBeDefined()

    const request = new Request('http://localhost:3000/api/oauth/google/start', { method: 'GET' })
    const payloadRequest = await createPayloadRequest({ config, request })
    const response = await endpoint!.handler(payloadRequest)
    expect(response.status).toBe(302)

    const location = response.headers.get('location')
    expect(location).toBeTruthy()
    const authorizeUrl = new URL(location!)
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/oauth/google/done',
    )
  })

  test('normalizeProviderProfile maps google and microsoft fields', async () => {
    const { normalizeProviderProfile } = await import('../src/utils/normalizeProviderProfile.js')

    expect(
      normalizeProviderProfile({
        profile: { email: 'ada@example.com', sub: 'google-sub-1' },
        provider: 'google',
      }),
    ).toEqual({
      profileEmail: 'ada@example.com',
      profileId: 'google-sub-1',
    })

    expect(
      normalizeProviderProfile({
        profile: {
          id: 'ms-id-1',
          mail: null,
          userPrincipalName: 'ada@contoso.com',
        },
        provider: 'microsoft',
      }),
    ).toEqual({
      profileEmail: 'ada@contoso.com',
      profileId: 'ms-id-1',
    })
  })

  test('callback redirects with login error when profile has no email', async () => {
    const state = 'valid-oauth-state-value'
    const profile = { sub: 'google-user-no-email' }

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve(Response.json({ access_token: 'google-access-token' }))
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return Promise.resolve(Response.json(profile))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }) as typeof fetch

    try {
      const request = new Request(
        `http://localhost:3000/api/auth/google/callback?state=${state}&code=auth-code`,
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
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin/login?ssl-error=login')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('custom findUserCallback can allow or deny login', async () => {
    const state = 'valid-oauth-state-value'
    const profile = { email: 'dev@payloadcms.com', sub: 'google-user-custom' }

    const allowConfig = payloadSimpleSocialLogin({
      collections: [
        {
          collection: 'users',
          findUserCallback: async ({ payload: p, profileEmail }) => {
            if (!profileEmail) {
              return null
            }
            const result = await p.find({
              collection: 'users',
              limit: 1,
              overrideAccess: true,
              where: { email: { equals: profileEmail } },
            })
            const doc = result.docs[0]
            return doc ? { id: doc.id, email: doc.email } : null
          },
        },
      ],
      providers: { google: dummyGoogle },
    })({
      admin: { user: 'users' },
      collections: [],
      secret: 'test',
    } as unknown as Config)

    const denyConfig = payloadSimpleSocialLogin({
      collections: [
        {
          collection: 'users',
          findUserCallback: () => Promise.resolve(null),
        },
      ],
      providers: { google: dummyGoogle },
    })({
      admin: { user: 'users' },
      collections: [],
      secret: 'test',
    } as unknown as Config)

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve(Response.json({ access_token: 'google-access-token' }))
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return Promise.resolve(Response.json(profile))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }) as typeof fetch

    try {
      const request = new Request(
        `http://localhost:3000/api/auth/google/callback?state=${state}&code=auth-code`,
        {
          headers: {
            Cookie: `payload-ssl-state-google=${state}`,
          },
          method: 'GET',
        },
      )

      const allowEndpoint = allowConfig.endpoints?.find(
        (item) => item.path === '/auth/google/callback' && item.method === 'get',
      )
      const denyEndpoint = denyConfig.endpoints?.find(
        (item) => item.path === '/auth/google/callback' && item.method === 'get',
      )
      expect(allowEndpoint).toBeDefined()
      expect(denyEndpoint).toBeDefined()

      const allowRequest = await createPayloadRequest({ config, request: request.clone() })
      const allowResponse = await allowEndpoint!.handler(allowRequest)
      expect(allowResponse.status).toBe(302)
      expect(allowResponse.headers.get('location')).toBe('/admin')

      const denyRequest = await createPayloadRequest({ config, request: request.clone() })
      const denyResponse = await denyEndpoint!.handler(denyRequest)
      expect(denyResponse.status).toBe(302)
      expect(denyResponse.headers.get('location')).toBe('/admin/login?ssl-error=not-found')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
