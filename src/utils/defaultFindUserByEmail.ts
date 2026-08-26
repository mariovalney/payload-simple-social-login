import type { CollectionSlug, Payload } from 'payload'

import type { SocialLoginUser } from '../types.js'

export const defaultFindUserByEmail = async ({
  collection,
  payload,
  profileEmail,
}: {
  collection: CollectionSlug
  payload: Payload
  profileEmail: string
}): Promise<null | SocialLoginUser> => {
  const result = await payload.find({
    collection,
    limit: 1,
    overrideAccess: true,
    where: {
      email: {
        equals: profileEmail,
      },
    },
  })

  const doc = result.docs[0]
  if (!doc || typeof doc !== 'object' || !('id' in doc)) {
    return null
  }

  return doc as SocialLoginUser
}
