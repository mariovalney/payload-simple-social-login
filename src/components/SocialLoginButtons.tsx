'use client'

import { useTranslation } from '@payloadcms/ui'

import type { PluginTranslationKeys, PluginTranslationsObject } from '../translations/index.js'
import type { SocialProviderId } from '../types.js'

export type SocialLoginButtonProvider = {
  href: string
  id: SocialProviderId
  /** Overrides the default i18n provider label when set. */
  label?: string
}

export type SocialLoginButtonsProps = {
  providers: SocialLoginButtonProvider[]
}

export const SocialLoginButtons = ({ providers }: SocialLoginButtonsProps) => {
  const { t } = useTranslation<PluginTranslationsObject, PluginTranslationKeys>()

  if (!providers.length) {
    return null
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <p
        style={{
          marginBottom: 'var(--spacing-2)',
          opacity: 0.7,
        }}
      >
        {t('plugin-simple-social-login:orLoginWith')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {providers.map((provider) => (
          <a
            className="btn btn--style-primary btn--size-large btn--withoutPopup"
            href={provider.href}
            key={provider.id}
            style={{ marginBottom: 'var(--spacing-2)' }}
          >
            {provider.label ?? t(`plugin-simple-social-login:providers:${provider.id}`)}
          </a>
        ))}
      </div>
    </div>
  )
}
