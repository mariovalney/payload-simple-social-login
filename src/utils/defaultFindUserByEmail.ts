import type { CollectionSlug, Payload } from 'payload'

import type { SocialLoginUser } from '../types.js'

import { UnverifiedSocialUserError } from '../errors/UnverifiedSocialUserError.js'

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

  const collectionConfig = payload.collections[collection]?.config
  const requiresVerify = Boolean(collectionConfig?.auth?.verify)
  if (requiresVerify && '_verified' in doc && doc._verified === false) {
    throw new UnverifiedSocialUserError()
  }

  return doc as SocialLoginUser
}
