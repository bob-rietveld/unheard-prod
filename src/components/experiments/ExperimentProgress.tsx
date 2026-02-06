import { useTranslation } from 'react-i18next'
import { Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useExperimentStore } from '@/store/experiment-store'
import { PersonaResultCard } from './PersonaResultCard'

interface ExperimentProgressProps {
  onRetry?: () => void
}

export function ExperimentProgress({ onRetry }: ExperimentProgressProps) {
  const { t } = useTranslation()
  const status = useExperimentStore(state => state.status)
  const totalPersonas = useExperimentStore(state => state.totalPersonas)
  const completedPersonas = useExperimentStore(state => state.completedPersonas)
  const personaResults = useExperimentStore(state => state.personaResults)
  const error = useExperimentStore(state => state.error)

  const progressPercent =
    totalPersonas > 0 ? Math.round((completedPersonas / totalPersonas) * 100) : 0

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'error' ? (
            <AlertCircle className="size-5 text-destructive" />
          ) : status !== 'complete' ? (
            <Loader2 className="size-5 animate-spin" />
          ) : null}
          {status === 'generating_personas' && t('experiment.generatingPersonas')}
          {status === 'running' && t('experiment.running')}
          {status === 'complete' && t('experiment.complete')}
          {status === 'error' && t('experiment.failed')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        {(status === 'running' || status === 'generating_personas') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('experiment.personasResponded', {
                  completed: completedPersonas,
                  total: totalPersonas,
                })}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {t('experiment.retryExperiment')}
              </Button>
            )}
          </div>
        )}

        {/* Persona results list */}
        {personaResults.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {personaResults.map(result => (
              <PersonaResultCard key={result.personaId} result={result} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
