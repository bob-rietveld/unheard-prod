import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SentimentBadgeProps {
  sentiment: number
  size?: 'sm' | 'md'
}

function getSentimentCategory(sentiment: number): 'positive' | 'neutral' | 'negative' {
  if (sentiment > 0.3) return 'positive'
  if (sentiment < -0.3) return 'negative'
  return 'neutral'
}

const sentimentStyles = {
  positive: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  neutral: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  negative: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
} as const

export function SentimentBadge({ sentiment, size = 'md' }: SentimentBadgeProps) {
  const { t } = useTranslation()
  const category = getSentimentCategory(sentiment)

  return (
    <Badge
      variant="outline"
      className={cn(
        sentimentStyles[category],
        size === 'sm' && 'text-[10px] px-1.5 py-0'
      )}
    >
      {t(`experiment.${category}`)}
    </Badge>
  )
}
