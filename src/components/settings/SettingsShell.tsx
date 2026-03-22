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
      <nav className="w-[160px] flex-shrink-0 border-r border-mb-border bg-mb-bg flex flex-col px-4 py-6">
        <p className="mb-section-header mb-3">Settings</p>
        <div className="space-y-0.5">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  block px-3 py-1.5 rounded-mb-md text-mb-sm transition-colors
                  ${active
                    ? 'text-mb-brand font-black bg-mb-brand-hover'
                    : 'text-mb-text-medium font-bold hover:text-mb-text-dark hover:bg-mb-bg-light'}
                `}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto px-8 py-8 bg-mb-bg-light">
        <div className="max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  )
}
