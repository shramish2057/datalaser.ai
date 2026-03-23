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
    <header className="h-[65px] bg-dl-bg border-b border-dl-border flex items-center justify-between px-6 flex-shrink-0 font-sans">
      <h1 className="text-dl-lg font-black text-dl-text-dark">{label}</h1>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-dl-text-medium text-dl-sm">
          <div className="w-2 h-2 rounded-full bg-dl-success" />
          Connected
        </div>
        <div className="w-px h-4 bg-dl-border mx-1" />
        <button className="dl-btn-subtle p-2 rounded-dl-md">
          <Bell size={15} />
        </button>
        <button
          onClick={() => router.push('/connect')}
          className="dl-btn-secondary flex items-center gap-1.5 text-dl-sm py-1.5"
        >
          <Plus size={14} /> Add data
        </button>
      </div>
    </header>
  )
}
