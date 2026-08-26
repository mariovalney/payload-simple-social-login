import type { Payload } from 'payload'

import { devUser, unverifiedUser } from './helpers/credentials.js'

const ensureUser = async ({
  data,
  payload,
  verified,
}: {
  data: { email: string; password: string }
  payload: Payload
  verified: boolean
}) => {
  const existing = await payload.find({
    collection: 'users',
    limit: 1,
    overrideAccess: true,
    where: {
      email: {
        equals: data.email,
      },
    },
  })

  const doc = existing.docs[0]
  if (!doc) {
    const created = await payload.create({
      collection: 'users',
      data: {
        ...data,
        _verified: verified,
      },
      overrideAccess: true,
    })

    if (verified && created._verified !== true) {
      await payload.update({
        id: created.id,
        collection: 'users',
        data: {
          _verified: true,
        },
        overrideAccess: true,
      })
    }
    return
  }

  if (verified && doc._verified !== true) {
    await payload.update({
      id: doc.id,
      collection: 'users',
      data: {
        _verified: true,
      },
      overrideAccess: true,
    })
  }
}

export const seed = async (payload: Payload) => {
  await ensureUser({ data: devUser, payload, verified: true })
  await ensureUser({ data: unverifiedUser, payload, verified: false })
}
