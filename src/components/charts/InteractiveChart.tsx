'use client'
import { useState, useRef, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  ComposedChart, FunnelChart, Funnel, LabelList,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { chartTheme } from '@/lib/chartTheme'
import { useLocale } from 'next-intl'
import { smartFormat } from '@/lib/formatNumber'
import { Download, Maximize2, Minimize2, Pin, MousePointer } from 'lucide-react'
import { HistogramChart } from './HistogramChart'
import { HeatmapChart } from './HeatmapChart'
import { ComboChart } from './ComboChart'
import { WaterfallChart } from './WaterfallChart'
import { GaugeChart } from './GaugeChart'
import type { DrillFilter } from '@/types/drill'

export type ChartData = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'stacked_bar' | 'stacked_bar_100' | 'funnel' | 'table'
    | 'histogram' | 'heatmap' | 'combo' | 'waterfall' | 'gauge' | 'radar' | 'box_plot'
  title: string
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  yKeys?: string[]
  colors?: string[]
  // Reference lines
  referenceLines?: { value: number; label: string; color?: string; axis?: 'x' | 'y' }[]
  // Heatmap-specific
  matrix?: Record<string, Record<string, number>>
  columns?: string[]
  // Combo-specific
  barKeys?: string[]
  lineKeys?: string[]
  // Gauge-specific
  gaugeValue?: number
  gaugeMin?: number
  gaugeMax?: number
  gaugeUnit?: string
  // Waterfall-specific
  waterfallData?: { name: string; value: number }[]
}

const DL_COLORS = ['#7C3AED', '#4A9EDA', '#84BB4C', '#F9CF48', '#ED6E6E', '#A989C5', '#F1B556', '#98D9D9', '#7172AD']

type Props = {
  chart: ChartData
  onPin?: () => void
  onDrillDown?: (filter: DrillFilter) => void
}

