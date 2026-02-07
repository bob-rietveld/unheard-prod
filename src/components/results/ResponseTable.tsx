import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SentimentBadge } from '@/components/experiments/SentimentBadge'
import { cn } from '@/lib/utils'
import type { PersonaResult } from '@/store/experiment-store'

interface ResponseTableProps {
  results: PersonaResult[]
}

type SortField = 'name' | 'archetype' | 'sentiment'
type SortDir = 'asc' | 'desc'

export function ResponseTable({ results }: ResponseTableProps) {
  const { t } = useTranslation()
  const [filterArchetype, setFilterArchetype] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('sentiment')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Unique archetypes
  const archetypes = [...new Set(results.map(r => r.archetype))]

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Filter and sort
  let filtered = filterArchetype
    ? results.filter(r => r.archetype === filterArchetype)
    : results

  filtered = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortField === 'sentiment') return (a.sentiment - b.sentiment) * mul
    if (sortField === 'name') return a.name.localeCompare(b.name) * mul
    return a.archetype.localeCompare(b.archetype) * mul
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {t('results.responses.title')}
            <span className="ms-1.5 text-xs font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Archetype filter pills */}
        {archetypes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={filterArchetype === null ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setFilterArchetype(null)}
            >
              <Filter className="size-3 me-1" />
              {t('results.responses.all')}
            </Button>
            {archetypes.map(arch => (
              <Button
                key={arch}
                variant={filterArchetype === arch ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() =>
                  setFilterArchetype(prev => (prev === arch ? null : arch))
                }
              >
                {arch}
              </Button>
            ))}
          </div>
        )}

        {/* Sort controls */}
        <div className="flex gap-1 text-xs text-muted-foreground">
          {(['sentiment', 'name', 'archetype'] as const).map(field => (
            <Button
              key={field}
              variant="ghost"
              size="sm"
              className={cn(
                'h-5 text-[10px] px-1.5',
                sortField === field && 'text-foreground'
              )}
              onClick={() => handleSort(field)}
            >
              {t(`results.responses.sort.${field}`)}
              {sortField === field && (
                <span className="ms-0.5">
                  {sortDir === 'asc' ? '\u2191' : '\u2193'}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Results list */}
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {filtered.map(result => {
            const isExpanded = expandedId === result.personaId
            return (
              <div
                key={result.personaId}
                className="border border-border rounded-md px-2.5 py-1.5"
              >
                <button
                  className="w-full flex items-center justify-between gap-2 text-start"
                  onClick={() =>
                    setExpandedId(prev =>
                      prev === result.personaId ? null : result.personaId
                    )
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {result.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {result.archetype}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SentimentBadge sentiment={result.sentiment} size="sm" />
                    {isExpanded ? (
                      <ChevronUp className="size-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3 text-muted-foreground" />
                    )}
                  </div>
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    isExpanded ? 'max-h-96 mt-2' : 'max-h-0'
                  )}
                >
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 whitespace-pre-wrap">
                    {result.response}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
