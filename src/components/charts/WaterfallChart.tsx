'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { chartTheme } from '@/lib/chartTheme'

type Props = {
  data: { name: string; value: number }[]
  title?: string
}

export function WaterfallChart({ data }: Props) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-dl-text-light text-dl-sm py-4 text-center">No data</div>
  }

  // Build waterfall: invisible base + visible delta
  let cumulative = 0
  const waterData = data.map((d, i) => {
    const isTotal = i === data.length - 1 && d.name.toLowerCase().includes('total')
    const base = isTotal ? 0 : Math.min(cumulative, cumulative + d.value)
    const delta = isTotal ? cumulative + d.value : Math.abs(d.value)
    if (!isTotal) cumulative += d.value
    return {
      name: d.name,
      _base: base,
      _delta: delta,
      _value: d.value,
      _positive: d.value >= 0,
      _isTotal: isTotal,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={waterData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid {...chartTheme.cartesianGrid} vertical={false} />
        <XAxis dataKey="name" {...chartTheme.xAxis} tick={{ fontSize: 10 }}
          interval={0} angle={data.length > 6 ? -30 : 0}
          textAnchor={data.length > 6 ? 'end' : 'middle'}
          height={data.length > 6 ? 60 : 30} />
        <YAxis {...chartTheme.yAxis} tick={{ fontSize: 10 }} />
        <Tooltip
          {...chartTheme.tooltip}
          formatter={(value, name) => {
            if (name === '_base') return [null, null]
            return [Number(value).toLocaleString(), 'Value']
          }}
          content={({ active, payload }) => {
            if (!active || !payload?.[1]) return null
            const d = payload[1].payload
            return (
              <div style={{ ...chartTheme.tooltip.contentStyle, padding: '8px 12px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: 2 }}>{d.name}</p>
                <p>{d._isTotal ? 'Total' : d._positive ? '+' : ''}{d._value.toLocaleString()}</p>
              </div>
            )
          }}
        />
        {/* Invisible base */}
        <Bar dataKey="_base" stackId="w" fill="transparent" />
        {/* Visible delta */}
        <Bar dataKey="_delta" stackId="w" radius={[3, 3, 0, 0]}>
          {waterData.map((d, i) => (
            <Cell key={i} fill={d._isTotal ? '#4A9EDA' : d._positive ? '#84BB4C' : '#ED6E6E'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
