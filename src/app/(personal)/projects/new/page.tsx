'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { ProjectIconPicker } from '@/components/ProjectIconPicker'

const COLORS = ['#4A9EDA','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

export default function NewProjectPage() {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('bar-chart')
  const [color, setColor] = useState('#4A9EDA')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get existing org + workspace membership
      const { data: wsMembership } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(org_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!wsMembership) {
        throw new Error('No workspace found. Complete onboarding first.')
      }

      const workspaceId = wsMembership.workspace_id
      const orgId = (wsMembership.workspaces as unknown as { org_id: string }).org_id

      // Create project via server action
      const slug = name.trim().toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Math.random().toString(36).slice(2, 6)

      const { data: project, error: createError } = await supabase
        .from('projects')
        .insert({
          workspace_id: workspaceId,
          org_id: orgId,
          name: name.trim(),
          slug,
          icon,
          color,
          created_by: user.id,
        })
        .select()
        .single()

      if (createError || !project) {
        throw new Error(createError?.message ?? 'Failed to create project')
      }

      router.push(`/projects/${project.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto"><div className="max-w-lg mx-auto pt-16 px-6">
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">
        New Project
      </h1>
      <p className="text-dl-text-medium text-dl-base mb-10">
        A project holds your data sources, insights, and dashboards.
      </p>

      {error && (
        <div className="px-3 py-2 rounded-dl-md bg-red-50 border border-dl-error text-dl-error text-dl-sm font-bold mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="dl-label">{t("common.projectName")}</label>
        <input
          className="dl-input"
          placeholder={t("settings.projectName")}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
      </div>

      <div className="mb-6">
        <label className="dl-label">Icon</label>
        <ProjectIconPicker value={icon} color={color} onChange={setIcon} />
      </div>

      <div className="mb-10">
        <label className="dl-label">Color</label>
        <div className="flex gap-2 mt-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`
                w-8 h-8 rounded-full border-2 transition-all
                ${color === c ? 'border-dl-text-dark scale-110' : 'border-transparent'}
              `}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/projects" className="dl-btn-secondary px-6 flex items-center">
          Cancel
        </Link>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || loading}
          className={`dl-btn-primary flex-1 py-2.5 font-black justify-center
            ${(!name.trim() || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </div></div>
  )
}
