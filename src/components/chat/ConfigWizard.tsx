/**
 * ConfigWizard component manages the sequential configuration flow
 * for experiment templates.
 *
 * Flow:
 * 1. Fetches template from Convex by ID
 * 2. Parses YAML configuration_flow
 * 3. Displays questions one at a time
 * 4. Validates answers before allowing progression
 * 5. Shows summary screen when all answered
 * 6. Stores final config in useChatStore.configAnswers
 *
 * UI Features:
 * - Progress indicator: "Question X of Y"
 * - Real-time validation with inline errors
 * - Next button disabled when invalid
 * - Review summary with all answers
 * - Confirm button to finalize configuration
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTemplate } from '@/services/templates'
import { useChatStore } from '@/store/chat-store'
import { parseTemplateYaml } from '@/lib/template-parser'
import type { ParsedTemplate } from '@/types/template'
import { ConfigQuestion } from './ConfigQuestion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { Id } from '../../../convex/_generated/dataModel'

interface ConfigWizardProps {
  templateId: Id<'experimentTemplates'>
  onComplete: (config: Record<string, unknown>) => void
  onCancel: () => void
}

export function ConfigWizard({
  templateId,
  onComplete,
  onCancel,
}: ConfigWizardProps) {
  const { t } = useTranslation()
  const configAnswers = useChatStore(state => state.configAnswers)
  const updateConfigAnswer = useChatStore(state => state.updateConfigAnswer)

  const { data: template, isLoading, error } = useTemplate(templateId)

  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(
    null
  )
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isCurrentValid, setIsCurrentValid] = useState(false)
  const [currentError, setCurrentError] = useState<string>()
  const [showSummary, setShowSummary] = useState(false)

  // Parse template YAML when loaded (using useEffect to update state)
  useEffect(() => {
    if (template?.yamlContent) {
      const parsed = parseTemplateYaml(template.yamlContent)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParsedTemplate(parsed)

      if (!parsed) {
        console.error('Failed to parse template YAML')
      }
    }
  }, [template])

  const handleValidationChange = (isValid: boolean, error?: string) => {
    setIsCurrentValid(isValid)
    setCurrentError(error)
  }

  const handleNext = () => {
    if (!parsedTemplate) return

    const nextIndex = currentQuestionIndex + 1
    if (nextIndex >= parsedTemplate.configurationFlow.length) {
      // All questions answered - show summary
      setShowSummary(true)
    } else {
      setCurrentQuestionIndex(nextIndex)
    }
  }

  const handleConfirm = () => {
    // Finalize configuration and notify parent
    onComplete(configAnswers)
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="ms-2 text-muted-foreground">
            {t('config.loading')}
          </span>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error || !template) {
    return (
      <Card className="max-w-2xl mx-auto border-destructive">
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">
            {t('config.error.loadFailed')}
          </p>
          <Button variant="outline" onClick={onCancel}>
            {t('config.cancel')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Parse error state
  if (!parsedTemplate) {
    return (
      <Card className="max-w-2xl mx-auto border-destructive">
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">
            {t('config.error.parseFailed')}
          </p>
          <Button variant="outline" onClick={onCancel}>
            {t('config.cancel')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const currentQuestion = parsedTemplate.configurationFlow[currentQuestionIndex]
  const totalQuestions = parsedTemplate.configurationFlow.length

  // Summary screen
  if (showSummary) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{t('config.summary.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('config.summary.description')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {parsedTemplate.configurationFlow.map(q => {
            const answer = configAnswers[q.id]
            let displayValue: string

            if (Array.isArray(answer)) {
              displayValue = answer.join(', ')
            } else if (typeof answer === 'boolean') {
              displayValue = answer ? t('common.yes') : t('common.no')
            } else if (answer !== undefined && answer !== null) {
              displayValue = String(answer)
            } else {
              displayValue = t('config.summary.notAnswered')
            }

            return (
              <div
                key={q.id}
                className="border-b border-border pb-3 last:border-0"
              >
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {q.question}
                </p>
                <p className="text-base">{displayValue}</p>
              </div>
            )
          })}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowSummary(false)}
              className="flex-1"
            >
              {t('config.summary.back')}
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              {t('config.summary.confirm')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Question screen
  if (!currentQuestion) {
    return null
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{template.name}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {t('config.progress', {
              current: currentQuestionIndex + 1,
              total: totalQuestions,
            })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ConfigQuestion
          question={currentQuestion}
          value={configAnswers[currentQuestion.id]}
          onChange={value => updateConfigAnswer(currentQuestion.id, value)}
          onValidationChange={handleValidationChange}
        />

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {t('config.cancel')}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!isCurrentValid}
            className="flex-1"
          >
            {currentQuestionIndex === totalQuestions - 1
              ? t('config.review')
              : t('config.next')}
          </Button>
        </div>

        {currentError && !isCurrentValid && (
          <p className="text-sm text-muted-foreground text-center">
            {t('config.fixErrorToContinue')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