export function InteractiveChart({ chart, onPin, onDrillDown }: Props) {
  const locale = useLocale()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const colors = chart.colors ?? DL_COLORS

  // Guard
  if (chart.type !== 'gauge' && chart.type !== 'heatmap' && (!Array.isArray(chart.data) || chart.data.length === 0)) {
    return <div className="text-dl-text-light text-dl-sm py-4 text-center">No chart data available</div>
  }

  // Click handler for drill-down
  const handleDataClick = useCallback((entry: Record<string, unknown>, xKey: string) => {
    if (!onDrillDown || !entry) return
    const value = entry[xKey]
    if (value === undefined || value === null) return
    onDrillDown({
      column: xKey,
      value: value as string | number,
      operator: 'eq',
      label: `${xKey} = ${value}`,
    })
  }, [onDrillDown])

  // Download as PNG
  const handleDownload = useCallback(() => {
    if (!chartRef.current) return
    const svg = chartRef.current.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx?.scale(2, 2)
      ctx?.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.download = `${chart.title || 'chart'}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }, [chart.title])

  const clickable = !!onDrillDown
  const cursorClass = clickable ? 'cursor-pointer' : ''

  const commonProps = {
    data: chart.data,
    margin: { top: 8, right: 16, left: 0, bottom: 8 },
  }

  const dataLen = chart.data?.length || 0
  const axisProps = {
    xAxis: <XAxis dataKey={chart.xKey} {...chartTheme.xAxis} tick={{ fontSize: 11 }}
      interval={0} angle={dataLen > 6 ? -30 : 0}
      textAnchor={dataLen > 6 ? 'end' : 'middle'}
      height={dataLen > 6 ? 60 : 30} />,
    yAxis: <YAxis {...chartTheme.yAxis} tick={{ fontSize: 11 }} tickFormatter={(v) => smartFormat(v, locale)} />,
    grid: <CartesianGrid {...chartTheme.cartesianGrid} />,
    tooltip: <Tooltip {...chartTheme.tooltip} formatter={(value) => [smartFormat(Number(value), locale), undefined]} />,
    legend: <Legend wrapperStyle={{ fontSize: '11px', color: '#74838F' }} />,
  }

  // Reference lines helper
  const refLines = (chart.referenceLines || []).map((rl, i) => (
    <ReferenceLine key={`ref-${i}`}
      y={rl.axis !== 'x' ? rl.value : undefined}
      x={rl.axis === 'x' ? rl.value : undefined}
      stroke={rl.color || '#ED6E6E'}
      strokeDasharray="6 3" strokeWidth={1.5}
      label={{ value: rl.label, position: 'insideTopRight', fontSize: 10, fill: rl.color || '#ED6E6E' }} />
  ))

  const renderChart = () => {
    switch (chart.type) {
      // -- HISTOGRAM --
      case 'histogram':
        return <HistogramChart data={chart.data} xKey={chart.xKey} yKey={chart.yKey} />

      // -- HEATMAP --
      case 'heatmap':
        return <HeatmapChart matrix={chart.matrix || {}} columns={chart.columns || []} title={chart.title} />

      // -- COMBO --
      case 'combo':
        return <ComboChart data={chart.data} xKey={chart.xKey}
          barKeys={chart.barKeys || [chart.yKey]} lineKeys={chart.lineKeys || []}
          colors={colors} />

      // -- WATERFALL --
      case 'waterfall':
        return <WaterfallChart data={chart.waterfallData || chart.data.map(d => ({ name: String(d[chart.xKey]), value: Number(d[chart.yKey]) }))} />

      // -- GAUGE --
      case 'gauge':
        return <GaugeChart value={chart.gaugeValue ?? 0} min={chart.gaugeMin} max={chart.gaugeMax}
          label={chart.title} unit={chart.gaugeUnit} />

      // -- RADAR --
      case 'radar': {
        const radarKeys = chart.yKeys && chart.yKeys.length > 0 ? chart.yKeys : [chart.yKey]
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chart.data}
            onClick={(e: Record<string, unknown>) => { const ap = (e as { activePayload?: { payload: Record<string, unknown> }[] })?.activePayload; if (ap?.[0]) handleDataClick(ap[0].payload, chart.xKey) }}>
            <PolarGrid stroke="#E8ECEE" />
            <PolarAngleAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: '#74838F' }} className={cursorClass} />
            <PolarRadiusAxis tick={{ fontSize: 9 }} tickFormatter={(v) => smartFormat(v, locale)} />
            {radarKeys.map((key, ki) => (
              <Radar key={key} name={key} dataKey={key} stroke={colors[ki % colors.length]}
                fill={colors[ki % colors.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
            <Tooltip {...chartTheme.tooltip} formatter={(value) => [smartFormat(Number(value), locale), undefined]} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#74838F' }} />
          </RadarChart>
        )
      }

      // -- BAR --
      case 'bar': {
        const barKeys = chart.yKeys && chart.yKeys.length > 1 ? chart.yKeys : [chart.yKey]
        return (
          <BarChart {...commonProps}>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            {refLines}
            {barKeys.map((key, ki) => (
              <Bar key={key} dataKey={key} fill={colors[ki % colors.length]} radius={[3, 3, 0, 0]}
                className={cursorClass}
                onClick={(entry) => handleDataClick(entry as unknown as Record<string, unknown>, chart.xKey)}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)} />
            ))}
          </BarChart>
        )
      }

      // -- STACKED BAR --
      case 'stacked_bar':
        return (
          <BarChart {...commonProps}>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            {refLines}
            {(chart.yKeys ?? [chart.yKey]).map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={colors[i % colors.length]}
                className={cursorClass}
                onClick={(entry) => handleDataClick(entry as unknown as Record<string, unknown>, chart.xKey)}
                radius={i === (chart.yKeys?.length ?? 1) - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        )

      // -- 100% STACKED BAR --
      case 'stacked_bar_100': {
        const keys100 = chart.yKeys ?? [chart.yKey]
        // Normalize data to percentages
        const normalized = chart.data.map(row => {
          const total = keys100.reduce((sum, k) => sum + (Number(row[k]) || 0), 0)
          const normed: Record<string, unknown> = { [chart.xKey]: row[chart.xKey] }
          keys100.forEach(k => { normed[k] = total > 0 ? ((Number(row[k]) || 0) / total) * 100 : 0 })
          return normed
        })
        return (
          <BarChart data={normalized} margin={commonProps.margin}>
            {axisProps.grid}{axisProps.xAxis}
            <YAxis {...chartTheme.yAxis} tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip {...chartTheme.tooltip} formatter={(value) => [`${Number(value).toFixed(1)}%`, undefined]} />
            {axisProps.legend}
            {keys100.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="pct" fill={colors[i % colors.length]}
                className={cursorClass}
                onClick={(entry) => handleDataClick(entry as unknown as Record<string, unknown>, chart.xKey)}
                radius={i === keys100.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        )
      }

      // -- BOX PLOT (rendered as a custom bar chart with whiskers) --
      case 'box_plot': {
        // Expects data: [{name, min, q1, median, q3, max}]
        return (
          <BarChart data={chart.data} margin={commonProps.margin}>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            <Tooltip {...chartTheme.tooltip} />
            {/* Invisible spacer from 0 to min */}
            <Bar dataKey="q1" stackId="box" fill="transparent" />
            {/* IQR box: q1 to q3 */}
            <Bar dataKey="_iqr" stackId="box" fill={colors[0]} fillOpacity={0.6} radius={[2, 2, 2, 2]}>
              {chart.data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.5} />)}
            </Bar>
            {/* Median line as reference */}
            {chart.data.map((d, i) => (
              <ReferenceLine key={`med-${i}`} y={Number(d.median)} stroke={colors[0]} strokeWidth={2}
                label={{ value: '', position: 'right' }} />
            ))}
          </BarChart>
        )
      }

      // -- LINE --
      case 'line': {
        const lineKeys = chart.yKeys && chart.yKeys.length > 1 ? chart.yKeys : [chart.yKey]
        return (
          <LineChart {...commonProps} onClick={(e: Record<string, unknown>) => { const ap = (e as { activePayload?: { payload: Record<string, unknown> }[] })?.activePayload; if (ap?.[0]) handleDataClick(ap[0].payload, chart.xKey) }}>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            {refLines}
            {lineKeys.map((key, ki) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[ki % colors.length]} strokeWidth={2}
                dot={{ fill: colors[ki % colors.length], r: 3 }} activeDot={{ r: 5 }} className={cursorClass} />
            ))}
          </LineChart>
        )
      }

      // -- AREA --
      case 'area': {
        const areaKeys = chart.yKeys && chart.yKeys.length > 1 ? chart.yKeys : [chart.yKey]
        return (
          <AreaChart {...commonProps} onClick={(e: Record<string, unknown>) => { const ap = (e as { activePayload?: { payload: Record<string, unknown> }[] })?.activePayload; if (ap?.[0]) handleDataClick(ap[0].payload, chart.xKey) }}>
            <defs>
              {areaKeys.map((_, ki) => (
                <linearGradient key={ki} id={`areaGrad${ki}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[ki % colors.length]} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={colors[ki % colors.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
            {axisProps.tooltip}{axisProps.legend}
            {refLines}
            {areaKeys.map((key, ki) => (
              <Area key={key} type="monotone" dataKey={key} stroke={colors[ki % colors.length]}
                strokeWidth={2} fill={`url(#areaGrad${ki})`} className={cursorClass} />
            ))}
          </AreaChart>
        )
      }

      // -- PIE / DONUT --
      case 'pie':
      case 'donut':
        return (
          <PieChart>
            <Pie data={chart.data} dataKey={chart.yKey} nameKey={chart.xKey}
              cx="50%" cy="50%" innerRadius={chart.type === 'donut' ? '55%' : 0}
              outerRadius="75%" paddingAngle={2}
              className={cursorClass}
              onClick={(entry) => handleDataClick(entry as unknown as Record<string, unknown>, chart.xKey)}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}>
              {chart.data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.6} />
              ))}
            </Pie>
            <Tooltip {...chartTheme.tooltip} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#74838F' }} />
          </PieChart>
        )

      // -- SCATTER --
      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {axisProps.grid}
            <XAxis dataKey={chart.xKey} {...chartTheme.xAxis} name={chart.xKey} tick={{ fontSize: 11 }} />
            <YAxis dataKey={chart.yKey} {...chartTheme.yAxis} name={chart.yKey} tick={{ fontSize: 11 }} />
            {axisProps.tooltip}
            <Scatter data={chart.data} fill={colors[0]} className={cursorClass}
              onClick={(entry) => handleDataClick(entry as unknown as Record<string, unknown>, chart.xKey)} />
          </ScatterChart>
        )

      // -- FUNNEL --
      case 'funnel':
        return (
          <FunnelChart>
            <Tooltip {...chartTheme.tooltip} />
            <Funnel dataKey={chart.yKey} data={chart.data} isAnimationActive>
              {chart.data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
              <LabelList position="center" fill="#fff" fontSize={11} fontWeight="bold"
                formatter={(value) => Number(value).toLocaleString()} />
            </Funnel>
          </FunnelChart>
        )

      // -- TABLE --
      case 'table': {
        const cols = Object.keys(chart.data[0] ?? {})
        return (
          <div className="overflow-auto max-h-64">
            <table className="w-full text-dl-xs">
              <thead>
                <tr className="border-b border-dl-border">
                  {cols.map(c => (
                    <th key={c} className="px-3 py-2 text-left font-bold text-dl-text-light uppercase tracking-wider">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.data.slice(0, 50).map((row, i) => (
                  <tr key={i} className={`border-b border-dl-border hover:bg-dl-bg-light ${cursorClass}`}
                    onClick={() => handleDataClick(row, cols[0])}>
                    {cols.map(c => (
                      <td key={c} className="px-3 py-1.5 text-dl-text-dark">{String(row[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      default:
        return <div className="text-dl-text-light text-dl-sm py-4 text-center">Unsupported chart type: {chart.type}</div>
    }
  }

  const needsContainer = !['table', 'histogram', 'heatmap', 'combo', 'waterfall', 'gauge'].includes(chart.type)
  const chartHeight = isFullscreen ? 500 : 280

  const chartContent = (
    <div ref={chartRef} className={`rounded-dl-lg border border-dl-border bg-dl-bg overflow-hidden shadow-dl-sm ${isFullscreen ? 'fixed inset-8 z-50 flex flex-col' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dl-border">
        <div className="flex items-center gap-2">
          <span className="text-dl-sm font-bold text-dl-text-dark">{chart.title}</span>
          {onDrillDown && (
            <span className="text-[10px] text-dl-text-light flex items-center gap-0.5">
              <MousePointer size={9} /> Click to drill
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onPin && (
            <button onClick={onPin} className="dl-btn-subtle p-1.5 rounded-dl-sm" title="Pin to Dashboard">
              <Pin size={13} />
            </button>
          )}
          <button onClick={handleDownload} className="dl-btn-subtle p-1.5 rounded-dl-sm" title="Download PNG">
            <Download size={13} />
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="dl-btn-subtle p-1.5 rounded-dl-sm" title={isFullscreen ? 'Exit fullscreen' : 'Expand'}>
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`p-4 ${isFullscreen ? 'flex-1' : ''}`}>
        {needsContainer ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            {renderChart() as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          renderChart()
        )}
      </div>
    </div>
  )

  return (
    <>
      {chartContent}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setIsFullscreen(false)} />
      )}
    </>
  )
}
