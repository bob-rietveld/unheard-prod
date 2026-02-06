import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { useAttioStore } from '@/store/attio-store'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { testConnection } from '@/lib/attio-client'
import { logger } from '@/lib/logger'

export function IntegrationsPane() {
  const { t } = useTranslation()
  const isConnected = useAttioStore(state => state.isConnected)
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !preferences) return

    setTesting(true)
    setTestResult(null)
    setErrorMessage('')

    try {
      const success = await testConnection(apiKey.trim())
      if (success) {
        setTestResult('success')
        // Save to Tauri preferences (app data dir, not localStorage)
        await savePreferences.mutateAsync({
          ...preferences,
          attio_api_key: apiKey.trim(),
        })
        useAttioStore.getState().setConnected(true)
        useAttioStore.getState().setConnectionError(null)
        setApiKey('')
        logger.info('Attio API key saved to preferences')
      } else {
        setTestResult('error')
        setErrorMessage(t('attio.connectionError'))
      }
    } catch (err) {
      setTestResult('error')
      setErrorMessage(err instanceof Error ? err.message : t('attio.connectionError'))
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!preferences) return

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        attio_api_key: null,
      })
      useAttioStore.getState().setConnected(false)
      useAttioStore.getState().setConnectionError(null)
      setApiKey('')
      setTestResult(null)
      setErrorMessage('')
      logger.info('Attio API key removed from preferences')
    } catch (err) {
      logger.error('Failed to remove Attio API key', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.integrations.attio')}>
        {isConnected ? (
          <div className="space-y-4">
            <SettingsField
              label={t('attio.apiKey')}
              description={t('preferences.integrations.attioConnectedDescription')}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="size-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">{t('attio.connected')}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDisconnect()}
                  disabled={savePreferences.isPending}
                >
                  {t('attio.disconnect')}
                </Button>
              </div>
            </SettingsField>

            {/* Allow replacing with a different key */}
            <SettingsField
              label={t('preferences.integrations.changeKey')}
              description={t('preferences.integrations.changeKeyDescription')}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder={t('attio.apiKeyPlaceholder')}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      void handleTestConnection()
                    }
                  }}
                  className="max-w-sm"
                />
                <Button
                  size="sm"
                  onClick={() => void handleTestConnection()}
                  disabled={!apiKey.trim() || testing || savePreferences.isPending}
                >
                  {testing && <Loader2 className="size-4 animate-spin" />}
                  {testing ? t('attio.testing') : t('attio.testConnection')}
                </Button>
              </div>
              {testResult === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="size-4" />
                  <span>{t('attio.connectionSuccess')}</span>
                </div>
              )}
              {testResult === 'error' && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="size-4" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </SettingsField>
          </div>
        ) : (
          <SettingsField
            label={t('attio.apiKey')}
            description={t('preferences.integrations.attioDescription')}
          >
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder={t('attio.apiKeyPlaceholder')}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    void handleTestConnection()
                  }
                }}
                className="max-w-sm"
              />
              <Button
                size="sm"
                onClick={() => void handleTestConnection()}
                disabled={!apiKey.trim() || testing || !preferences || savePreferences.isPending}
              >
                {testing && <Loader2 className="size-4 animate-spin" />}
                {testing ? t('attio.testing') : t('attio.testConnection')}
              </Button>
            </div>
            {testResult === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="size-4" />
                <span>{t('attio.connectionSuccess')}</span>
              </div>
            )}
            {testResult === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="size-4" />
                <span>{errorMessage}</span>
              </div>
            )}
          </SettingsField>
        )}
      </SettingsSection>
    </div>
  )
}
