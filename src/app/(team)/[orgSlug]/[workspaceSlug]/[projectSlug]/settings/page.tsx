'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectIconPicker } from '@/components/ProjectIconPicker'
import { useTeamProjectContext } from '@/lib/teamContext'

const COLORS = ['#191919','#4A9EDA','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

export default function TeamProjectSettingsPage() {
  const t = useTranslations()
  const { projectId, wsBase } = useTeamProjectContext()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('bar-chart')
  const [color, setColor] = useState('#191919')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    if (!projectId) return
    async function load() {
      const { data } = await supabase.from('projects').select('name, description, icon, color').eq('id', projectId).single()
      if (data) { setName(data.name); setDescription(data.description ?? ''); setIcon(data.icon); setColor(data.color) }
      setLoading(false)
    }
    load()
  }, [projectId])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('projects').update({ name, description: description || null, icon, color }).eq('id', projectId)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
    window.dispatchEvent(new CustomEvent('project-updated'))
  }

  const handleDelete = async () => { setDeleting(true); await supabase.from('projects').delete().eq('id', projectId); router.push(wsBase) }

  if (loading) return <div className="max-w-2xl mx-auto px-6 py-8 space-y-4"><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-20 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /></div>

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">Project Settings</h1>
      <div className="mb-6"><label className="dl-label">{t("common.projectName")}</label><input className="dl-input" value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="mb-6"><label className="dl-label">{t("common.description")}</label><textarea className="dl-input min-h-[80px] resize-none" placeholder={t("settings.projectDescription")} value={description} onChange={e => setDescription(e.target.value)} /></div>
      <div className="mb-6"><label className="dl-label">Icon</label><ProjectIconPicker value={icon} color={color} onChange={setIcon} /></div>
      <div className="mb-8"><label className="dl-label">Color</label><div className="flex gap-2 mt-1">{COLORS.map(c => (<button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-dl-text-dark scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div></div>
      <button onClick={handleSave} disabled={saving || !name.trim()} className={`dl-btn-primary px-6 py-2 ${saving || !name.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}><Save size={14} />{saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}</button>
      <div className="mt-12 pt-6 border-t border-dl-border">
        <h2 className="text-dl-base font-black text-dl-error mb-2">Danger zone</h2>
        <p className="text-dl-text-medium text-dl-sm mb-4">Deleting a project removes all its data sources, insights, and conversations. This cannot be undone.</p>
        <button onClick={() => setDeleteOpen(true)} className="dl-btn-danger px-4 py-2"><Trash2 size={14} /> Delete project</button>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-dl-bg border border-dl-border rounded-dl-lg shadow-dl-lg p-0 max-w-md">
          <DialogHeader className="p-6 pb-0"><DialogTitle className="text-dl-xl font-black text-dl-text-dark">Delete project</DialogTitle></DialogHeader>
          <div className="p-6 pt-4">
            <p className="text-dl-text-medium text-dl-sm mb-4">Type <span className="font-black text-dl-text-dark">{name}</span> to confirm deletion.</p>
            <input className="dl-input mb-4" placeholder={t("settings.projectName") + "..."} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)} className="dl-btn-secondary">{t("common.cancel")}</button>
              <button onClick={handleDelete} disabled={deleteConfirm !== name || deleting} className={`dl-btn-danger px-4 ${deleteConfirm !== name || deleting ? 'opacity-40 cursor-not-allowed' : ''}`}>{deleting ? 'Deleting...' : 'Delete permanently'}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
