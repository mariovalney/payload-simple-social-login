import type { Config, Payload, PayloadRequest } from 'payload'

import config from '@payload-config'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createSocialAuthEndpoints, payloadSimpleSocialLogin } from '../src/index.js'
import { GoogleProvider } from '../src/providers/google.js'
import { MicrosoftProvider } from '../src/providers/microsoft.js'
import { getOAuthStateCookieName } from '../src/utils/oauthState.js'
import { resolveAbsoluteCallbackUrl } from '../src/utils/resolveAbsoluteCallbackUrl.js'

const dummyGoogle = {
  clientId: 'test-google-client-id',
  clientSecret: 'test-google-client-secret',
}

const googleDefaultStateCookie = getOAuthStateCookieName({
  callbackURL: '/auth/google/callback',
  providerId: 'google',
})

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
          Cookie: `${googleDefaultStateCookie}=cookie-state`,
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
          Cookie: `${googleDefaultStateCookie}=${state}`,
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
    expect(setCookie).toContain(`${googleDefaultStateCookie}=`)
    expect(setCookie).toMatch(/Max-Age=0|Expires=/i)
  })

  test('callback redirects to admin login when IdP returns error query', async () => {
    const state = 'valid-oauth-state-value'
    const request = new Request(
      `http://localhost:3000/api/auth/google/callback?state=${state}&error=access_denied`,
      {
        headers: {
          Cookie: `${googleDefaultStateCookie}=${state}`,
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
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

      expect(cookies.some((cookie) => cookie?.includes(`${googleDefaultStateCookie}=`))).toBe(true)
      expect(cookies.some((cookie) => cookie?.match(/Max-Age=0|Expires=/i))).toBe(true)
      expect(cookies.some((cookie) => cookie?.includes('payload-token=') || cookie?.includes('-token='))).toBe(
        true,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('callback redirects with not_found when no Payload user matches profile email', async () => {
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
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
      expect(response.headers.get('location')).toBe('/admin/login?ssl-error=not_found')
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
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
    expect(setCookie).toContain(`${googleDefaultStateCookie}=${state}`)
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
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

  test('callback redirects with unverified when default findUser matches an unverified user', async () => {
    const state = 'valid-oauth-state-value'
    const profile = { email: 'unverified@payloadcms.com', sub: 'google-user-unverified' }

    const noAutoVerifyConfig = payloadSimpleSocialLogin({
      collections: [
        {
          collection: 'users',
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
          },
          method: 'GET',
        },
      )

      const payloadRequest = await createPayloadRequest({ config, request })
      const endpoint = noAutoVerifyConfig.endpoints?.find(
        (item) => item.path === '/auth/google/callback' && item.method === 'get',
      )

      expect(endpoint).toBeDefined()
      const response = await endpoint!.handler(payloadRequest)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin/login?ssl-error=unverified')

      const cookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean)

      expect(
        cookies.some((cookie) => cookie?.includes('payload-token=') || cookie?.includes('-token=')),
      ).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('autoVerify marks unverified user verified and logs in on default find', async () => {
    const email = 'autoverify@payloadcms.com'
    const created = await payload.create({
      collection: 'users',
      data: {
        _verified: false,
        email,
        password: 'test',
      },
      overrideAccess: true,
    })
    if (created._verified !== false) {
      await payload.update({
        id: created.id,
        collection: 'users',
        data: { _verified: false },
        overrideAccess: true,
      })
    }

    const state = 'valid-oauth-state-value'
    const profile = { email, sub: 'google-user-autoverify' }

    const autoVerifyConfig = payloadSimpleSocialLogin({
      collections: [
        {
          autoVerify: true,
          collection: 'users',
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
          },
          method: 'GET',
        },
      )

      const endpoint = autoVerifyConfig.endpoints?.find(
        (item) => item.path === '/auth/google/callback' && item.method === 'get',
      )
      expect(endpoint).toBeDefined()

      const payloadRequest = await createPayloadRequest({ config, request })
      const response = await endpoint!.handler(payloadRequest)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin')

      const cookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean)

      expect(
        cookies.some((cookie) => cookie?.includes('payload-token=') || cookie?.includes('-token=')),
      ).toBe(true)

      const after = await payload.findByID({
        id: created.id,
        collection: 'users',
        overrideAccess: true,
      })
      expect(after._verified).toBe(true)
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
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
      expect(denyResponse.headers.get('location')).toBe('/admin/login?ssl-error=not_found')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('custom findUserCallback is not blocked by auth.verify', async () => {
    const state = 'valid-oauth-state-value'
    const profile = { email: 'unverified@payloadcms.com', sub: 'google-user-custom-unverified' }

    const customConfig = payloadSimpleSocialLogin({
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
            Cookie: `${googleDefaultStateCookie}=${state}`,
          },
          method: 'GET',
        },
      )

      const endpoint = customConfig.endpoints?.find(
        (item) => item.path === '/auth/google/callback' && item.method === 'get',
      )
      expect(endpoint).toBeDefined()

      const payloadRequest = await createPayloadRequest({ config, request })
      const response = await endpoint!.handler(payloadRequest)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin')

      const cookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean)

      expect(
        cookies.some((cookie) => cookie?.includes('payload-token=') || cookie?.includes('-token=')),
      ).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('custom onSuccess receives profile without email and does not issue Payload session', async () => {
    const state = 'valid-oauth-state-value'
    const profile = { sub: 'google-user-no-email-custom' }
    const appStateCookie = getOAuthStateCookieName({
      callbackURL: '/app/google/callback',
      providerId: 'google',
    })

    const customConfig = {
      admin: { user: 'users' },
      collections: [],
      endpoints: createSocialAuthEndpoints({
        ...dummyGoogle,
        callbackURL: '/app/google/callback',
        loginUrl: '/app/google/login',
        onSuccess: ({ profileEmail, profileId }) =>
          Response.json({ profileEmail, profileId }),
        provider: 'google',
      }),
      secret: 'test',
    } as unknown as Config

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
        `http://localhost:3000/api/app/google/callback?state=${state}&code=auth-code`,
        {
          headers: {
            Cookie: `${appStateCookie}=${state}`,
          },
          method: 'GET',
        },
      )

      const endpoint = customConfig.endpoints?.find(
        (item) => item.path === '/app/google/callback' && item.method === 'get',
      )
      expect(endpoint).toBeDefined()

      const payloadRequest = await createPayloadRequest({ config, request })
      const response = await endpoint!.handler(payloadRequest)
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        profileEmail: null,
        profileId: 'google-user-no-email-custom',
      })

      const cookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean)

      expect(cookies.some((cookie) => cookie?.includes(`${appStateCookie}=`))).toBe(true)
      expect(cookies.some((cookie) => cookie?.match(/Max-Age=0|Expires=/i))).toBe(true)
      expect(
        cookies.some((cookie) => cookie?.includes('payload-token=') || cookie?.includes('-token=')),
      ).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('two google flows use different state cookie names', async () => {
    const adminCookie = getOAuthStateCookieName({
      callbackURL: '/auth/google/callback',
      providerId: 'google',
    })
    const appCookie = getOAuthStateCookieName({
      callbackURL: '/app/google/callback',
      providerId: 'google',
    })

    expect(adminCookie).toBe('payload-auth-state-google_auth-google-callback')
    expect(appCookie).toBe('payload-auth-state-google_app-google-callback')
    expect(adminCookie).not.toBe(appCookie)

    const baseConfig = {
      admin: { user: 'users' },
      collections: [],
      endpoints: [
        ...createSocialAuthEndpoints({
          ...dummyGoogle,
          collections: [{ collection: 'users' }],
          provider: 'google',
        }),
        ...createSocialAuthEndpoints({
          ...dummyGoogle,
          callbackURL: '/app/google/callback',
          loginUrl: '/app/google/login',
          onSuccess: () => Response.json({ ok: true }),
          provider: 'google',
        }),
      ],
      secret: 'test',
    } as unknown as Config

    const adminLogin = baseConfig.endpoints?.find(
      (item) => item.path === '/auth/google/login' && item.method === 'get',
    )
    const appLogin = baseConfig.endpoints?.find(
      (item) => item.path === '/app/google/login' && item.method === 'get',
    )

    expect(adminLogin).toBeDefined()
    expect(appLogin).toBeDefined()

    const adminRequest = await createPayloadRequest({
      config,
      request: new Request('http://localhost:3000/api/auth/google/login', { method: 'GET' }),
    })
    const appRequest = await createPayloadRequest({
      config,
      request: new Request('http://localhost:3000/api/app/google/login', { method: 'GET' }),
    })

    const adminResponse = await adminLogin!.handler(adminRequest)
    const appResponse = await appLogin!.handler(appRequest)

    expect(adminResponse.headers.get('set-cookie')).toContain(`${adminCookie}=`)
    expect(appResponse.headers.get('set-cookie')).toContain(`${appCookie}=`)
  })

  test('custom onError returns app response and still clears state cookie', async () => {
    const state = 'valid-oauth-state-value'
    const appStateCookie = getOAuthStateCookieName({
      callbackURL: '/app/google/callback',
      providerId: 'google',
    })

    const customConfig = {
      admin: { user: 'users' },
      collections: [],
      endpoints: createSocialAuthEndpoints({
        ...dummyGoogle,
        callbackURL: '/app/google/callback',
        loginUrl: '/app/google/login',
        onError: () =>
          new Response(null, {
            headers: { Location: '/app/login?error=oauth' },
            status: 302,
          }),
        onSuccess: () => Response.json({ ok: true }),
        provider: 'google',
      }),
      secret: 'test',
    } as unknown as Config

    const request = new Request(`http://localhost:3000/api/app/google/callback?state=${state}`, {
      headers: {
        Cookie: `${appStateCookie}=${state}`,
      },
      method: 'GET',
    })

    const endpoint = customConfig.endpoints?.find(
      (item) => item.path === '/app/google/callback' && item.method === 'get',
    )
    expect(endpoint).toBeDefined()

    const payloadRequest = await createPayloadRequest({ config, request })
    const response = await endpoint!.handler(payloadRequest)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/app/login?error=oauth')

    const cookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean)

    expect(cookies.some((cookie) => cookie?.includes(`${appStateCookie}=`))).toBe(true)
    expect(cookies.some((cookie) => cookie?.match(/Max-Age=0|Expires=/i))).toBe(true)
  })
})

describe('resolveAbsoluteCallbackUrl', () => {
  const googleCallback = '/auth/google/callback'

  type FakeRequestArgs = {
    cors?: string | string[]
    csrf?: string[]
    headers?: Record<string, string>
    serverURL?: string
    url?: string
  }

  const createFakeRequest = ({
    cors = [],
    csrf = [],
    headers = {},
    serverURL = '',
    url = 'http://localhost:3000/api/auth/google/callback',
  }: FakeRequestArgs = {}): { req: PayloadRequest; warnings: string[] } => {
    const warnings: string[] = []

    const req = {
      headers: new Headers(headers),
      payload: {
        config: {
          cors,
          csrf,
          routes: { api: '/api' },
          serverURL,
        },
        logger: {
          warn: (message: string) => warnings.push(message),
        },
      },
      url,
    } as unknown as PayloadRequest

    return { req, warnings }
  }

  test('serverURL option as string wins over the Payload config', () => {
    const { req } = createFakeRequest({ serverURL: 'https://config.example.com' })

    expect(
      resolveAbsoluteCallbackUrl({
        callbackURL: googleCallback,
        req,
        serverURL: 'https://option.example.com/',
      }),
    ).toBe('https://option.example.com/api/auth/google/callback')
  })

  test('serverURL option as function resolves per request', () => {
    const serverURL = (req: PayloadRequest) => {
      const host = req.headers.get('host')
      return host ? `https://${host}` : null
    }

    const admin = createFakeRequest({ headers: { host: 'admin.example.com' } })
    const sso = createFakeRequest({ headers: { host: 'sso.example.com' } })
    const none = createFakeRequest({ serverURL: 'https://config.example.com' })

    expect(resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req: admin.req, serverURL })).toBe(
      'https://admin.example.com/api/auth/google/callback',
    )
    expect(resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req: sso.req, serverURL })).toBe(
      'https://sso.example.com/api/auth/google/callback',
    )
    expect(resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req: none.req, serverURL })).toBe(
      'https://config.example.com/api/auth/google/callback',
    )
  })

  test('falls back to serverURL from the Payload config', () => {
    const { req, warnings } = createFakeRequest({ serverURL: 'https://config.example.com/' })

    expect(resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req })).toBe(
      'https://config.example.com/api/auth/google/callback',
    )
    expect(warnings).toHaveLength(0)
  })

  test('uses the Host header when the origin is in the CORS/CSRF allowlist', () => {
    const fromCors = createFakeRequest({
      cors: ['https://app.example.com'],
      headers: { host: 'app.example.com', 'x-forwarded-proto': 'https' },
    })
    const fromCsrf = createFakeRequest({
      csrf: ['https://app.example.com'],
      headers: { host: 'app.example.com', 'x-forwarded-proto': 'https' },
    })

    expect(resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req: fromCors.req })).toBe(
      'https://app.example.com/api/auth/google/callback',
    )
    expect(fromCors.warnings).toHaveLength(0)

    expect(resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req: fromCsrf.req })).toBe(
      'https://app.example.com/api/auth/google/callback',
    )
    expect(fromCsrf.warnings).toHaveLength(0)
  })

  test('warns and ignores the Host header when the origin is not in the allowlist', () => {
    const { req, warnings } = createFakeRequest({
      cors: ['https://other.example.com'],
      headers: { host: 'attacker.example.com', 'x-forwarded-proto': 'https' },
      url: 'http://localhost:3000/api/auth/google/callback',
    })

    const result = resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req })

    expect(result).not.toContain('attacker.example.com')
    expect(result).toBe('http://localhost:3000/api/auth/google/callback')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('https://attacker.example.com')
    expect(warnings[0]).toContain('serverURL')
  })

  test('wildcard cors is not an allowlist and never trusts the Host header', () => {
    const { req, warnings } = createFakeRequest({
      cors: '*',
      headers: { host: 'attacker.example.com', 'x-forwarded-proto': 'https' },
    })

    expect(resolveAbsoluteCallbackUrl({ callbackURL: googleCallback, req })).toBe(
      'http://localhost:3000/api/auth/google/callback',
    )
    expect(warnings).toHaveLength(1)
  })

  test('behind a proxy the internal req.url host is never used as the origin', () => {
    const microsoftCallback = '/auth/microsoft/callback'
    const proxyHeaders = { host: 'sso.example.com', 'x-forwarded-proto': 'https' }
    const internalUrl = 'https://localhost:80/api/auth/microsoft/callback'

    const allowlisted = createFakeRequest({
      cors: ['https://sso.example.com'],
      headers: proxyHeaders,
      url: internalUrl,
    })

    expect(resolveAbsoluteCallbackUrl({ callbackURL: microsoftCallback, req: allowlisted.req })).toBe(
      'https://sso.example.com/api/auth/microsoft/callback',
    )
    expect(allowlisted.warnings).toHaveLength(0)

    const withOption = createFakeRequest({ headers: proxyHeaders, url: internalUrl })

    expect(
      resolveAbsoluteCallbackUrl({
        callbackURL: microsoftCallback,
        req: withOption.req,
        serverURL: 'https://sso.example.com',
      }),
    ).toBe('https://sso.example.com/api/auth/microsoft/callback')
    expect(withOption.warnings).toHaveLength(0)

    const unconfigured = createFakeRequest({ headers: proxyHeaders, url: internalUrl })

    expect(resolveAbsoluteCallbackUrl({ callbackURL: microsoftCallback, req: unconfigured.req })).toBe(
      'https://localhost:80/api/auth/microsoft/callback',
    )
    expect(unconfigured.warnings).toHaveLength(1)
  })

  test('login and callback endpoints resolve the same redirect_uri', async () => {
    const state = 'valid-oauth-state-value'
    const callbackURL = '/proxy/google/callback'
    const stateCookie = getOAuthStateCookieName({ callbackURL, providerId: 'google' })

    const endpoints = createSocialAuthEndpoints({
      ...dummyGoogle,
      callbackURL,
      loginUrl: '/proxy/google/login',
      onSuccess: () => Response.json({ ok: true }),
      provider: 'google',
      serverURL: (req) => {
        const host = req.headers.get('host')
        return host ? `https://${host}` : null
      },
    })

    const loginEndpoint = endpoints.find((item) => item.path === '/proxy/google/login')
    const callbackEndpoint = endpoints.find((item) => item.path === callbackURL)

    expect(loginEndpoint).toBeDefined()
    expect(callbackEndpoint).toBeDefined()

    const proxyHeaders = { host: 'sso.example.com', 'x-forwarded-proto': 'https' }

    const loginRequest = await createPayloadRequest({
      config,
      request: new Request('https://localhost:80/api/proxy/google/login', {
        headers: proxyHeaders,
        method: 'GET',
      }),
    })

    const loginResponse = await loginEndpoint!.handler(loginRequest)
    const loginRedirectUri = new URL(loginResponse.headers.get('location')!).searchParams.get(
      'redirect_uri',
    )

    expect(loginRedirectUri).toBe('https://sso.example.com/api/proxy/google/callback')
    expect(loginResponse.headers.get('set-cookie')).toMatch(/Secure/i)

    let callbackRedirectUri: null | string = null
    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('oauth2.googleapis.com/token')) {
        const body = init?.body as undefined | URLSearchParams
        callbackRedirectUri = new URLSearchParams(body?.toString()).get('redirect_uri')
        return Promise.resolve(Response.json({ access_token: 'google-access-token' }))
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return Promise.resolve(Response.json({ email: 'ada@example.com', sub: 'google-sub' }))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }) as typeof fetch

    try {
      const callbackRequest = await createPayloadRequest({
        config,
        request: new Request(
          `https://localhost:80/api/proxy/google/callback?state=${state}&code=auth-code`,
          {
            headers: {
              ...proxyHeaders,
              Cookie: `${stateCookie}=${state}`,
            },
            method: 'GET',
          },
        ),
      })

      const callbackResponse = await callbackEndpoint!.handler(callbackRequest)
      expect(callbackResponse.status).toBe(200)
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(callbackRedirectUri).toBe(loginRedirectUri)
  })
})
