'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Plus, Bell } from 'lucide-react'

const LABELS: Record<string, string> = {
  '/app/insights': 'Insights',
  '/app/ask': 'Ask Data',
  '/app/dashboard': 'Dashboard',
  '/app/sources': 'Data Sources',
  '/app/settings': 'Settings',
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const label = Object.entries(LABELS).find(([k]) => pathname.startsWith(k))?.[1] ?? 'DataLaser'

  return (
    <header className="h-[65px] bg-mb-bg border-b border-mb-border flex items-center justify-between px-6 flex-shrink-0 font-sans">
      <h1 className="text-mb-lg font-black text-mb-text-dark">{label}</h1>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-mb-text-medium text-mb-sm">
          <div className="w-2 h-2 rounded-full bg-mb-success" />
          Connected
        </div>
        <div className="w-px h-4 bg-mb-border mx-1" />
        <button className="mb-btn-subtle p-2 rounded-mb-md">
          <Bell size={15} />
        </button>
        <button
          onClick={() => router.push('/connect')}
          className="mb-btn-secondary flex items-center gap-1.5 text-mb-sm py-1.5"
        >
          <Plus size={14} /> Add data
        </button>
      </div>
    </header>
  )
}
