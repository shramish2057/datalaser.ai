'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useTranslations, useLocale } from 'next-intl'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { smartFormat } from '@/lib/formatNumber'

interface TopInsight {
  type: string
  headline: string
  columns: string[]
  p_value: number
  effect_size: number
  source_name: string
}

interface TrendEntry {
  measure_column: string
  direction: 'increasing' | 'decreasing' | 'flat'
  total_change_pct: number
  significant: boolean
}

interface MajorityEntry {
  dimension: string
  measure: string
  dominant_category: string
  dominant_share: number
}

interface SegmentEntry {
  dimension: string
  measure: string
  eta_squared: number
  effect_size: string
}

interface KPIRow {
  label: string
  value: string
  color: string
  direction?: 'up' | 'down' | 'flat'
  changePct?: number
}

interface KeyKPIsCardProps {
  insights: TopInsight[]
  trends: TrendEntry[]
  majority?: MajorityEntry[]
  segments?: SegmentEntry[]
}

export function KeyKPIsCard({ insights, trends, majority = [], segments = [] }: KeyKPIsCardProps) {
  const t = useTranslations()
  const locale = useLocale()

  const kpiRows: KPIRow[] = []

  // Extract KPIs from trends (most impactful first)
  for (const trend of trends.slice(0, 2)) {
    const dir = trend.direction === 'increasing' ? 'up' : trend.direction === 'decreasing' ? 'down' : 'flat'
    kpiRows.push({
      label: trend.measure_column,
      value: `${trend.total_change_pct > 0 ? '+' : ''}${smartFormat(trend.total_change_pct, locale)}%`,
      color: dir === 'up' ? 'bg-emerald-400' : dir === 'down' ? 'bg-red-400' : 'bg-gray-400',
      direction: dir,
      changePct: trend.total_change_pct,
    })
  }

  // Extract from majority (dominant share)
  for (const maj of majority.slice(0, 1)) {
    if (kpiRows.length >= 4) break
    kpiRows.push({
      label: `${maj.dominant_category} (${maj.measure})`,
      value: `${smartFormat(maj.dominant_share, locale)}%`,
      color: 'bg-amber-400',
    })
  }

  // Extract from segments (effect size)
  for (const seg of segments.slice(0, 1)) {
    if (kpiRows.length >= 4) break
    kpiRows.push({
      label: `${seg.measure} ${t('overview.by')} ${seg.dimension}`,
      value: seg.effect_size,
      color: 'bg-purple-400',
    })
  }

  // Fill remaining from insights
  for (const ins of insights) {
    if (kpiRows.length >= 4) break
    // Avoid duplicates
    const alreadyShown = kpiRows.some(k => k.label.includes(ins.columns[0] || ''))
    if (alreadyShown) continue
    kpiRows.push({
      label: ins.columns.join(', '),
      value: ins.type,
      color: ins.effect_size > 0.5 ? 'bg-red-400' : ins.effect_size > 0.2 ? 'bg-amber-400' : 'bg-blue-400',
    })
  }

  if (kpiRows.length === 0) {
    return (
      <Card className="border-dl-border bg-white">
        <CardContent className="p-5">
          <p className="text-dl-xs font-medium text-dl-text-light uppercase tracking-wider mb-3">
            {t('overview.keyMetrics')}
          </p>
          <p className="text-dl-sm text-dl-text-light">
            {t('overview.noMetricsYet')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-dl-border bg-white">
      <CardContent className="p-5">
        <p className="text-dl-xs font-medium text-dl-text-light uppercase tracking-wider mb-4">
          {t('overview.keyMetrics')}
        </p>
        <div className="space-y-3">
          {kpiRows.map((kpi, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${kpi.color}`} />
              <span className="text-dl-sm text-dl-text-dark flex-1 min-w-0 truncate">
                {kpi.label}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-dl-sm font-semibold text-dl-text-dark tabular-nums">
                  {kpi.value}
                </span>
                {kpi.direction && (
                  <span className={`flex-shrink-0 ${
                    kpi.direction === 'up' ? 'text-emerald-600' : kpi.direction === 'down' ? 'text-red-600' : 'text-dl-text-light'
                  }`}>
                    {kpi.direction === 'up' ? <TrendingUp size={13} /> :
                     kpi.direction === 'down' ? <TrendingDown size={13} /> :
                     <Minus size={13} />}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
