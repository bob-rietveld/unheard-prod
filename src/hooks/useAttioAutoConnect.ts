import { useEffect } from 'react'
import { usePreferences } from '@/services/preferences'
import { useAttioStore } from '@/store/attio-store'
import { logger } from '@/lib/logger'

/**
 * Auto-connects to Attio on startup if an API key exists in preferences.
 * Should be called once from a top-level component (e.g., MainWindow).
 */
export function useAttioAutoConnect() {
  const { data: preferences } = usePreferences()

  useEffect(() => {
    if (!preferences) return

    const hasKey = !!preferences.attio_api_key
    const { isConnected } = useAttioStore.getState()

    if (hasKey && !isConnected) {
      logger.info('Attio API key found in preferences, auto-connecting')
      useAttioStore.getState().setConnected(true)
    } else if (!hasKey && isConnected) {
      logger.info('Attio API key removed from preferences, disconnecting')
      useAttioStore.getState().setConnected(false)
    }
  }, [preferences])
}
