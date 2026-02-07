import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SentimentBadge } from '@/components/experiments/SentimentBadge'
import type { PersonaResult } from '@/store/experiment-store'
import type { ExperimentInsights } from '@/lib/modal-client'

interface SentimentOverviewProps {
  personaResults: PersonaResult[]
  insights: ExperimentInsights | null
}

function computeBreakdown(results: PersonaResult[]) {
  if (results.length === 0) return { positive: 0, neutral: 0, negative: 0, avgSentiment: 0 }

  let positive = 0
  let neutral = 0
  let negative = 0
  let totalSentiment = 0

  for (const r of results) {
    totalSentiment += r.sentiment
    if (r.sentiment > 0.3) positive++
    else if (r.sentiment < -0.3) negative++
    else neutral++
  }

  const total = results.length
  return {
    positive: Math.round((positive / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    negative: Math.round((negative / total) * 100),
    avgSentiment: totalSentiment / total,
  }
}

function computeArchetypeBreakdowns(results: PersonaResult[]) {
  const byArchetype: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {}

  for (const r of results) {
    if (!byArchetype[r.archetype]) {
      byArchetype[r.archetype] = { positive: 0, neutral: 0, negative: 0, total: 0 }
    }
    // Safe: we just ensured the key exists above
    const entry = byArchetype[r.archetype] as { positive: number; neutral: number; negative: number; total: number }
    entry.total++
    if (r.sentiment > 0.3) entry.positive++
    else if (r.sentiment < -0.3) entry.negative++
    else entry.neutral++
  }

  return byArchetype
}

export function SentimentOverview({ personaResults, insights }: SentimentOverviewProps) {
  const { t } = useTranslation()
  const breakdown = computeBreakdown(personaResults)
  const archetypeBreakdowns = computeArchetypeBreakdowns(personaResults)
  const archetypePatterns = insights?.archetype_patterns

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {t('results.sentiment.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average sentiment gauge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('results.sentiment.average')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tabular-nums">
              {breakdown.avgSentiment >= 0 ? '+' : ''}
              {breakdown.avgSentiment.toFixed(2)}
            </span>
            <SentimentBadge sentiment={breakdown.avgSentiment} size="sm" />
          </div>
        </div>

        {/* Stacked bar */}
        <div className="space-y-1.5">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
            {breakdown.positive > 0 && (
              <div
                className="bg-green-500 transition-all duration-500"
                style={{ width: `${breakdown.positive}%` }}
              />
            )}
            {breakdown.neutral > 0 && (
              <div
                className="bg-yellow-500 transition-all duration-500"
                style={{ width: `${breakdown.neutral}%` }}
              />
            )}
            {breakdown.negative > 0 && (
              <div
                className="bg-red-500 transition-all duration-500"
                style={{ width: `${breakdown.negative}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-green-500" />
              {t('experiment.positive')} {breakdown.positive}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-yellow-500" />
              {t('experiment.neutral')} {breakdown.neutral}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-red-500" />
              {t('experiment.negative')} {breakdown.negative}%
            </span>
          </div>
        </div>

        {/* Archetype breakdown */}
        {Object.keys(archetypeBreakdowns).length > 1 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('results.sentiment.byArchetype')}
            </span>
            {Object.entries(archetypeBreakdowns).map(([archetype, data]) => {
              const pPct = Math.round((data.positive / data.total) * 100)
              const nPct = Math.round((data.neutral / data.total) * 100)
              const negPct = Math.round((data.negative / data.total) * 100)
              const avgFromInsights = archetypePatterns?.[archetype]?.avg_sentiment

              return (
                <div key={archetype} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{archetype}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {avgFromInsights != null
                        ? `${avgFromInsights >= 0 ? '+' : ''}${avgFromInsights.toFixed(2)}`
                        : `${data.total}`}
                    </span>
                  </div>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    {pPct > 0 && (
                      <div className="bg-green-500" style={{ width: `${pPct}%` }} />
                    )}
                    {nPct > 0 && (
                      <div className="bg-yellow-500" style={{ width: `${nPct}%` }} />
                    )}
                    {negPct > 0 && (
                      <div className="bg-red-500" style={{ width: `${negPct}%` }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
