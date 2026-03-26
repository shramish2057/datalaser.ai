'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useTranslations, useLocale } from 'next-intl'
import { translateFinding } from '@/lib/i18n/findingsMap'
import Link from 'next/link'
import {
  TrendingUp, AlertTriangle, GitBranch, BarChart3,
  PieChart, Layers, Lightbulb, type LucideIcon,
} from 'lucide-react'

interface TopInsight {
  type: string
  headline: string
  columns: string[]
  p_value: number
  effect_size: number
  source_name: string
  source_id?: string
}

interface TopFindingsCardProps {
  insights: TopInsight[]
  basePath: string
}

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  trend: TrendingUp,
  anomaly: AlertTriangle,
  correlation: GitBranch,
  distribution: BarChart3,
  majority: PieChart,
  group_difference: Layers,
  contribution: BarChart3,
  forecast: TrendingUp,
  change_point: TrendingUp,
  key_influencer: Lightbulb,
  association: GitBranch,
  clustering: Layers,
  outlier_explanation: AlertTriangle,
  leading_indicator: TrendingUp,
  temporal_pattern: TrendingUp,
  seasonality: TrendingUp,
}

function getSeverityBadge(effectSize: number): { label: string; className: string } {
  if (effectSize > 0.5) {
    return { label: 'high', className: 'bg-red-100 text-red-700' }
  }
  if (effectSize > 0.2) {
    return { label: 'medium', className: 'bg-amber-100 text-amber-700' }
  }
  return { label: 'info', className: 'bg-blue-100 text-blue-700' }
}

export function TopFindingsCard({ insights, basePath }: TopFindingsCardProps) {
  const t = useTranslations()
  const locale = useLocale()

  const topFindings = insights.slice(0, 3)

  if (topFindings.length === 0) {
    return (
      <Card className="border-dl-border bg-white">
        <CardContent className="p-5">
          <p className="text-dl-xs font-medium text-dl-text-light uppercase tracking-wider mb-3">
            {t('overview.topFindings')}
          </p>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-dl-bg-medium flex items-center justify-center mb-3">
              <Lightbulb size={18} className="text-dl-text-light" />
            </div>
            <p className="text-dl-sm text-dl-text-light">
              {t('overview.runAnalysisToSee')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-dl-border bg-white">
      <CardContent className="p-5">
        <p className="text-dl-xs font-medium text-dl-text-light uppercase tracking-wider mb-4">
          {t('overview.topFindings')}
        </p>
        <div className="space-y-3">
          {topFindings.map((finding, i) => {
            const Icon = TYPE_ICON_MAP[finding.type] || Lightbulb
            const severity = getSeverityBadge(finding.effect_size)
            const href = finding.source_id
              ? `${basePath}/sources/${finding.source_id}/analysis`
              : `${basePath}/insights`

            return (
              <Link
                key={i}
                href={href}
                className="flex items-start gap-3 p-2.5 -mx-2.5 rounded-dl-md hover:bg-dl-bg-light transition-colors group"
              >
                <div className="w-7 h-7 rounded-dl-md bg-dl-bg-medium flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-dl-brand group-hover:text-white transition-colors">
                  <Icon size={14} className="text-dl-text-light group-hover:text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-dl-sm text-dl-text-dark leading-snug line-clamp-2">
                    {translateFinding(finding.headline, locale)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-dl-text-light">
                      {finding.source_name}
                    </span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${severity.className}`}>
                      {t(`overview.severity.${severity.label}`)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
