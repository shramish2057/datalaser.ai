'use client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { chartTheme } from '@/lib/chartTheme'

const DL_COLORS = ['#191919', '#4A9EDA', '#84BB4C', '#F9CF48', '#ED6E6E', '#A989C5', '#F1B556']

type Props = {
  data: Record<string, unknown>[]
  xKey: string
  barKeys: string[]
  lineKeys: string[]
  title?: string
  colors?: string[]
}

export function ComboChart({ data, xKey, barKeys, lineKeys, colors = DL_COLORS }: Props) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-dl-text-light text-dl-sm py-4 text-center">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid {...chartTheme.cartesianGrid} />
        <XAxis dataKey={xKey} {...chartTheme.xAxis} tick={{ fontSize: 11 }}
          interval={0} angle={data.length > 6 ? -30 : 0}
          textAnchor={data.length > 6 ? 'end' : 'middle'}
          height={data.length > 6 ? 60 : 30} />
        <YAxis yAxisId="left" {...chartTheme.yAxis} tick={{ fontSize: 11 }} />
        {lineKeys.length > 0 && (
          <YAxis yAxisId="right" orientation="right" {...chartTheme.yAxis} tick={{ fontSize: 11 }} />
        )}
        <Tooltip {...chartTheme.tooltip} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#74838F' }} />
        {barKeys.map((key, i) => (
          <Bar key={key} yAxisId="left" dataKey={key} fill={colors[i % colors.length]}
            radius={[3, 3, 0, 0]} barSize={data.length > 10 ? undefined : 32} />
        ))}
        {lineKeys.map((key, i) => (
          <Line key={key} yAxisId="right" type="monotone" dataKey={key}
            stroke={colors[(barKeys.length + i) % colors.length]}
            strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
