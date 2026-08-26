/**
 * Default i18n strings for this plugin.
 * Apps can override via `i18n.translations` in the Payload config.
 *
 * @example
 * ```ts
 * i18n: {
 *   translations: {
 *     en: {
 *       'plugin-simple-social-login': {
 *         orLoginWith: 'or continue with',
 *       },
 *     },
 *   },
 * }
 * ```
 */
export const translations = {
  en: {
    'plugin-simple-social-login': {
      loginFailed: 'Something went wrong. Please try again.',
      orLoginWith: 'or login with',
      providers: {
        google: 'Google',
        microsoft: 'Microsoft',
      },
    },
  },
  pt: {
    'plugin-simple-social-login': {
      loginFailed: 'Algo deu errado. Tente novamente.',
      orLoginWith: 'ou entre com',
      providers: {
        google: 'Google',
        microsoft: 'Microsoft',
      },
    },
  },
} as const

export type PluginTranslationsObject = (typeof translations)['en']

/** Payload i18n keys use `namespace:path:to:leaf` (colons, not dots). */
export type PluginTranslationKeys =
  | 'plugin-simple-social-login:loginFailed'
  | 'plugin-simple-social-login:orLoginWith'
  | 'plugin-simple-social-login:providers:google'
  | 'plugin-simple-social-login:providers:microsoft'
