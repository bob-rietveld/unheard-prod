import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import type { PersonaResult } from '@/store/experiment-store'
import type { ExperimentInsights } from '@/lib/modal-client'

interface ExportButtonProps {
  personaResults: PersonaResult[]
  insights: ExperimentInsights | null
}

function generateMarkdownSummary(
  results: PersonaResult[],
  insights: ExperimentInsights | null,
): string {
  const lines: string[] = ['# Experiment Results\n']

  // Sentiment summary
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

  const avg = results.length > 0 ? totalSentiment / results.length : 0
  lines.push(`## Sentiment Overview\n`)
  lines.push(`- **Respondents**: ${results.length}`)
  lines.push(`- **Average Sentiment**: ${avg.toFixed(2)}`)
  lines.push(`- **Positive**: ${positive} | **Neutral**: ${neutral} | **Negative**: ${negative}\n`)

  // Insights
  if (insights) {
    if (insights.themes.length > 0) {
      lines.push(`## Key Themes\n`)
      for (const theme of insights.themes) {
        lines.push(`- **${theme.theme}** (${theme.count})`)
      }
      lines.push('')
    }

    if (insights.recommendations.length > 0) {
      lines.push(`## Recommendations\n`)
      insights.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`)
      })
      lines.push('')
    }

    if (insights.concerns.length > 0) {
      lines.push(`## Concerns\n`)
      for (const c of insights.concerns) {
        lines.push(`- ${c.concern} (frequency: ${c.frequency})`)
      }
      lines.push('')
    }

    if (insights.van_westendorp) {
      const vw = insights.van_westendorp
      lines.push(`## Van Westendorp Price Analysis\n`)
      lines.push(`- **Optimal Price Point**: $${vw.optimal_price_point ?? '--'}`)
      lines.push(`- **Indifference Price Point**: $${vw.indifference_price_point ?? '--'}`)
      lines.push(`- **Acceptable Range**: $${vw.acceptable_price_range.low ?? '--'} - $${vw.acceptable_price_range.high ?? '--'}`)
      lines.push('')
    }
  }

  // Individual responses
  lines.push(`## Individual Responses\n`)
  for (const r of results) {
    lines.push(`### ${r.name} (${r.archetype}) - Sentiment: ${r.sentiment.toFixed(2)}\n`)
    lines.push(`${r.response}\n`)
  }

  return lines.join('\n')
}

export function ExportButton({
  personaResults,
  insights,
}: ExportButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopyClipboard = async () => {
    const markdown = generateMarkdownSummary(personaResults, insights)
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      toast.success(t('results.export.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('Failed to copy to clipboard', { error: err })
      toast.error(t('results.export.copyFailed'))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <Download className="size-3" />
          {t('results.export.title')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyClipboard}>
          {copied ? <Check className="size-3.5 me-2" /> : <Copy className="size-3.5 me-2" />}
          {t('results.export.clipboard')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
