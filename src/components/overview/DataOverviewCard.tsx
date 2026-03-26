'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useTranslations, useLocale } from 'next-intl'
import { Database, Hash, Bell, Clock } from 'lucide-react'
import { smartFormat, formatRelativeTime } from '@/lib/formatNumber'
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell } from 'recharts'

interface SourceInfo {
  id: string
  name: string
  row_count: number
  updated_at?: string
  created_at?: string
}

interface ContributionBreakdown {
  category: string
  value: number
  pct: number
  count: number
}

interface ContributionEntry {
  measure: string
  dimension: string
  total: number
  top_contributor: string
  top_contribution_pct: number
  breakdown: ContributionBreakdown[]
}

interface DataOverviewCardProps {
  sources: SourceInfo[]
  totalRecords: number
  alertCount: number
  contribution: ContributionEntry | null
  lastAnalyzedAt?: string | null
}

const BAR_COLORS = ['#191919', '#4A9EDA', '#84BB4C', '#F9CF48', '#ED6E6E']

export function DataOverviewCard({
  sources,
  totalRecords,
  alertCount,
  contribution,
  lastAnalyzedAt,
}: DataOverviewCardProps) {
  const t = useTranslations()
  const locale = useLocale()

  const chartData = contribution?.breakdown?.slice(0, 5).map(b => ({
    name: b.category,
    value: b.pct,
  })) ?? []

  const hasChart = chartData.length > 0

  const stats = [
    {
      icon: Database,
      label: t('overview.stats.sources'),
      value: String(sources.length),
      accent: false,
    },
    {
      icon: Hash,
      label: t('overview.stats.records'),
      value: smartFormat(totalRecords, locale),
      accent: false,
    },
    {
      icon: Bell,
      label: t('overview.stats.alerts'),
      value: String(alertCount),
      accent: alertCount > 0,
    },
    {
      icon: Clock,
      label: t('overview.stats.lastAnalyzed'),
      value: lastAnalyzedAt ? formatRelativeTime(lastAnalyzedAt, locale) : t('overview.stats.never'),
      accent: false,
    },
  ]

  return (
    <Card className="border-dl-border bg-white">
      <CardContent className="p-5">
        <p className="text-dl-xs font-medium text-dl-text-light uppercase tracking-wider mb-4">
          {t('overview.dataOverview')}
        </p>

        <div className={`flex gap-5 ${hasChart ? '' : ''}`}>
          {/* Stats grid */}
          <div className={`grid grid-cols-2 gap-3 ${hasChart ? 'flex-1' : 'w-full'}`}>
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-dl-md flex items-center justify-center flex-shrink-0 ${
                  stat.accent ? 'bg-red-100' : 'bg-dl-bg-medium'
                }`}>
                  <stat.icon size={14} className={stat.accent ? 'text-red-600' : 'text-dl-text-light'} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-dl-text-light truncate">
                    {stat.label}
                  </p>
                  <p className={`text-dl-sm font-semibold tabular-nums truncate ${
                    stat.accent ? 'text-red-600' : 'text-dl-text-dark'
                  }`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          {hasChart && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-dl-text-light mb-1.5 truncate">
                {contribution?.dimension}
              </p>
              <div className="h-[90px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  >
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#2E353B',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontFamily: 'Lato',
                      }}
                      formatter={(value) => [`${value}%`, t('overview.contribution')]}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 3, 3, 0]}
                      barSize={12}
                    >
                      {chartData.map((_, index) => (
                        <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {chartData.slice(0, 3).map((d, i) => (
                  <span key={i} className="text-[10px] text-dl-text-light flex items-center gap-1">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
