'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save } from 'lucide-react'
import { WsSettingsShell } from '@/components/settings/WsSettingsShell'
import { ImageUpload } from '@/components/ImageUpload'

const COLORS = ['#191919','#4A9EDA','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

export default function WorkspaceSettingsPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💼')
  const [color, setColor] = useState('#191919')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [wsId, setWsId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function load() {
      const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single()
      if (!org) return
      const { data: ws } = await supabase.from('workspaces').select('*').eq('org_id', org.id).eq('slug', workspaceSlug).single()
      if (ws) {
        setName(ws.name)
        setIcon(ws.icon)
        setColor(ws.color)
        setLogoUrl(ws.logo_url || null)
        setWsId(ws.id)
      }
      setLoading(false)
    }
    load()
  }, [orgSlug, workspaceSlug])

  const handleLogoChange = async (url: string | null) => {
    setLogoUrl(url)
    if (wsId) {
      await supabase.from('workspaces').update({ logo_url: url }).eq('id', wsId)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({ name, icon, color }).eq('id', wsId)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <WsSettingsShell orgSlug={orgSlug} workspaceSlug={workspaceSlug}>
      {loading ? <div className="space-y-4"><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /></div> : <>
        <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">{t('teams.settings')}</h1>

        {/* Team logo */}
        <div className="mb-6">
          <label className="dl-label mb-2">Logo</label>
          <ImageUpload
            value={logoUrl}
            onChange={handleLogoChange}
            entityType="workspace"
            entityId={wsId}
            shape="rounded"
            size="lg"
            fallback={
              <span className="text-xl">{icon || '💼'}</span>
            }
          />
        </div>

        <div className="mb-6">
          <label className="dl-label">{t('teams.settingsName')}</label>
          <input className="dl-input" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="mb-6">
          <label className="dl-label">{t('teams.icon')}</label>
          <input className="dl-input w-20" value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} />
        </div>

        <div className="mb-8">
          <label className="dl-label">{t('teams.color')}</label>
          <div className="flex gap-2 mt-1">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-dl-text-dark scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !name.trim()} className={`dl-btn-primary px-6 py-2 ${saving || !name.trim() ? 'opacity-40' : ''}`}>
          <Save size={14} />{saving ? t('teams.saving') : saved ? t('teams.saved') : t('teams.save')}
        </button>
      </>}
    </WsSettingsShell>
  )
}
