import { useTranslation } from 'react-i18next'
import { BarChart3, Clock, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SentimentBadge } from './SentimentBadge'
import { useExperimentStore, type PersonaResult } from '@/store/experiment-store'

function computeSentimentBreakdown(results: PersonaResult[]) {
  if (results.length === 0) return { positive: 0, neutral: 0, negative: 0 }

  let positive = 0
  let neutral = 0
  let negative = 0

  for (const r of results) {
    if (r.sentiment > 0.3) positive++
    else if (r.sentiment < -0.3) negative++
    else neutral++
  }

  const total = results.length
  return {
    positive: Math.round((positive / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    negative: Math.round((negative / total) * 100),
  }
}

interface ExperimentSummaryProps {
  onViewResults?: () => void
  onAskFollowUp?: () => void
}

export function ExperimentSummary({
  onViewResults,
  onAskFollowUp,
}: ExperimentSummaryProps) {
  const { t } = useTranslation()
  const personaResults = useExperimentStore(state => state.personaResults)
  const startedAt = useExperimentStore(state => state.startedAt)
  const completedAt = useExperimentStore(state => state.completedAt)

  const breakdown = computeSentimentBreakdown(personaResults)
  const executionSeconds =
    startedAt && completedAt
      ? Math.round((completedAt - startedAt) / 1000)
      : null

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5" />
          {t('experiment.sentimentBreakdown')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment breakdown bars */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <SentimentBadge sentiment={1} size="sm" />
            <div className="flex-1 h-2 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${breakdown.positive}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-10 text-end">
              {breakdown.positive}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SentimentBadge sentiment={0} size="sm" />
            <div className="flex-1 h-2 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-yellow-500 transition-all duration-500"
                style={{ width: `${breakdown.neutral}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-10 text-end">
              {breakdown.neutral}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SentimentBadge sentiment={-1} size="sm" />
            <div className="flex-1 h-2 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-500"
                style={{ width: `${breakdown.negative}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-10 text-end">
              {breakdown.negative}%
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <Users className="size-4" />
            <span>{personaResults.length}</span>
          </div>
          {executionSeconds !== null && (
            <div className="flex items-center gap-1.5">
              <Clock className="size-4" />
              <span>
                {t('experiment.executionTime', { seconds: executionSeconds })}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          {onViewResults && (
            <Button variant="outline" onClick={onViewResults} className="flex-1">
              {t('experiment.viewResults')}
            </Button>
          )}
          {onAskFollowUp && (
            <Button onClick={onAskFollowUp} className="flex-1">
              {t('experiment.askFollowUp')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
