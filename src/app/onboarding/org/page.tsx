'use client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/onboarding/StepIndicator'

export default function OrgPage() {
  const t = useTranslations()
  const [orgName, setOrgName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('General')
  const router = useRouter()

  const handleContinue = () => {
    if (!orgName.trim()) return
    const existing = JSON.parse(localStorage.getItem('datalaser_onboarding') || '{}')
    localStorage.setItem('datalaser_onboarding', JSON.stringify({
      ...existing,
      orgName: orgName.trim(),
      workspaceName: workspaceName.trim() || 'General',
    }))
    router.push('/onboarding/project')
  }

  return (
    <div className="max-w-lg mx-auto pt-16 px-6">
      <StepIndicator current={1} labels={['You', 'Project', 'Data']} />

      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">
        Set up your organization
      </h1>
      <p className="text-mb-text-medium text-mb-base mb-10">
        This is your company or team&apos;s shared DataLaser account.
      </p>

      <div className="mb-6">
        <label className="mb-label">Organization name</label>
        <input
          className="mb-input"
          placeholder="Acme Corp"
          value={orgName}
          onChange={e => setOrgName(e.target.value)}
          autoFocus
        />
        <p className="text-mb-xs text-mb-text-light mt-1">
          This is your company name. You can change it later.
        </p>
      </div>

      <div className="mb-10">
        <label className="mb-label">First workspace name</label>
        <input
          className="mb-input"
          placeholder="General"
          value={workspaceName}
          onChange={e => setWorkspaceName(e.target.value)}
        />
        <p className="text-mb-xs text-mb-text-light mt-1">
          Think of workspaces as departments or teams. e.g. Marketing, Finance, Product.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="mb-btn-secondary px-6"
        >
          &larr; Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!orgName.trim()}
          className={`mb-btn-primary flex-1 py-2.5 font-black justify-center
            ${!orgName.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Continue &rarr;
        </button>
      </div>
    </div>
  )
}
