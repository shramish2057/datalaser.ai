'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save } from 'lucide-react'
import { OrgSettingsShell } from '@/components/settings/OrgSettingsShell'
import { ImageUpload } from '@/components/ImageUpload'

export default function OrgSettingsPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [orgType, setOrgType] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('organizations').select('id, name, type, logo_url').eq('slug', orgSlug).single()
      if (data) {
        setOrgId(data.id)
        setName(data.name)
        setOrgType(data.type)
        setLogoUrl(data.logo_url)
      }
      setLoading(false)
    }
    load()
  }, [orgSlug])

  const handleLogoChange = async (url: string | null) => {
    setLogoUrl(url)
    if (orgId) {
      await supabase.from('organizations').update({ logo_url: url }).eq('id', orgId)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('organizations').update({ name }).eq('id', orgId)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <OrgSettingsShell orgSlug={orgSlug}>
      {loading ? <div className="space-y-4"><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /></div> : <>
        <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">{t('nav.settings')}</h1>

        {/* Logo */}
        <div className="mb-6">
          <label className="dl-label mb-2">Logo</label>
          <ImageUpload
            value={logoUrl}
            onChange={handleLogoChange}
            entityType="org"
            entityId={orgId}
            shape="rounded"
            size="lg"
            fallback={
              <span className="text-xl font-black text-dl-text-medium">
                {name?.[0]?.toUpperCase() || '?'}
              </span>
            }
          />
        </div>

        <div className="mb-6">
          <label className="dl-label">{t('onboarding.orgName')}</label>
          <input className="dl-input" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="mb-6">
          <label className="dl-label">{t("common.type")}</label>
          <div className="mt-1">
            <span className={`px-3 py-1 rounded-full text-dl-xs font-black ${orgType === 'team' ? 'bg-dl-brand-hover text-dl-brand' : 'bg-dl-bg-medium text-dl-text-medium'}`}>
              {orgType === 'team' ? 'Team' : 'Personal'}
            </span>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !name.trim()} className={`dl-btn-primary px-6 py-2 ${saving || !name.trim() ? 'opacity-40' : ''}`}>
          <Save size={14} />{saving ? t('teams.saving') : saved ? t('teams.saved') : t('teams.save')}
        </button>
      </>}
    </OrgSettingsShell>
  )
}
