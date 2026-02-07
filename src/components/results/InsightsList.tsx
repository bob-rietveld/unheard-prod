import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Lightbulb,
  AlertTriangle,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExperimentInsights } from '@/lib/modal-client'

interface InsightsListProps {
  insights: ExperimentInsights
}

export function InsightsList({ insights }: InsightsListProps) {
  const { t } = useTranslation()
  const [expandedArchetype, setExpandedArchetype] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {/* Key Themes */}
      {insights.themes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Hash className="size-3.5" />
              {t('results.insights.themes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {insights.themes.map(theme => (
                <Badge
                  key={theme.theme}
                  variant="secondary"
                  className="text-xs"
                >
                  {theme.theme}
                  <span className="ms-1 text-muted-foreground">
                    {theme.count}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Lightbulb className="size-3.5" />
              {t('results.insights.recommendations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5 list-decimal list-inside text-sm">
              {insights.recommendations.map((rec, i) => (
                <li key={i} className="text-muted-foreground leading-snug">
                  {rec}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Concerns */}
      {insights.concerns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              {t('results.insights.concerns')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {insights.concerns
                .sort((a, b) => b.frequency - a.frequency)
                .map(concern => (
                  <div
                    key={concern.concern}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <span className="text-muted-foreground leading-snug">
                      {concern.concern}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-xs tabular-nums">
                      {concern.frequency}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archetype Patterns */}
      {Object.keys(insights.archetype_patterns).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('results.insights.archetypePatterns')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(insights.archetype_patterns).map(
              ([archetype, pattern]) => {
                const isExpanded = expandedArchetype === archetype
                return (
                  <div key={archetype} className="border-b border-border last:border-0 pb-1 last:pb-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between h-7 px-1 text-xs"
                      onClick={() =>
                        setExpandedArchetype(prev =>
                          prev === archetype ? null : archetype
                        )
                      }
                    >
                      <span className="font-medium">{archetype}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums">
                          {pattern.avg_sentiment >= 0 ? '+' : ''}
                          {pattern.avg_sentiment.toFixed(2)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                      </div>
                    </Button>
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200',
                        isExpanded ? 'max-h-40 pb-1' : 'max-h-0'
                      )}
                    >
                      <div className="flex flex-wrap gap-1 px-1">
                        {pattern.key_themes.map(theme => (
                          <Badge
                            key={theme}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
