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
      userNotFound: 'No account found for this email. Ask an admin for access.',
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
      userNotFound: 'Nenhuma conta encontrada para este e-mail. Peça acesso a um administrador.',
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
  | 'plugin-simple-social-login:userNotFound'
