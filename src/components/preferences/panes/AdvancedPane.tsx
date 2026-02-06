import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../shared/SettingsComponents'

export function AdvancedPane() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.advanced.title')}>
        <p className="text-sm text-muted-foreground">
          {t('preferences.advanced.comingSoon')}
        </p>
      </SettingsSection>
    </div>
  )
}
