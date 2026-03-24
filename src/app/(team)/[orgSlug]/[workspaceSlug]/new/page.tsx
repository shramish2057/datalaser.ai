'use client'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/Logo'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { ProjectIconPicker } from '@/components/ProjectIconPicker'

const COLORS = ['#191919','#4A9EDA','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

export default function TeamNewProjectPage() {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('bar-chart')
  const [color, setColor] = useState('#191919')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wsId, setWsId] = useState('')
  const [orgId, setOrgId] = useState('')
  const router = useRouter()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string
  const wsBase = `/${orgSlug}/${workspaceSlug}`

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function resolve() {
      const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single()
      if (!org) return
      setOrgId(org.id)
      const { data: ws } = await supabase.from('workspaces').select('id').eq('org_id', org.id).eq('slug', workspaceSlug).single()
      if (ws) setWsId(ws.id)
    }
    resolve()
  }, [orgSlug, workspaceSlug])

  const handleCreate = async () => {
    if (!name.trim() || !wsId || !orgId) return
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
      const { data: project, error: createError } = await supabase.from('projects').insert({ workspace_id: wsId, org_id: orgId, name: name.trim(), slug, icon, color, created_by: user.id }).select().single()
      if (createError || !project) throw new Error(createError?.message ?? 'Failed to create project')
      router.push(`${wsBase}/${project.slug}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-dl-bg-light font-sans">
      <div className="bg-dl-bg border-b border-dl-border h-[72px] flex items-center px-8">
        <Link href={wsBase} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
          <span className="font-black text-dl-lg text-dl-text-dark">DataLaser</span>
        </Link>
      </div>
      <div className="max-w-lg mx-auto pt-16 px-6">
        <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">New Project</h1>
        <p className="text-dl-text-medium text-dl-base mb-10">A project holds your data sources, insights, and dashboards.</p>
        {error && <div className="px-3 py-2 rounded-dl-md bg-red-50 border border-dl-error text-dl-error text-dl-sm font-bold mb-4">{error}</div>}
        <div className="mb-6"><label className="dl-label">{t("common.projectName")}</label><input className="dl-input" placeholder={t("settings.projectName")} value={name} onChange={e => setName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} /></div>
        <div className="mb-6"><label className="dl-label">Icon</label><ProjectIconPicker value={icon} color={color} onChange={setIcon} /></div>
        <div className="mb-10"><label className="dl-label">Color</label><div className="flex gap-2 mt-1">{COLORS.map(c => (<button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-dl-text-dark scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div></div>
        <div className="flex gap-3">
          <Link href={wsBase} className="dl-btn-secondary px-6 flex items-center">Cancel</Link>
          <button onClick={handleCreate} disabled={!name.trim() || loading} className={`dl-btn-primary flex-1 py-2.5 font-black justify-center ${(!name.trim() || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}>{loading ? 'Creating...' : 'Create Project'}</button>
        </div>
      </div>
    </div>
  )
}
