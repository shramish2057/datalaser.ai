'use client'
import { X, ChevronRight, ExternalLink } from 'lucide-react'
import { useDrill } from './DrillContext'
import { useState } from 'react'

export function DrillDownPanel({ onOpenInStudio }: { onOpenInStudio?: () => void }) {
  const { filters, filteredData, sourceData, removeFilter, clearFilters, isFiltered } = useDrill()
  const [page, setPage] = useState(0)
  const pageSize = 20

  if (!isFiltered) return null

  const totalRows = filteredData.length
  const totalSource = sourceData.length
  const columns = filteredData.length > 0 ? Object.keys(filteredData[0]) : []
  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(totalRows / pageSize)

  // Compute quick stats for numeric columns
  const numericStats: { col: string; mean: string; min: string; max: string }[] = []
  for (const col of columns.slice(0, 6)) {
    const vals = filteredData.map(r => Number(r[col])).filter(v => !isNaN(v))
    if (vals.length > 0 && vals.length / filteredData.length > 0.5) {
      numericStats.push({
        col,
        mean: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
        min: Math.min(...vals).toFixed(2),
        max: Math.max(...vals).toFixed(2),
      })
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-white shadow-2xl border-l border-mb-border z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-[48px] flex items-center justify-between px-4 border-b border-mb-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-mb-text-dark">Drill Down</span>
          <span className="text-[11px] text-mb-text-light">
            {totalRows.toLocaleString()} of {totalSource.toLocaleString()} rows
          </span>
        </div>
        <button onClick={clearFilters} className="text-mb-text-light hover:text-mb-text-dark p-1">
          <X size={16} />
        </button>
      </div>

      {/* Breadcrumb / Active Filters */}
      <div className="px-4 py-2 border-b border-mb-border flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-mb-text-light">All</span>
        {filters.map((f, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={10} className="text-mb-text-light" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-mb-brand-hover text-mb-brand text-[11px] font-medium">
              {f.label}
              <button onClick={() => removeFilter(i)} className="hover:text-mb-brand-dark">
                <X size={10} />
              </button>
            </span>
          </span>
        ))}
      </div>

      {/* Quick Stats */}
      {numericStats.length > 0 && (
        <div className="px-4 py-2 border-b border-mb-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light mb-1.5">Subset Stats</p>
          <div className="grid grid-cols-3 gap-2">
            {numericStats.slice(0, 3).map(s => (
              <div key={s.col} className="text-center">
                <p className="text-[10px] text-mb-text-light truncate">{s.col}</p>
                <p className="text-[14px] font-bold text-mb-text-dark">{s.mean}</p>
                <p className="text-[9px] text-mb-text-light">{s.min} – {s.max}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-mb-border">
              {columns.map(c => (
                <th key={c} className="px-2 py-1.5 text-left text-[10px] font-bold text-mb-text-light uppercase tracking-wider whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, i) => (
              <tr key={i} className="border-b border-mb-border hover:bg-mb-bg-light">
                {columns.map(c => (
                  <td key={c} className="px-2 py-1.5 text-mb-text-dark whitespace-nowrap max-w-[120px] truncate">
                    {String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="h-[40px] flex items-center justify-between px-4 border-t border-mb-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="text-[11px] text-mb-text-medium hover:text-mb-brand disabled:opacity-30">
            ← Prev
          </button>
          <span className="text-[11px] text-mb-text-light">
            Page {page + 1} of {totalPages || 1}
          </span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
            className="text-[11px] text-mb-text-medium hover:text-mb-brand disabled:opacity-30">
            Next →
          </button>
        </div>
        {onOpenInStudio && (
          <button onClick={onOpenInStudio}
            className="flex items-center gap-1 text-[11px] text-mb-brand hover:underline">
            <ExternalLink size={11} /> Open in Studio
          </button>
        )}
      </div>
    </div>
  )
}
