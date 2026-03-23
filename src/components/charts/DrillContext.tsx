'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import type { DrillFilter } from '@/types/drill'

interface DrillContextValue {
  filters: DrillFilter[]
  addFilter: (filter: DrillFilter) => void
  removeFilter: (index: number) => void
  clearFilters: () => void
  filteredData: Record<string, unknown>[]
  sourceData: Record<string, unknown>[]
  setSourceData: (data: Record<string, unknown>[]) => void
  isFiltered: boolean
}

const DrillCtx = createContext<DrillContextValue | null>(null)

function applyFilters(data: Record<string, unknown>[], filters: DrillFilter[]): Record<string, unknown>[] {
  return data.filter(row => {
    return filters.every(f => {
      const val = row[f.column]
      switch (f.operator) {
        case 'eq': return String(val) === String(f.value)
        case 'neq': return String(val) !== String(f.value)
        case 'gt': return Number(val) > Number(f.value)
        case 'lt': return Number(val) < Number(f.value)
        case 'in': return Array.isArray(f.value) ? (f.value as unknown[]).includes(val) : String(val) === String(f.value)
        default: return true
      }
    })
  })
}

export function DrillProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<DrillFilter[]>([])
  const [sourceData, setSourceData] = useState<Record<string, unknown>[]>([])

  const addFilter = useCallback((filter: DrillFilter) => {
    setFilters(prev => [...prev, filter])
  }, [])

  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters([])
  }, [])

  const filteredData = filters.length > 0 ? applyFilters(sourceData, filters) : sourceData

  return (
    <DrillCtx.Provider value={{
      filters, addFilter, removeFilter, clearFilters,
      filteredData, sourceData, setSourceData,
      isFiltered: filters.length > 0,
    }}>
      {children}
    </DrillCtx.Provider>
  )
}

export function useDrill() {
  const ctx = useContext(DrillCtx)
  if (!ctx) throw new Error('useDrill must be used within DrillProvider')
  return ctx
}
