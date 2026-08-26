'use client'

import { toast, useTranslation } from '@payloadcms/ui'
import { useEffect } from 'react'

import type { PluginTranslationKeys, PluginTranslationsObject } from '../translations/index.js'

const SSL_ERROR_QUERY = 'ssl-error'

export const SocialLoginErrorToast = () => {
  const { t } = useTranslation<PluginTranslationsObject, PluginTranslationKeys>()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get(SSL_ERROR_QUERY) !== '1') {
      return
    }

    toast.error(t('plugin-simple-social-login:loginFailed'))

    params.delete(SSL_ERROR_QUERY)
    const query = params.toString()
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
  }, [t])

  return null
}
