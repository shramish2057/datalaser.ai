'use client'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useLocale } from 'next-intl'
import { smartFormat } from '@/lib/formatNumber'

type Props = {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  unit?: string
  trend?: 'up' | 'down' | 'flat'
  size?: 'sm' | 'md' | 'lg'
  sparkline?: number[]
  sparklineColor?: string
}

export function KPICard({ label, value, delta, deltaLabel, unit = '', trend, size = 'md', sparkline, sparklineColor }: Props) {
  const locale = useLocale()
  const autoTrend = trend || (delta && delta > 0 ? 'up' : delta && delta < 0 ? 'down' : 'flat')
  const trendColor = autoTrend === 'up' ? 'text-green-600' : autoTrend === 'down' ? 'text-red-500' : 'text-mb-text-light'
  const trendBg = autoTrend === 'up' ? 'bg-green-50' : autoTrend === 'down' ? 'bg-red-50' : 'bg-mb-bg-light'

  const valueSizes = { sm: 'text-[18px]', md: 'text-[24px]', lg: 'text-[32px]' }
  const labelSizes = { sm: 'text-[10px]', md: 'text-[11px]', lg: 'text-[12px]' }

  const formattedValue = typeof value === 'number' ? smartFormat(value, locale) : value

  return (
    <div className="bg-white border border-mb-border rounded-mb-lg p-4 flex flex-col">
      <span className={`${labelSizes[size]} font-semibold uppercase tracking-wider text-mb-text-light mb-1`}>
        {label}
      </span>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={`${valueSizes[size]} font-black text-mb-text-dark leading-none`}>
              {formattedValue}
            </span>
            {unit && <span className="text-[12px] text-mb-text-light">{unit}</span>}
          </div>
          {delta !== undefined && (
            <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${trendBg} w-fit`}>
              {autoTrend === 'up' && <TrendingUp size={11} className={trendColor} />}
              {autoTrend === 'down' && <TrendingDown size={11} className={trendColor} />}
              {autoTrend === 'flat' && <Minus size={11} className={trendColor} />}
              <span className={`text-[11px] font-bold ${trendColor}`}>
                {delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(1) : delta}%
              </span>
              {deltaLabel && <span className="text-[10px] text-mb-text-light ml-0.5">{deltaLabel}</span>}
            </div>
          )}
        </div>
        {/* Sparkline */}
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={sparklineColor || (autoTrend === 'up' ? '#84BB4C' : autoTrend === 'down' ? '#ED6E6E' : '#4A9EDA')} />
        )}
      </div>
    </div>
  )
}

function Sparkline({ data, color, width = 80, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  // Gradient fill area
  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle cx={Number(points.split(' ').pop()?.split(',')[0])} cy={Number(points.split(' ').pop()?.split(',')[1])}
        r={2.5} fill={color} />
    </svg>
  )
}
