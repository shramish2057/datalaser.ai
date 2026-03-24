'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart2, MessageSquare, LayoutGrid, Database, Settings,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Logo } from '@/components/Logo'

type NavItem = { icon: typeof BarChart2; label: string; href: string } | null

const NAV: NavItem[] = [
  { icon: BarChart2, label: 'Insights', href: '/app/insights' },
  { icon: MessageSquare, label: 'Ask Data', href: '/app/ask' },
  { icon: LayoutGrid, label: 'Dashboard', href: '/app/dashboard' },
  null,
  { icon: Database, label: 'Data Sources', href: '/app/sources' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const s = localStorage.getItem('mb-sidebar')
    if (s !== null) setExpanded(s === 'true')
  }, [])

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem('mb-sidebar', String(next))
  }

  return (
    <aside
      className={`
        ${expanded ? 'w-[260px]' : 'w-[52px]'}
        flex-shrink-0 h-screen bg-dl-bg
        border-r border-dl-border
        flex flex-col transition-all duration-150 font-sans
      `}
    >
      {/* Logo */}
      <div
        className={`
          h-[72px] flex items-center border-b border-dl-border flex-shrink-0
          ${expanded ? 'px-4 gap-2' : 'justify-center'}
        `}
      >
        <Logo size={expanded ? 'md' : 'sm'} />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV.map((item, i) => {
          if (item === null) {
            return <div key={`div-${i}`} className="h-px bg-dl-border mx-3 my-2" />
          }
          const { icon: Icon, label, href } = item
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                relative flex items-center h-[40px] font-sans font-bold text-dl-sm
                transition-colors duration-100 cursor-pointer group
                ${expanded ? 'px-4 gap-3' : 'justify-center'}
                ${active
                  ? 'text-dl-brand bg-dl-brand-hover'
                  : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'
                }
              `}
            >
              {active && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />
              )}
              <Icon size={16} className="flex-shrink-0" />
              {expanded && <span>{label}</span>}
              {!expanded && (
                <div className="absolute left-[52px] z-50 bg-dl-text-dark text-white text-dl-xs px-2 py-1 rounded-dl-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  {label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-dl-border flex-shrink-0">
        <button
          onClick={toggle}
          className="flex items-center justify-center w-full h-[40px] text-dl-text-light hover:text-dl-text-medium hover:bg-dl-bg-light transition-colors"
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </aside>
  )
}
