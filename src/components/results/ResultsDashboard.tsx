import { useTranslation } from 'react-i18next'
import { BarChart3, X, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useExperimentStore } from '@/store/experiment-store'
import { useUIStore } from '@/store/ui-store'
import { SentimentOverview } from './SentimentOverview'
import { VanWestendorpChart } from './VanWestendorpChart'
import { InsightsList } from './InsightsList'
import { ResponseTable } from './ResponseTable'
import { ExportButton } from './ExportButton'

export function ResultsDashboard() {
  const { t } = useTranslation()
  const status = useExperimentStore(state => state.status)
  const personaResults = useExperimentStore(state => state.personaResults)
  const insights = useExperimentStore(state => state.insights)
  const startedAt = useExperimentStore(state => state.startedAt)
  const completedAt = useExperimentStore(state => state.completedAt)
  const setRightSidebarVisible = useUIStore(state => state.setRightSidebarVisible)

  const executionSeconds =
    startedAt && completedAt
      ? Math.round((completedAt - startedAt) / 1000)
      : null

  // Show empty state when no experiment data
  if (status === 'idle' && personaResults.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">{t('results.dashboard.title')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setRightSidebarVisible(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <BarChart3 className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t('results.dashboard.empty')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="size-4 shrink-0" />
          <span className="text-sm font-medium truncate">
            {t('results.dashboard.title')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ExportButton
            personaResults={personaResults}
            insights={insights}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setRightSidebarVisible(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {personaResults.length} {t('results.dashboard.respondents')}
        </span>
        {executionSeconds !== null && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {t('experiment.executionTime', { seconds: executionSeconds })}
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Sentiment Overview */}
          <SentimentOverview
            personaResults={personaResults}
            insights={insights}
          />

          {/* Van Westendorp chart (if pricing data available) */}
          {insights?.van_westendorp && (
            <VanWestendorpChart data={insights.van_westendorp} />
          )}

          {/* AI Insights */}
          {insights && <InsightsList insights={insights} />}

          {/* Response Table */}
          {personaResults.length > 0 && (
            <ResponseTable results={personaResults} />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
