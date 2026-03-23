'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { chartTheme } from '@/lib/chartTheme'

type Props = {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  title?: string
  color?: string
}

export function HistogramChart({ data, xKey, yKey, color = '#4A9EDA' }: Props) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-mb-text-light text-mb-sm py-4 text-center">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }} barCategoryGap={0} barGap={0}>
        <defs>
          <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.9} />
            <stop offset="95%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid {...chartTheme.cartesianGrid} vertical={false} />
        <XAxis dataKey={xKey} {...chartTheme.xAxis} tick={{ fontSize: 10 }} />
        <YAxis {...chartTheme.yAxis} tick={{ fontSize: 10 }} />
        <Tooltip
          {...chartTheme.tooltip}
          formatter={(value) => [Number(value).toLocaleString(), 'Count']}
          labelFormatter={(label) => `Bin: ${label}`}
        />
        <Bar dataKey={yKey} fill="url(#histGrad)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
