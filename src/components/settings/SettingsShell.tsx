'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Account', href: '/settings' },
  { label: 'Billing', href: '/settings/billing' },
  { label: 'API Keys', href: '/settings/api-keys' },
]

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sub-nav */}
      <nav className="w-[160px] flex-shrink-0 border-r border-dl-border bg-dl-bg flex flex-col px-4 py-6">
        <p className="dl-section-header mb-3">Settings</p>
        <div className="space-y-0.5">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  block px-3 py-1.5 rounded-dl-md text-dl-sm transition-colors
                  ${active
                    ? 'text-dl-brand font-black bg-dl-brand-hover'
                    : 'text-dl-text-medium font-bold hover:text-dl-text-dark hover:bg-dl-bg-light'}
                `}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto px-8 py-8 bg-dl-bg-light">
        <div className="max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  )
}
