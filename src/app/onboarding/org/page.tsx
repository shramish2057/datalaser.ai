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

      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">
        {t('onboarding.setupOrg')}
      </h1>
      <p className="text-dl-text-medium text-dl-base mb-10">
        {t('onboarding.setupOrgDesc')}
      </p>

      <div className="mb-6">
        <label className="dl-label">{t('onboarding.orgName')}</label>
        <input
          className="dl-input"
          placeholder={t("onboarding.fullName")}
          value={orgName}
          onChange={e => setOrgName(e.target.value)}
          autoFocus
        />
        <p className="text-dl-xs text-dl-text-light mt-1">
          {t('onboarding.orgNameHelp')}
        </p>
      </div>

      <div className="mb-10">
        <label className="dl-label">{t('onboarding.workspaceName')}</label>
        <input
          className="dl-input"
          placeholder={t("settings.general")}
          value={workspaceName}
          onChange={e => setWorkspaceName(e.target.value)}
        />
        <p className="text-dl-xs text-dl-text-light mt-1">
          {t('onboarding.workspaceHelp')}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="dl-btn-secondary px-6"
        >
          {t('onboarding.back')}
        </button>
        <button
          onClick={handleContinue}
          disabled={!orgName.trim()}
          className={`dl-btn-primary flex-1 py-2.5 font-black justify-center
            ${!orgName.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {t('onboarding.continueArrow')}
        </button>
      </div>
    </div>
  )
}
