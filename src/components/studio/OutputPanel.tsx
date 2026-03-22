'use client'

import { useState } from 'react'
import { FlaskConical, ChevronDown, ChevronRight, Pin, BookOpen, BarChart2 } from 'lucide-react'
import { InteractiveChart, type ChartData } from '@/components/charts/InteractiveChart'
import type { StudioCell } from '@/types/studio'

type Props = {
  cell: StudioCell | null | undefined
  onPublishInsight: (cell: StudioCell) => void
  onSaveToLibrary: (cell: StudioCell) => void
  isPublished: boolean
}

export default function OutputPanel({ cell, onPublishInsight, onSaveToLibrary, isPublished }: Props) {
  const [showRaw, setShowRaw] = useState(false)

  // Empty state
  if (!cell) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <FlaskConical size={56} className="text-mb-text-light mb-4" />
        <p className="text-mb-base text-mb-text-medium font-bold mb-1">Run a cell to see output</p>
        <p className="text-mb-text-light text-mb-sm">Ask Claude or write Python above</p>
      </div>
    )
  }

  // Running
  if (cell.status === 'running') {
    return (
      <div className="p-6 space-y-4">
        <div className="h-20 rounded-mb-lg bg-mb-bg-medium animate-pulse" />
        <div className="h-48 rounded-mb-lg bg-mb-bg-medium animate-pulse" />
        <div className="h-28 rounded-mb-lg bg-mb-bg-medium animate-pulse" />
        <p className="text-mb-sm text-mb-text-medium text-center">Executing analysis...</p>
      </div>
    )
  }

  // Error
  if (cell.status === 'error') {
    return (
      <div className="p-6">
        <div className="border-l-4 border-mb-error bg-red-50 p-4 rounded-r-mb-lg">
          <p className="font-semibold text-red-700 text-mb-sm mb-1">Error</p>
          <p className="font-mono text-mb-sm text-red-600">{cell.output?.error}</p>
        </div>
      </div>
    )
  }

  if (cell.status !== 'done' || !cell.output?.success) return null

  const output = cell.output
  const result = output.result as Record<string, unknown> | null

  // Build chart data for InteractiveChart
  let chartForRecharts: ChartData | null = null
  if (output.chart_data) {
    const cd = output.chart_data
    chartForRecharts = {
      type: (cd.chart_type === 'scatter' ? 'scatter' : cd.chart_type === 'line' ? 'line' : cd.chart_type === 'area' ? 'area' : 'bar') as ChartData['type'],
      title: cd.title || 'Result',
      data: cd.data,
      xKey: cd.x_key,
      yKey: cd.y_keys?.[0] || 'value',
      yKeys: cd.y_keys?.length > 1 ? cd.y_keys : undefined,
    }
  }

  // Build stats rows from result
  const statsRows: { label: string; value: string; significant?: boolean }[] = []
  if (result && typeof result === 'object' && !Array.isArray(result) && (result as Record<string, unknown>).type !== 'dataframe') {
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'number') {
        const formatted = k === 'p_value' || k === 'f_p_value'
          ? (v < 0.001 ? '< 0.001' : v.toFixed(4))
          : Number.isInteger(v) ? v.toString() : v.toFixed(4)
        statsRows.push({
          label: k.replace(/_/g, ' '),
          value: formatted,
          significant: (k === 'p_value' || k === 'f_p_value') ? v < 0.05 : undefined,
        })
      } else if (typeof v === 'boolean') {
        statsRows.push({ label: k.replace(/_/g, ' '), value: v ? 'Yes' : 'No' })
      }
    }
  }

  // Dataframe result
  const dfResult = result && typeof result === 'object' && (result as Record<string, unknown>).type === 'dataframe'
    ? result as { columns: string[]; data: Record<string, unknown>[]; shape: number[] }
    : null

  return (
    <div className="p-6 overflow-y-auto h-full">

      {/* Interpretation */}
      {output.interpretation && (
        <div className="border-l-4 border-mb-brand shadow-sm rounded-r-mb-lg p-5 mb-5 bg-white">
          <p className="text-[15px] leading-[1.7] text-mb-text-dark">{output.interpretation}</p>

          {output.key_findings && output.key_findings.length > 0 && (
            <div className="mt-3 border-t border-mb-border pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light mb-2">Key findings</p>
              <ul className="space-y-1.5">
                {output.key_findings.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-mb-brand mt-2 flex-shrink-0" />
                    <span className="text-mb-sm text-mb-text-dark">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {output.recommended_actions && output.recommended_actions.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-mb-lg p-3">
              <p className="text-[10px] font-semibold text-amber-700 mb-1">Recommended</p>
              <ul className="space-y-1">
                {output.recommended_actions.map((a, i) => (
                  <li key={i} className="text-mb-sm text-amber-800">• {a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {chartForRecharts && (
        <div className="mb-5">
          <p className="text-mb-sm font-medium text-mb-text-dark mb-2">{chartForRecharts.title}</p>
          <div className="bg-white border border-mb-border rounded-mb-lg p-3">
            <InteractiveChart chart={chartForRecharts} />
          </div>
        </div>
      )}

      {/* Stats table */}
      {statsRows.length > 0 && (
        <div className="mb-5">
          <table className="w-full text-mb-sm border-collapse">
            <thead>
              <tr>
                <th className="bg-mb-bg-medium text-[10px] uppercase tracking-wider text-mb-text-light p-2 text-left">Metric</th>
                <th className="bg-mb-bg-medium text-[10px] uppercase tracking-wider text-mb-text-light p-2 text-left">Value</th>
                <th className="bg-mb-bg-medium text-[10px] uppercase tracking-wider text-mb-text-light p-2 text-left">Sig.</th>
              </tr>
            </thead>
            <tbody>
              {statsRows.map((row, i) => (
                <tr key={i} className="border-b border-mb-border">
                  <td className="p-2 text-mb-text-medium">{row.label}</td>
                  <td className="p-2 font-mono text-mb-text-dark">{row.value}</td>
                  <td className="p-2">
                    {row.significant === true && <span className="flex items-center gap-1 text-mb-success text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-mb-success" /> Yes</span>}
                    {row.significant === false && <span className="text-mb-text-light text-[11px]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DataFrame table */}
      {dfResult && (
        <div className="mb-5 overflow-x-auto">
          <table className="w-full text-mb-sm border-collapse">
            <thead>
              <tr>
                {dfResult.columns.map(c => (
                  <th key={c} className="bg-mb-bg-medium text-[10px] uppercase tracking-wider text-mb-text-light p-2 text-left whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dfResult.data.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-b border-mb-border">
                  {dfResult.columns.map(c => (
                    <td key={c} className="p-2 font-mono text-[12px] text-mb-text-dark whitespace-nowrap">{String(row[c] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {dfResult.shape[0] > 20 && (
            <p className="text-[11px] text-mb-text-light mt-1">Showing 20 of {dfResult.shape[0]} rows</p>
          )}
        </div>
      )}

      {/* Raw output */}
      <div className="mb-5">
        <button onClick={() => setShowRaw(!showRaw)} className="flex items-center gap-1 text-[11px] text-mb-text-light hover:text-mb-text-medium">
          {showRaw ? <ChevronDown size={11} /> : <ChevronRight size={11} />} View raw output
        </button>
        {showRaw && (
          <pre className="mt-2 bg-gray-900 rounded-mb-lg p-3 font-mono text-[11px] text-gray-300 max-h-48 overflow-y-auto">
            {JSON.stringify(output.result, null, 2)}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-mb-border pt-3 flex gap-2">
        <button
          onClick={() => cell && onPublishInsight(cell)}
          disabled={isPublished}
          className={`text-mb-sm px-3 py-1.5 rounded flex items-center gap-1.5 ${
            isPublished ? 'bg-mb-bg-medium text-mb-text-light cursor-default' : 'bg-mb-brand text-white hover:bg-mb-brand-dark'
          }`}
        >
          <Pin size={13} /> {isPublished ? '✓ Published' : 'Publish as Insight'}
        </button>
        <button onClick={() => cell && onSaveToLibrary(cell)} className="text-mb-sm px-3 py-1.5 rounded border border-mb-border text-mb-text-medium hover:bg-mb-bg-medium flex items-center gap-1.5">
          <BookOpen size={13} /> Save to Library
        </button>
        <button disabled className="text-mb-sm px-3 py-1.5 rounded border border-mb-border text-mb-text-light cursor-not-allowed flex items-center gap-1.5" title="Dashboard builder coming soon">
          <BarChart2 size={13} /> Dashboard
        </button>
      </div>
    </div>
  )
}
