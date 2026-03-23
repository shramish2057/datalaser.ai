'use client'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { Key } from 'lucide-react'
import { OrgSettingsShell } from '@/components/settings/OrgSettingsShell'

export default function OrgApiKeysPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string

  return (
    <OrgSettingsShell orgSlug={orgSlug}>
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-2">API Keys</h1>
      <p className="text-dl-text-medium text-dl-sm mb-6">Use API keys to access DataLaser data from external tools, scripts, or integrations.</p>
      <div className="dl-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-dl-bg-medium flex items-center justify-center mx-auto mb-3"><Key size={20} className="text-dl-text-light" /></div>
        <p className="text-dl-text-dark text-dl-sm font-bold">API access coming soon</p>
        <p className="text-dl-text-medium text-dl-xs mt-1 max-w-sm mx-auto">We&apos;re building the API so you can query your data from scripts, notebooks, and external tools.</p>
      </div>
    </OrgSettingsShell>
  )
}
