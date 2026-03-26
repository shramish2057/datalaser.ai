'use client'

import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'

interface TableOption {
  id: string
  label: string
  rowCount: number
}

interface Props {
  tables: TableOption[]
  value: string | null
  onChange: (tableId: string) => void
}

export function TableFocusSelector({ tables, value, onChange }: Props) {
  const t = useTranslations()

  if (tables.length === 0) return null

  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5
          text-xs font-bold text-gray-700 cursor-pointer
          hover:border-gray-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400
          transition-colors"
      >
        {tables.map(t => (
          <option key={t.id} value={t.id}>
            {t.label} ({t.rowCount.toLocaleString()})
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
