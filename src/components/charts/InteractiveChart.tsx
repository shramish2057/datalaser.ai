'use client'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { chartTheme } from '@/lib/chartTheme'
import { useState } from 'react'
import { Download, Maximize2, Pin } from 'lucide-react'

export type ChartData = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'stacked_bar' | 'funnel' | 'table'
  title: string
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  yKeys?: string[]
  colors?: string[]
}

const MB_COLORS = ['#509EE3','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

export function InteractiveChart({ chart, onPin }: { chart: ChartData; onPin?: () => void }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const colors = chart.colors ?? MB_COLORS

  const commonProps = {
    data: chart.data,
    margin: { top: 8, right: 16, left: 0, bottom: 8 }
  }

  const axisProps = {
    xAxis: <XAxis dataKey={chart.xKey} {...chartTheme.xAxis} />,
    yAxis: <YAxis {...chartTheme.yAxis} />,
    grid: <CartesianGrid {...chartTheme.cartesianGrid} />,
    tooltip: <Tooltip {...chartTheme.tooltip} />,
    legend: <Legend wrapperStyle={{ fontSize: '11px', color: '#74838F' }} />,
  }

  const renderChart = () => {
    switch (chart.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            <Bar dataKey={chart.yKey} fill={colors[0]} radius={[3,3,0,0]}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}>
              {chart.data.map((_, i) => (
                <Cell key={i} fill={activeIndex === i ? colors[1] : colors[0]} />
              ))}
            </Bar>
          </BarChart>
        )

      case 'stacked_bar':
        return (
          <BarChart {...commonProps}>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            {(chart.yKeys ?? [chart.yKey]).map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={colors[i % colors.length]} radius={i === (chart.yKeys?.length ?? 1) - 1 ? [3,3,0,0] : [0,0,0,0]} />
            ))}
          </BarChart>
        )

      case 'line':
        return (
          <LineChart {...commonProps}>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            <Line type="monotone" dataKey={chart.yKey} stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0], r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[0]} stopOpacity={0.2} />
                <stop offset="95%" stopColor={colors[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            <Area type="monotone" dataKey={chart.yKey} stroke={colors[0]} strokeWidth={2} fill="url(#areaGrad)" />
          </AreaChart>
        )

      case 'pie':
      case 'donut':
        return (
          <PieChart>
            <Pie
              data={chart.data} dataKey={chart.yKey} nameKey={chart.xKey}
              cx="50%" cy="50%"
              innerRadius={chart.type === 'donut' ? '55%' : 0}
              outerRadius="75%"
              paddingAngle={2}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chart.data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.6} />
              ))}
            </Pie>
            <Tooltip {...chartTheme.tooltip} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#74838F' }} />
          </PieChart>
        )

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {axisProps.grid}
            <XAxis dataKey={chart.xKey} {...chartTheme.xAxis} name={chart.xKey} />
            <YAxis dataKey={chart.yKey} {...chartTheme.yAxis} name={chart.yKey} />
            {axisProps.tooltip}
            <Scatter data={chart.data} fill={colors[0]} />
          </ScatterChart>
        )

      case 'table': {
        const cols = Object.keys(chart.data[0] ?? {})
        return (
          <div className="overflow-auto max-h-64">
            <table className="w-full text-mb-xs">
              <thead>
                <tr className="border-b border-mb-border">
                  {cols.map(c => (
                    <th key={c} className="px-3 py-2 text-left font-bold text-mb-text-light uppercase tracking-wider">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.data.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-mb-border hover:bg-mb-bg-light">
                    {cols.map(c => (
                      <td key={c} className="px-3 py-1.5 text-mb-text-dark">{String(row[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="rounded-mb-lg border border-mb-border bg-mb-bg overflow-hidden shadow-mb-sm">
      {/* Chart header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mb-border">
        <span className="text-mb-sm font-bold text-mb-text-dark">{chart.title}</span>
        <div className="flex items-center gap-1">
          {onPin && (
            <button onClick={onPin} className="mb-btn-subtle p-1.5 rounded-mb-sm" title="Pin to Dashboard">
              <Pin size={13} />
            </button>
          )}
          <button className="mb-btn-subtle p-1.5 rounded-mb-sm" title="Download">
            <Download size={13} />
          </button>
          <button className="mb-btn-subtle p-1.5 rounded-mb-sm" title="Expand">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Chart body */}
      <div className="p-4">
        {chart.type === 'table' ? renderChart() : (
          <ResponsiveContainer width="100%" height={280}>
            {renderChart() as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
