'use client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { ProjectIconPicker } from '@/components/ProjectIconPicker'

const COLORS = ['#4A9EDA','#84BB4C','#F9CF48','#ED6E6E','#A989C5','#F1B556','#98D9D9','#7172AD']

export default function ProjectPage() {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('bar-chart')
  const [color, setColor] = useState('#4A9EDA')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    try {
      const onboarding = JSON.parse(localStorage.getItem('datalaser_onboarding') || '{}')

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: onboarding.name,
          mode: onboarding.mode,
          orgName: onboarding.orgName,
          workspaceName: onboarding.workspaceName,
          projectName: name.trim(),
          projectIcon: icon,
          projectColor: color,
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Store project context for connect page
      localStorage.setItem('datalaser_project_context', JSON.stringify({
        projectId: data.project.id,
        orgSlug: data.org.slug,
        workspaceSlug: data.workspace.slug,
        projectSlug: data.project.slug,
        isPersonal: data.org.type === 'personal',
      }))

      router.push(`/projects/${data.project.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto pt-16 px-6">
      <StepIndicator current={2} labels={['You', 'Project', 'Data']} />

      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">
        Create your first project
      </h1>
      <p className="text-dl-text-medium text-dl-base mb-10">
        A project holds your data sources, insights, and dashboards.
        You can create more later.
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
        <button onClick={() => router.back()} className="dl-btn-secondary px-6">
          &larr; Back
        </button>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || loading}
          className={`dl-btn-primary flex-1 py-2.5 font-black justify-center
            ${(!name.trim() || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Creating...' : 'Create Project →'}
        </button>
      </div>
    </div>
  )
}
