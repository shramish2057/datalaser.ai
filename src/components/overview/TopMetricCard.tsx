'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useTranslations, useLocale } from 'next-intl'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { smartFormat } from '@/lib/formatNumber'

interface TrendEntry {
  date_column: string
  measure_column: string
  direction: 'increasing' | 'decreasing' | 'flat'
  slope: number
  r_squared: number
  p_value: number
  significant: boolean
  total_change_pct: number
  data_points: number
  change_points?: { index: number; shift_pct: number; direction: string }[]
  seasonality?: { lag: number; strength: number } | null
}

interface TopMetricCardProps {
  trends: TrendEntry[]
  measures: string[]
}

export function TopMetricCard({ trends, measures }: TopMetricCardProps) {
  const t = useTranslations()
  const locale = useLocale()

  // Find the trend with the highest absolute total_change_pct
  const topTrend = trends.length > 0
    ? trends.reduce((best, curr) =>
        Math.abs(curr.total_change_pct) > Math.abs(best.total_change_pct) ? curr : best
      , trends[0])
    : null

  if (!topTrend) {
    return (
      <Card className="border-dl-border bg-white">
        <CardContent className="p-5">
          <p className="text-dl-xs font-medium text-dl-text-light uppercase tracking-wider mb-3">
            {t('overview.topMetric')}
          </p>
          <p className="text-dl-sm text-dl-text-light">
            {t('overview.noTrendData')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const isUp = topTrend.direction === 'increasing'
  const isDown = topTrend.direction === 'decreasing'
  const changePct = Math.abs(topTrend.total_change_pct)
  const changeSign = isUp ? '+' : isDown ? '-' : ''

  // Background tint based on direction
  const bgTint = isUp
    ? 'bg-gradient-to-br from-emerald-50/60 to-white'
    : isDown
    ? 'bg-gradient-to-br from-red-50/60 to-white'
    : 'bg-white'

  const accentColor = isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-dl-text-light'
  const badgeBg = isUp ? 'bg-emerald-100' : isDown ? 'bg-red-100' : 'bg-gray-100'
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  // Build a simple sparkline from data points count + slope direction
  const sparkPoints = generateSparkline(topTrend)

  return (
    <Card className={`border-dl-border ${bgTint} overflow-hidden`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-dl-xs font-medium text-dl-text-light uppercase tracking-wider mb-1">
              {t('overview.topMetric')}
            </p>
            <p className="text-[11px] text-dl-text-medium truncate mb-3">
              {topTrend.measure_column}
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-dl-text-dark tabular-nums">
                {smartFormat(topTrend.slope * topTrend.data_points, locale)}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-dl-xs font-semibold ${badgeBg} ${accentColor}`}>
                <TrendIcon size={12} />
                {changeSign}{smartFormat(changePct, locale)}%
              </span>
            </div>
            <p className="text-[11px] text-dl-text-light mt-1.5">
              {t('overview.dataPoints', { count: topTrend.data_points })}
              {topTrend.significant && (
                <span className="ml-2 text-dl-brand font-medium">
                  {t('overview.statSignificant')}
                </span>
              )}
            </p>
          </div>

          {/* Mini sparkline SVG */}
          <div className="flex-shrink-0 ml-4 mt-2">
            <svg width="64" height="32" viewBox="0 0 64 32" className="opacity-60">
              <polyline
                points={sparkPoints}
                fill="none"
                stroke={isUp ? '#059669' : isDown ? '#DC2626' : '#9CA3AF'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Generate a simple sparkline polyline from trend direction.
 * Creates a visually representative curve.
 */
function generateSparkline(trend: TrendEntry): string {
  const points = 8
  const width = 64
  const height = 32
  const padding = 2

  const coords: string[] = []
  for (let i = 0; i < points; i++) {
    const x = padding + (i / (points - 1)) * (width - padding * 2)
    // Generate y based on trend direction with slight noise
    const progress = i / (points - 1)
    let yNorm: number
    if (trend.direction === 'increasing') {
      yNorm = 1 - progress * 0.7 - Math.sin(progress * Math.PI) * 0.15
    } else if (trend.direction === 'decreasing') {
      yNorm = 0.3 + progress * 0.5 + Math.sin(progress * Math.PI) * 0.1
    } else {
      yNorm = 0.5 + Math.sin(progress * Math.PI * 2) * 0.15
    }
    const y = padding + yNorm * (height - padding * 2)
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return coords.join(' ')
}
