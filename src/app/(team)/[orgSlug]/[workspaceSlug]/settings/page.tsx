'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save } from 'lucide-react'
import { WsSettingsShell } from '@/components/settings/WsSettingsShell'

const COLORS = ['#7C3AED','#4A9EDA','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

export default function WorkspaceSettingsPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💼')
  const [color, setColor] = useState('#7C3AED')
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
      if (ws) { setName(ws.name); setIcon(ws.icon); setColor(ws.color); setWsId(ws.id) }
      setLoading(false)
    }
    load()
  }, [orgSlug, workspaceSlug])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({ name, icon, color }).eq('id', wsId)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <WsSettingsShell orgSlug={orgSlug} workspaceSlug={workspaceSlug}>
      {loading ? <div className="space-y-4"><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /></div> : <>
        <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">Workspace Settings</h1>
        <div className="mb-6"><label className="dl-label">Workspace name</label><input className="dl-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="mb-6"><label className="dl-label">Icon</label><input className="dl-input w-20" value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} /></div>
        <div className="mb-8"><label className="dl-label">Color</label><div className="flex gap-2 mt-1">{COLORS.map(c => (<button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-dl-text-dark scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div></div>
        <button onClick={handleSave} disabled={saving || !name.trim()} className={`dl-btn-primary px-6 py-2 ${saving || !name.trim() ? 'opacity-40' : ''}`}><Save size={14} />{saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}</button>
      </>}
    </WsSettingsShell>
  )
}
