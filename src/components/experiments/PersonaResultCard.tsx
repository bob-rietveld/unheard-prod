import { useState } from 'react'
import { ChevronDown, ChevronUp, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SentimentBadge } from './SentimentBadge'
import { cn } from '@/lib/utils'
import type { PersonaResult } from '@/store/experiment-store'

interface PersonaResultCardProps {
  result: PersonaResult
}

export function PersonaResultCard({ result }: PersonaResultCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-3">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-sm truncate">{result.name}</span>
            <span className="text-xs text-muted-foreground truncate">
              {result.archetype}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SentimentBadge sentiment={result.sentiment} size="sm" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            expanded ? 'max-h-96' : 'max-h-0'
          )}
        >
          <p className="text-sm text-muted-foreground pt-2 border-t border-border whitespace-pre-wrap">
            {result.response}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
