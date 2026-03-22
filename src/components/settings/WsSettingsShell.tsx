'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function WsSettingsShell({ orgSlug, workspaceSlug, children }: {
  orgSlug: string; workspaceSlug: string; children: React.ReactNode
}) {
  const pathname = usePathname()
  const base = `/${orgSlug}/${workspaceSlug}/settings`
  const nav = [
    { label: 'General', href: base },
    { label: 'Members', href: `${base}/members` },
  ]

  return (
    <div className="flex h-full font-sans">
      <nav className="w-[160px] flex-shrink-0 border-r border-mb-border bg-mb-bg flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-mb-border">
          <Link href={`/${orgSlug}/${workspaceSlug}`}
            className="flex items-center gap-1.5 text-mb-xs font-bold text-mb-text-light hover:text-mb-brand transition-colors">
            <ArrowLeft size={12} /> Back to projects
          </Link>
        </div>
        <div className="px-4 py-4 flex-1">
          <p className="mb-section-header mb-3">Workspace</p>
          <div className="space-y-0.5">
            {nav.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}
                  className={`block px-3 py-1.5 rounded-mb-md text-mb-sm transition-colors
                    ${active ? 'text-mb-brand font-black bg-mb-brand-hover' : 'text-mb-text-medium font-bold hover:text-mb-text-dark hover:bg-mb-bg-light'}`}>
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
