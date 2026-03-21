'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import StepIndicator from '@/components/onboarding/StepIndicator'

const ROLES = ['Founder / CEO', 'CFO / Finance', 'CMO / Marketing', 'Head of Product', 'Operations', 'Developer']
const INDUSTRIES = ['E-commerce', 'SaaS', 'Agency', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Other']

export default function SetupPage() {
  const [workspaceName, setWorkspaceName] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const handleContinue = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        workspace_name: workspaceName || 'My Workspace',
        role,
        industry,
      })
    }
    router.push('/connect')
  }

  return (
    <div className="max-w-lg mx-auto pt-16 px-6">
      <StepIndicator current={1} labels={['Workspace', 'Connect', 'Calibrate']} />

      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">Set up your workspace</h1>
      <p className="text-mb-text-medium text-mb-base mb-8">
        Help DataLaser calibrate AI insights for your business.
      </p>

      {/* Workspace name */}
      <div className="mb-6">
        <label className="mb-label">Workspace name</label>
        <input
          className="mb-input"
          value={workspaceName}
          onChange={e => setWorkspaceName(e.target.value)}
          placeholder="Acme Corp"
        />
      </div>

      {/* Role */}
      <div className="mb-4">
        <label className="mb-label">Your role</label>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`
                border rounded-mb-md px-4 py-2.5
                text-mb-sm font-bold cursor-pointer transition-all text-left
                ${role === r
                  ? 'border-mb-brand text-mb-brand bg-mb-brand-hover'
                  : 'border-mb-border-dark text-mb-text-medium hover:border-mb-brand hover:text-mb-brand hover:bg-mb-brand-hover'}
              `}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Industry */}
      <div className="mt-4">
        <label className="mb-label">Industry</label>
        <div className="grid grid-cols-2 gap-2">
          {INDUSTRIES.map(ind => (
            <button
              key={ind}
              onClick={() => setIndustry(ind)}
              className={`
                border rounded-mb-md px-4 py-2.5
                text-mb-sm font-bold cursor-pointer transition-all text-left
                ${industry === ind
                  ? 'border-mb-brand text-mb-brand bg-mb-brand-hover'
                  : 'border-mb-border-dark text-mb-text-medium hover:border-mb-brand hover:text-mb-brand hover:bg-mb-brand-hover'}
              `}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Continue */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!role || !industry || loading}
          className={`mb-btn-primary px-6 py-2 ${!role || !industry || loading ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Saving...' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
