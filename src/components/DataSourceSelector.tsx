'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Database, FileText } from 'lucide-react'
import { useActiveSource } from '@/lib/context/ActiveSourceContext'
import { isDbSource } from '@/lib/source-types'

const TYPE_LABELS: Record<string, string> = {
  csv: 'CSV', xlsx: 'Excel', json: 'JSON', parquet: 'Parquet',
  postgres: 'PG', mysql: 'MySQL', mongodb: 'Mongo', mssql: 'SQL Server',
  snowflake: 'Snowflake', bigquery: 'BQ', redshift: 'Redshift', databricks: 'DBR',
  shopify: 'Shopify', stripe: 'Stripe', google_ads: 'GAds', meta_ads: 'Meta',
}

export function DataSourceSelector() {
  const { activeSource, sources, setActiveSourceId, loading } = useActiveSource()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (loading || sources.length === 0) return null

  const typeLabel = (type: string) => TYPE_LABELS[type] || type.toUpperCase()
  const SourceIcon = ({ type }: { type: string }) =>
    isDbSource(type)
      ? <Database size={13} className="text-dl-text-light flex-shrink-0" />
      : <FileText size={13} className="text-dl-text-light flex-shrink-0" />

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-dl-md border border-dl-border
          bg-white hover:border-dl-brand transition-colors text-left min-w-[180px] max-w-[280px]"
      >
        <SourceIcon type={activeSource?.source_type || ''} />
        <span className="text-dl-sm font-bold text-dl-text-dark truncate flex-1">
          {activeSource?.name || 'Select source'}
        </span>
        <span className="text-dl-xs text-dl-text-light uppercase bg-dl-bg-medium px-1.5 py-0.5 rounded-dl-sm flex-shrink-0">
          {typeLabel(activeSource?.source_type || '')}
        </span>
        <ChevronDown size={14} className={`text-dl-text-light transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[300px] bg-white border border-dl-border rounded-dl-lg shadow-dl-lg z-50 py-1 max-h-[320px] overflow-y-auto">
          {sources.map(src => {
            const isActive = src.id === activeSource?.id
            return (
              <button
                key={src.id}
                onClick={() => { setActiveSourceId(src.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${isActive ? 'bg-dl-brand-hover' : 'hover:bg-dl-bg-light'}`}
              >
                <SourceIcon type={src.source_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-dl-sm truncate ${isActive ? 'font-bold text-dl-brand' : 'text-dl-text-dark'}`}>
                      {src.name}
                    </span>
                    <span className="text-dl-xs text-dl-text-light uppercase bg-dl-bg-medium px-1.5 py-0.5 rounded-dl-sm flex-shrink-0">
                      {typeLabel(src.source_type)}
                    </span>
                  </div>
                  <span className="text-dl-xs text-dl-text-light">
                    {src.row_count.toLocaleString()} rows
                  </span>
                </div>
                {isActive && <div className="w-2 h-2 rounded-full bg-dl-brand flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
