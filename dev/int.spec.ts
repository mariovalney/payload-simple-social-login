import type { Config, Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { payloadSimpleSocialLogin } from '../src/index.js'

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

  test('disabled plugin returns config unchanged for endpoints', () => {
    const baseConfig = {
      collections: [],
      endpoints: [{ handler: () => Response.json({}), method: 'get', path: '/existing' }],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      disabled: true,
      providers: {},
    })(baseConfig)

    expect(next.endpoints).toEqual(baseConfig.endpoints)
  })

  test('enabled plugin keeps endpoints array scaffold', () => {
    const baseConfig = {
      collections: [],
      secret: 'test',
    } as unknown as Config

    const next = payloadSimpleSocialLogin({
      providers: {},
    })(baseConfig)

    expect(Array.isArray(next.endpoints)).toBe(true)
    expect(next.endpoints).toHaveLength(0)
  })
})
