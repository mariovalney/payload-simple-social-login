import type { CollectionSlug, PayloadRequest, TypedUser } from 'payload'

import { getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

import type { SocialLoginUser } from '../types.js'

export type LoginUserWithoutPasswordResult = {
  authCookie: string
  token: string
  user: SocialLoginUser
}

/**
 * Issue a Payload auth JWT and cookie for an already-resolved user (no password).
 * Mirrors the core login path: sessions, getFieldsToSign, jwtSign, before/afterLogin hooks.
 */
export const loginUserWithoutPassword = async ({
  collection,
  req,
  user: initialUser,
}: {
  collection: CollectionSlug
  req: PayloadRequest
  user: SocialLoginUser
}): Promise<LoginUserWithoutPasswordResult> => {
  const collectionConfig = req.payload.collections[collection]?.config
  if (!collectionConfig?.auth) {
    throw new Error(`Collection "${collection}" is not an auth collection`)
  }

  let user = { ...initialUser } as SocialLoginUser & TypedUser
  const email =
    typeof user.email === 'string' && user.email.trim().length > 0
      ? user.email.trim()
      : null

  if (!email) {
    throw new Error(`User "${String(user.id)}" is missing an email required for JWT signing`)
  }

  user = {
    ...user,
    collection,
    email,
  }

  const fieldsToSignArgs: Parameters<typeof getFieldsToSign>[0] = {
    collectionConfig,
    email,
    user,
  }

  const session = await addSessionToUser({
    collectionConfig,
    payload: req.payload,
    req,
    user,
  })

  if (session.sid) {
    fieldsToSignArgs.sid = session.sid
  }

  const fieldsToSign = getFieldsToSign(fieldsToSignArgs)

  if (collectionConfig.hooks?.beforeLogin?.length) {
    for (const hook of collectionConfig.hooks.beforeLogin) {
      user =
        (await hook({
          collection: collectionConfig,
          context: req.context,
          req,
          user,
        })) || user
    }
  }

  const { token } = await jwtSign({
    fieldsToSign,
    secret: req.payload.secret,
    tokenExpiration: collectionConfig.auth.tokenExpiration,
  })

  req.user = user

  if (collectionConfig.hooks?.afterLogin?.length) {
    for (const hook of collectionConfig.hooks.afterLogin) {
      user =
        (await hook({
          collection: collectionConfig,
          context: req.context,
          req,
          token,
          user,
        })) || user
    }
  }

  const authCookie = generatePayloadCookie({
    collectionAuthConfig: collectionConfig.auth,
    cookiePrefix: req.payload.config.cookiePrefix,
    token,
  })

  return {
    authCookie,
    token,
    user,
  }
}
