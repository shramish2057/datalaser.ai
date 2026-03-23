'use client'
import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save, Trash2, Globe } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProjectIconPicker } from '@/components/ProjectIconPicker'

const COLORS = ['#7C3AED','#4A9EDA','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

const LANGUAGES = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', region: 'Deutschland' },
  { code: 'en', label: 'English', flag: '🇺🇸', region: 'United States' },
]

export default function ProjectSettingsPage() {
  const t = useTranslations()
  const currentLocale = useLocale()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('bar-chart')
  const [color, setColor] = useState('#7C3AED')
  const [selectedLocale, setSelectedLocale] = useState(currentLocale)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('name, description, icon, color')
        .eq('id', projectId)
        .single()
      if (data) {
        setName(data.name)
        setDescription(data.description ?? '')
        setIcon(data.icon)
        setColor(data.color)
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('projects')
      .update({ name, description: description || null, icon, color })
      .eq('id', projectId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    window.dispatchEvent(new CustomEvent('project-updated'))
  }

  const handleLanguageChange = async (newLocale: string) => {
    setSelectedLocale(newLocale)
    // Update cookie
    document.cookie = `dl_locale=${newLocale};path=/;max-age=${365 * 24 * 3600}`
    // Update profile in Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ locale: newLocale }).eq('id', user.id)
      }
    } catch {}
    // Refresh page to apply
    router.refresh()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('projects').delete().eq('id', projectId)
    router.push('/projects')
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="h-10 rounded-dl-md dl-shimmer" />
        <div className="h-20 rounded-dl-md dl-shimmer" />
        <div className="h-10 rounded-dl-md dl-shimmer" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">{t('settings.title')}</h1>

      {/* Name */}
      <div className="mb-6">
        <label className="dl-label">{t('settings.projectName')}</label>
        <input className="dl-input" value={name} onChange={e => setName(e.target.value)} />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="dl-label">{t('settings.projectDescription')}</label>
        <textarea
          className="dl-input min-h-[80px] resize-none"
          placeholder={t('settings.projectDescription')}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* Icon */}
      <div className="mb-6">
        <label className="dl-label">{t('settings.icon')}</label>
        <ProjectIconPicker value={icon} color={color} onChange={setIcon} />
      </div>

      {/* Color */}
      <div className="mb-6">
        <label className="dl-label">{t('settings.color')}</label>
        <div className="flex gap-2 mt-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-dl-text-dark scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      {/* Language & Region */}
      <div className="mb-8">
        <label className="dl-label flex items-center gap-1.5">
          <Globe size={12} /> {t('settings.language')}
        </label>
        <div className="flex gap-2 mt-2">
          {LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => handleLanguageChange(lang.code)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-dl-md border transition-all ${
                selectedLocale === lang.code
                  ? 'border-dl-brand bg-dl-brand-hover ring-1 ring-dl-brand'
                  : 'border-dl-border hover:border-dl-brand'
              }`}>
              <span className="text-[18px]">{lang.flag}</span>
              <div className="text-left">
                <p className={`text-[13px] font-bold ${selectedLocale === lang.code ? 'text-dl-brand' : 'text-dl-text-dark'}`}>
                  {lang.label}
                </p>
                <p className="text-[11px] text-dl-text-light">{lang.region}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-dl-text-light mt-2">
          {selectedLocale === 'de'
            ? 'Alle Oberflächen, KI-Antworten und Zahlenformate werden auf Deutsch angezeigt.'
            : 'All UI, AI responses, and number formats will be displayed in English.'}
        </p>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving || !name.trim()}
        className={`dl-btn-primary px-6 py-2 ${saving || !name.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}>
        <Save size={14} />
        {saving ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
      </button>

      {/* Danger zone */}
      <div className="mt-12 pt-6 border-t border-dl-border">
        <h2 className="text-dl-base font-black text-dl-error mb-2">{t('settings.dangerZone')}</h2>
        <p className="text-dl-text-medium text-dl-sm mb-4">
          {selectedLocale === 'de'
            ? 'Das Löschen eines Projekts entfernt alle Datenquellen, Analysen und Gespräche. Dies kann nicht rückgängig gemacht werden.'
            : 'Deleting a project removes all its data sources, insights, and conversations. This cannot be undone.'}
        </p>
        <button onClick={() => setDeleteOpen(true)} className="dl-btn-danger px-4 py-2">
          <Trash2 size={14} />
          {t('settings.deleteProject')}
        </button>
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-dl-bg border border-dl-border rounded-dl-lg shadow-dl-lg p-0 max-w-md">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-dl-xl font-black text-dl-text-dark">
              {t('settings.deleteProject')}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4">
            <p className="text-dl-text-medium text-dl-sm mb-4">
              {selectedLocale === 'de'
                ? <>Geben Sie <span className="font-black text-dl-text-dark">{name}</span> ein, um das Löschen zu bestätigen.</>
                : <>Type <span className="font-black text-dl-text-dark">{name}</span> to confirm deletion.</>}
            </p>
            <input className="dl-input mb-4" placeholder={t('settings.projectName') + '...'} value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)} className="dl-btn-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={handleDelete} disabled={deleteConfirm !== name || deleting}
                className={`dl-btn-danger px-4 ${deleteConfirm !== name || deleting ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {deleting ? t('common.delete') + '...' : t('settings.deleteProject')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
