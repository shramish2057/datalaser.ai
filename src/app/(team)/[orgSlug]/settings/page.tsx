'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save } from 'lucide-react'
import { OrgSettingsShell } from '@/components/settings/OrgSettingsShell'

export default function OrgSettingsPage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const [name, setName] = useState('')
  const [orgType, setOrgType] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('organizations').select('name, type').eq('slug', orgSlug).single()
      if (data) { setName(data.name); setOrgType(data.type) }
      setLoading(false)
    }
    load()
  }, [orgSlug])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('organizations').update({ name }).eq('slug', orgSlug)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <OrgSettingsShell orgSlug={orgSlug}>
      {loading ? <div className="space-y-4"><div className="h-10 rounded-mb-md mb-shimmer" /><div className="h-10 rounded-mb-md mb-shimmer" /></div> : <>
        <h1 className="text-mb-2xl font-black text-mb-text-dark mb-6">Organization Settings</h1>
        <div className="mb-6"><label className="mb-label">Organization name</label><input className="mb-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="mb-6"><label className="mb-label">Type</label><div className="mt-1"><span className={`px-3 py-1 rounded-full text-mb-xs font-black ${orgType === 'team' ? 'bg-mb-brand-hover text-mb-brand' : 'bg-mb-bg-medium text-mb-text-medium'}`}>{orgType === 'team' ? 'Team' : 'Personal'}</span></div></div>
        <button onClick={handleSave} disabled={saving || !name.trim()} className={`mb-btn-primary px-6 py-2 ${saving || !name.trim() ? 'opacity-40' : ''}`}><Save size={14} />{saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}</button>
      </>}
    </OrgSettingsShell>
  )
}
