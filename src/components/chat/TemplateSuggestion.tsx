import { useTranslation } from 'react-i18next'
import { Lightbulb, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { TemplateSuggestion as TemplateSuggestionType } from '@/lib/agent/intent-classifier'

interface TemplateSuggestionProps {
  suggestion: TemplateSuggestionType
  onAccept: (templateId: string) => void
  onDismiss: () => void
}

export function TemplateSuggestion({ suggestion, onAccept, onDismiss }: TemplateSuggestionProps) {
  const { t } = useTranslation()
  const { template, confidence } = suggestion

  return (
    <Card className="mx-4 mb-2 border-primary/20 bg-primary/5">
      <CardContent className="flex items-start gap-3 py-3">
        <Lightbulb className="size-5 shrink-0 text-primary mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {t('chat.suggestion.title')}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {template.name} &mdash; {template.description}
          </p>
          {confidence >= 0.6 && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('chat.suggestion.highConfidence')}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => onAccept(template._id)}
            >
              {t('chat.suggestion.start')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
            >
              {t('chat.suggestion.dismiss')}
            </Button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('chat.suggestion.dismiss')}
        >
          <X className="size-4" />
        </button>
      </CardContent>
    </Card>
  )
}
