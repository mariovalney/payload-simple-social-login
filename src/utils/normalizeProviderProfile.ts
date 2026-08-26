import type { SocialProviderId } from '../types.js'

export type NormalizedProviderProfile = {
  profileEmail: null | string
  profileId: null | string
}

const asNonEmptyString = (value: unknown): null | string => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Normalize IdP profile fields used for matching Payload users.
 *
 * - Google: `profileId` = `sub`, `profileEmail` = `email`
 * - Microsoft: `profileId` = `id`, `profileEmail` = `mail ?? userPrincipalName`
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
      profileEmail: asNonEmptyString(profile.email),
      profileId: asNonEmptyString(profile.sub),
    }
  }

  return {
    profileEmail:
      asNonEmptyString(profile.mail) ?? asNonEmptyString(profile.userPrincipalName),
    profileId: asNonEmptyString(profile.id),
  }
}
