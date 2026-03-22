'use client'

import { Key } from 'lucide-react'
import { SettingsShell } from '@/components/settings/SettingsShell'

export default function ApiKeysPage() {
  return (
    <SettingsShell>
      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-2">API Keys</h1>
      <p className="text-mb-text-medium text-mb-sm mb-6">
        Use API keys to access DataLaser data from external tools, scripts, or integrations.
      </p>

      <div className="mb-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-mb-bg-medium flex items-center justify-center mx-auto mb-3">
          <Key size={20} className="text-mb-text-light" />
        </div>
        <p className="text-mb-text-dark text-mb-sm font-bold">API access coming soon</p>
        <p className="text-mb-text-medium text-mb-xs mt-1 max-w-sm mx-auto">
          We&apos;re building the API so you can query your data from scripts, notebooks, and external tools. This will be available in an upcoming release.
        </p>
      </div>
    </SettingsShell>
  )
}
