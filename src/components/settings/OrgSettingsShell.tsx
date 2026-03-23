'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function OrgSettingsShell({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const base = `/${orgSlug}/settings`
  const nav = [
    { label: 'General', href: base },
    { label: 'Members', href: `${base}/members` },
    { label: 'Billing', href: `${base}/billing` },
    { label: 'API Keys', href: `${base}/api-keys` },
  ]

  return (
    <div className="flex h-full font-sans">
      <nav className="w-[160px] flex-shrink-0 border-r border-dl-border bg-dl-bg flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-dl-border">
          <Link href={`/${orgSlug}`}
            className="flex items-center gap-1.5 text-dl-xs font-bold text-dl-text-light hover:text-dl-brand transition-colors">
            <ArrowLeft size={12} /> Back to workspaces
          </Link>
        </div>
        <div className="px-4 py-4 flex-1">
          <p className="dl-section-header mb-3">Organization</p>
          <div className="space-y-0.5">
            {nav.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}
                  className={`block px-3 py-1.5 rounded-dl-md text-dl-sm transition-colors
                    ${active ? 'text-dl-brand font-black bg-dl-brand-hover' : 'text-dl-text-medium font-bold hover:text-dl-text-dark hover:bg-dl-bg-light'}`}>
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
      <div className="flex-1 min-w-0 overflow-y-auto px-8 py-8">
        <div className="max-w-2xl">{children}</div>
      </div>
    </div>
  )
}
