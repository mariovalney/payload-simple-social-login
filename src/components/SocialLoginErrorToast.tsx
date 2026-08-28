'use client'

import { toast, useTranslation } from '@payloadcms/ui'
import { useEffect } from 'react'

import type { PluginTranslationKeys, PluginTranslationsObject } from '../translations/index.js'

const SSL_ERROR_QUERY = 'ssl-error'

const ERROR_I18N_KEYS = {
  login: 'plugin-simple-social-login:loginFailed',
  not_found: 'plugin-simple-social-login:userNotFound',
  unverified: 'plugin-simple-social-login:emailNotVerified',
} as const satisfies Record<string, PluginTranslationKeys>

export const SocialLoginErrorToast = () => {
  const { t } = useTranslation<PluginTranslationsObject, PluginTranslationKeys>()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get(SSL_ERROR_QUERY)
    if (!code || !(code in ERROR_I18N_KEYS)) {
      return
    }

    toast.error(t(ERROR_I18N_KEYS[code as keyof typeof ERROR_I18N_KEYS]))

    params.delete(SSL_ERROR_QUERY)
    const query = params.toString()
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
  }, [t])

  return null
}
