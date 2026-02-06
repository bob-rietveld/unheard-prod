import { useTranslation } from 'react-i18next'
import { Play, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useExperimentStore } from '@/store/experiment-store'

interface ExperimentConfig {
  personaCount: number
  model: string
  templateName: string
}

interface RunExperimentButtonProps {
  config: ExperimentConfig
  onRun: () => void
}

export function RunExperimentButton({ config, onRun }: RunExperimentButtonProps) {
  const { t } = useTranslation()
  const status = useExperimentStore(state => state.status)

  const isRunning =
    status === 'generating_personas' || status === 'running'

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{config.templateName}</p>
          <p className="text-xs text-muted-foreground">
            {config.personaCount} personas, {config.model}
          </p>
        </div>
        <Button onClick={onRun} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('experiment.running')}
            </>
          ) : (
            <>
              <Play className="size-4" />
              {t('experiment.runExperiment')}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
