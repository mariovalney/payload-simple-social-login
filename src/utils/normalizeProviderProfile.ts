import type { SocialProviderId } from '../types.js'

export type NormalizedProviderProfile = {
  profileEmail: null | string
  profileId: null | string
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

/**
 * Microsoft marks B2B guest UPNs with `#EXT#`
 * (e.g. `ada_example.com#EXT#@contoso.onmicrosoft.com`).
 */
const GUEST_UPN_MARKER = '#ext#'

const asNonEmptyString = (value: unknown): null | string => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Trim and lowercase an email-shaped string, or `null` for anything else.
 * Payload stores auth emails in lowercase and the default match uses `equals`.
 */
export const normalizeEmail = (value: unknown): null | string => {
  const email = asNonEmptyString(value)?.toLowerCase()
  return email && EMAIL_SHAPE.test(email) ? email : null
}

/**
 * Normalize IdP profile fields used for matching Payload users.
 *
 * `profileEmail` is only set when the provider vouches for the address:
 *
 * - Google: `email`, only when `email_verified === true`. The UserInfo endpoint documents
 *   `email_verified` as a boolean; the `"true"` string form belongs to the Tokeninfo endpoint,
 *   which this plugin does not call.
 *   {@link https://developers.google.com/identity/openid-connect/reference#userinfofields}
 * - Microsoft: `userPrincipalName` only, which must be in a domain the tenant verified (or the
 *   sign-in address of a personal account). `mail` is never used: tenant admins can set it to
 *   any address. Guest (`#EXT#`) and non-email UPNs yield `null`.
 *   {@link https://learn.microsoft.com/graph/api/resources/user?view=graph-rest-1.0}
 *
 * `profileId` is `sub` (Google) or `id` (Microsoft).
 */
export const normalizeProviderProfile = ({
  profile,
  provider,
}: {
  profile: Record<string, unknown>
  provider: SocialProviderId
}): NormalizedProviderProfile => {
  if (provider === 'google') {
    return {
      profileEmail: profile.email_verified === true ? normalizeEmail(profile.email) : null,
      profileId: asNonEmptyString(profile.sub),
    }
  }

  const upn = normalizeEmail(profile.userPrincipalName)

  return {
    profileEmail: upn && !upn.includes(GUEST_UPN_MARKER) ? upn : null,
    profileId: asNonEmptyString(profile.id),
  }
}
