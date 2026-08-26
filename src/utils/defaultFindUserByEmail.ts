import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import type { SocialLoginUser } from '../types.js'

import { UnverifiedSocialUserError } from '../errors/UnverifiedSocialUserError.js'

export const defaultFindUserByEmail = async ({
  autoVerify = false,
  collection,
  payload,
  profileEmail,
  req,
}: {
  autoVerify?: boolean
  collection: CollectionSlug
  payload: Payload
  profileEmail: string
  req?: PayloadRequest
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
    ...(req ? { req } : {}),
  })

  const doc = result.docs[0]
  if (!doc || typeof doc !== 'object' || !('id' in doc)) {
    return null
  }

  const collectionConfig = payload.collections[collection]?.config
  const requiresVerify = Boolean(collectionConfig?.auth?.verify)
  if (!requiresVerify || !('_verified' in doc) || doc._verified !== false) {
    return doc as SocialLoginUser
  }

  if (!autoVerify) {
    throw new UnverifiedSocialUserError()
  }

  const updated = await payload.update({
    id: doc.id,
    collection,
    data: {
      _verified: true,
    },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  return {
    ...(updated as SocialLoginUser),
    _verified: true,
  }
}
