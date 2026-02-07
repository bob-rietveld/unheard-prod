import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { VanWestendorpResults } from '@/lib/modal-client'

interface VanWestendorpChartProps {
  data: VanWestendorpResults
}

const CHART_W = 400
const CHART_H = 220
const PAD = { top: 16, right: 16, bottom: 32, left: 40 }
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

const CURVES = [
  { key: 'too_cheap', color: '#3b82f6', label: 'tooCheap' },
  { key: 'bargain', color: '#22c55e', label: 'bargain' },
  { key: 'expensive', color: '#f97316', label: 'expensive' },
  { key: 'too_expensive', color: '#ef4444', label: 'tooExpensive' },
] as const

type CurveKey = (typeof CURVES)[number]['key']

function buildPath(
  points: { price: number; value: number }[],
  minPrice: number,
  maxPrice: number,
): string {
  if (points.length === 0) return ''

  const priceRange = maxPrice - minPrice || 1

  return points
    .map((p, i) => {
      const x = PAD.left + ((p.price - minPrice) / priceRange) * INNER_W
      const y = PAD.top + (1 - p.value) * INNER_H
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function formatPrice(value: number | null): string {
  if (value == null) return '--'
  return `$${value.toFixed(0)}`
}

export function VanWestendorpChart({ data }: VanWestendorpChartProps) {
  const { t } = useTranslation()
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null)

  const cumulativeData = data.cumulative_data
  if (!cumulativeData || cumulativeData.length === 0) return null

  const prices = cumulativeData.map(d => d.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 1

  // Build points for each curve
  const curvePoints: Record<CurveKey, { price: number; value: number }[]> = {
    too_cheap: cumulativeData.map(d => ({ price: d.price, value: d.too_cheap })),
    bargain: cumulativeData.map(d => ({ price: d.price, value: d.bargain })),
    expensive: cumulativeData.map(d => ({ price: d.price, value: d.expensive })),
    too_expensive: cumulativeData.map(d => ({ price: d.price, value: d.too_expensive })),
  }

  // Key intersection points
  const opp = data.optimal_price_point
  const ipp = data.indifference_price_point
  const pmc = data.point_of_marginal_cheapness
  const pme = data.point_of_marginal_expensiveness
  const rangeLow = data.acceptable_price_range.low
  const rangeHigh = data.acceptable_price_range.high

  // Convert price to x coordinate
  const priceToX = (p: number) => PAD.left + ((p - minPrice) / priceRange) * INNER_W

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  // X-axis ticks (5 evenly spaced price points)
  const xTickCount = 5
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    minPrice + (priceRange / (xTickCount - 1)) * i
  )

  const archetypeNames = Object.keys(data.by_archetype)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {t('results.vanWestendorp.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SVG Chart */}
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full"
          role="img"
          aria-label={t('results.vanWestendorp.title')}
        >
          {/* Grid lines */}
          {yTicks.map(tick => {
            const y = PAD.top + (1 - tick) * INNER_H
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + INNER_W}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontSize={9}
                >
                  {Math.round(tick * 100)}%
                </text>
              </g>
            )
          })}

          {/* X-axis labels */}
          {xTicks.map(tick => {
            const x = priceToX(tick)
            return (
              <text
                key={tick}
                x={x}
                y={CHART_H - 4}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                ${tick.toFixed(0)}
              </text>
            )
          })}

          {/* Acceptable range shading */}
          {rangeLow != null && rangeHigh != null && (
            <rect
              x={priceToX(rangeLow)}
              y={PAD.top}
              width={priceToX(rangeHigh) - priceToX(rangeLow)}
              height={INNER_H}
              fill="currentColor"
              fillOpacity={0.04}
            />
          )}

          {/* Curves */}
          {CURVES.map(curve => (
            <path
              key={curve.key}
              d={buildPath(curvePoints[curve.key], minPrice, maxPrice)}
              fill="none"
              stroke={curve.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Intersection markers */}
          {opp != null && (
            <g>
              <line
                x1={priceToX(opp)}
                y1={PAD.top}
                x2={priceToX(opp)}
                y2={PAD.top + INNER_H}
                stroke="#8b5cf6"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              <text
                x={priceToX(opp)}
                y={PAD.top - 4}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={8}
                fontWeight={600}
              >
                OPP
              </text>
            </g>
          )}
          {ipp != null && (
            <g>
              <line
                x1={priceToX(ipp)}
                y1={PAD.top}
                x2={priceToX(ipp)}
                y2={PAD.top + INNER_H}
                stroke="#6366f1"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={priceToX(ipp)}
                y={PAD.top - 4}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={8}
              >
                IPP
              </text>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {CURVES.map(curve => (
            <span key={curve.key} className="flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: curve.color }}
              />
              {t(`results.vanWestendorp.${curve.label}`)}
            </span>
          ))}
        </div>

        {/* Key price points */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t('results.vanWestendorp.optimalPrice')}
            </span>
            <span className="font-semibold tabular-nums">{formatPrice(opp)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t('results.vanWestendorp.indifferencePrice')}
            </span>
            <span className="font-semibold tabular-nums">{formatPrice(ipp)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t('results.vanWestendorp.acceptableRange')}
            </span>
            <span className="font-semibold tabular-nums">
              {formatPrice(rangeLow)} - {formatPrice(rangeHigh)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              PMC / PME
            </span>
            <span className="font-semibold tabular-nums">
              {formatPrice(pmc)} / {formatPrice(pme)}
            </span>
          </div>
        </div>

        {/* Per-archetype toggle */}
        {archetypeNames.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('results.vanWestendorp.byArchetype')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {archetypeNames.map(name => (
                <Button
                  key={name}
                  variant={selectedArchetype === name ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() =>
                    setSelectedArchetype(prev => (prev === name ? null : name))
                  }
                >
                  {name}
                </Button>
              ))}
            </div>
            {(() => {
              const archetypeData = selectedArchetype
                ? data.by_archetype[selectedArchetype]
                : undefined
              if (!archetypeData) return null
              return (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">OPP:</span>{' '}
                    <span className="font-medium tabular-nums">
                      {formatPrice(archetypeData.opp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IPP:</span>{' '}
                    <span className="font-medium tabular-nums">
                      {formatPrice(archetypeData.ipp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PMC:</span>{' '}
                    <span className="font-medium tabular-nums">
                      {formatPrice(archetypeData.pmc)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PME:</span>{' '}
                    <span className="font-medium tabular-nums">
                      {formatPrice(archetypeData.pme)}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
