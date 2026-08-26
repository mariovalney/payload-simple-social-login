/**
 * Thrown by the default find-user path when the collection has `auth.verify`
 * and the matched user has `_verified === false`.
 *
 * Mapped to `ssl-error=unverified` on the OAuth callback redirect.
 */
export class UnverifiedSocialUserError extends Error {
  constructor(message = 'Email is not verified') {
    super(message)
    this.name = 'UnverifiedSocialUserError'
  }
}
