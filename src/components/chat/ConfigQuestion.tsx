/**
 * ConfigQuestion component renders a single configuration question
 * based on its type (text, select, number, boolean, etc.).
 *
 * Handles real-time validation and displays error messages inline.
 * Used by ConfigWizard for sequential question flow.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { TemplateQuestion } from '@/types/template'
import { validateAnswer } from '@/lib/config-validator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'

interface ConfigQuestionProps {
  question: TemplateQuestion
  value: unknown
  onChange: (value: unknown) => void
  onValidationChange: (isValid: boolean, error?: string) => void
}

export function ConfigQuestion({
  question,
  value,
  onChange,
  onValidationChange,
}: ConfigQuestionProps) {
  const { t } = useTranslation()
  const [localValue, setLocalValue] = useState(value)
  const [error, setError] = useState<string>()

  // Validate on value change
  useEffect(() => {
    const validationResult = validateAnswer(question, localValue)
    setError(validationResult.error)
    onValidationChange(validationResult.isValid, validationResult.error)
  }, [localValue, question, onValidationChange])

  // Initialize with default value if not set
  useEffect(() => {
    if (
      (value === undefined || value === null) &&
      question.default !== undefined
    ) {
      const defaultValue = question.default
      setLocalValue(defaultValue)
      onChange(defaultValue)
    }
  }, [question.default, value, onChange])

  const handleChange = (newValue: unknown) => {
    setLocalValue(newValue)
    onChange(newValue)
  }

  // Render different input types
  switch (question.type) {
    case 'text':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={question.id}
            type="text"
            value={(localValue as string) || ''}
            onChange={e => handleChange(e.target.value)}
            placeholder={question.placeholder}
            maxLength={question.maxLength}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${question.id}-error` : undefined}
          />
          {error && (
            <p
              id={`${question.id}-error`}
              className="text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          {question.maxLength && (
            <p className="text-xs text-muted-foreground text-end">
              {((localValue as string)?.length || 0)} / {question.maxLength}
            </p>
          )}
        </div>
      )

    case 'textarea':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Textarea
            id={question.id}
            value={(localValue as string) || ''}
            onChange={e => handleChange(e.target.value)}
            placeholder={question.placeholder}
            maxLength={question.maxLength}
            rows={4}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${question.id}-error` : undefined}
          />
          {error && (
            <p
              id={`${question.id}-error`}
              className="text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          {question.maxLength && (
            <p className="text-xs text-muted-foreground text-end">
              {((localValue as string)?.length || 0)} / {question.maxLength}
            </p>
          )}
        </div>
      )

    case 'select':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select
            value={(localValue as string) || ''}
            onValueChange={handleChange}
          >
            <SelectTrigger
              id={question.id}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? `${question.id}-error` : undefined}
            >
              <SelectValue
                placeholder={question.placeholder || t('config.selectPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map(opt => {
                const optValue = typeof opt === 'string' ? opt : opt.value
                const optLabel = typeof opt === 'string' ? opt : opt.label
                return (
                  <SelectItem key={optValue} value={optValue}>
                    {optLabel}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {error && (
            <p
              id={`${question.id}-error`}
              className="text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )

    case 'multiselect':
      return (
        <div className="space-y-2">
          <Label>
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className="space-y-2">
            {question.options?.map(opt => {
              const optValue = typeof opt === 'string' ? opt : opt.value
              const optLabel = typeof opt === 'string' ? opt : opt.label
              const checked = ((localValue as string[]) || []).includes(optValue)

              return (
                <div key={optValue} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${optValue}`}
                    checked={checked}
                    onCheckedChange={isChecked => {
                      const currentValues = (localValue as string[]) || []
                      const newValues = isChecked
                        ? [...currentValues, optValue]
                        : currentValues.filter(v => v !== optValue)
                      handleChange(newValues)
                    }}
                  />
                  <Label
                    htmlFor={`${question.id}-${optValue}`}
                    className="font-normal cursor-pointer"
                  >
                    {optLabel}
                  </Label>
                </div>
              )
            })}
          </div>
          {error && (
            <p
              id={`${question.id}-error`}
              className="text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )

    case 'number':
      return (
        <div className="space-y-2">
          <Label htmlFor={question.id}>
            {question.question}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={question.id}
              type="number"
              value={localValue === undefined ? '' : String(localValue)}
              onChange={e => {
                const val = e.target.value
                handleChange(val === '' ? undefined : Number(val))
              }}
              placeholder={question.placeholder}
              min={question.min}
              max={question.max}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? `${question.id}-error` : undefined}
            />
            {question.unit && (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {question.unit}
              </span>
            )}
          </div>
          {error && (
            <p
              id={`${question.id}-error`}
              className="text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          {(question.min !== undefined || question.max !== undefined) && (
            <p className="text-xs text-muted-foreground">
              {question.min !== undefined && question.max !== undefined
                ? `Range: ${question.min} - ${question.max}`
                : question.min !== undefined
                  ? `Minimum: ${question.min}`
                  : `Maximum: ${question.max}`}
            </p>
          )}
        </div>
      )

    case 'boolean':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={question.id} className="flex-1">
              {question.question}
              {question.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Switch
              id={question.id}
              checked={(localValue as boolean) || false}
              onCheckedChange={handleChange}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? `${question.id}-error` : undefined}
            />
          </div>
          {error && (
            <p
              id={`${question.id}-error`}
              className="text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )

    default:
      return (
        <div className="text-destructive">
          {t('config.unsupportedType', { type: question.type })}
        </div>
      )
  }
}
