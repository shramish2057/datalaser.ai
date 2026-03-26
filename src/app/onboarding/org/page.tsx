'use client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/onboarding/StepIndicator'

export default function OrgPage() {
  const t = useTranslations()
  const [orgName, setOrgName] = useState('')
  const [teamName, setTeamName] = useState('General')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCreate = async () => {
    if (!orgName.trim()) return
    setLoading(true)
    setError('')

    try {
      const onboarding = JSON.parse(localStorage.getItem('datalaser_onboarding') || '{}')

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: onboarding.name,
          mode: 'team',
          orgName: orgName.trim(),
          workspaceName: teamName.trim() || 'General',
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      localStorage.removeItem('datalaser_onboarding')

      // Go straight to org home → user sees their team → clicks to create first project
      router.push(`/${data.org.slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto pt-16 px-6">
      <StepIndicator current={1} labels={['You', 'Organization', 'Done']} />

      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">
        {t('onboarding.setupOrg')}
      </h1>
      <p className="text-dl-text-medium text-dl-base mb-10">
        {t('onboarding.setupOrgDesc')}
      </p>

      {error && (
        <div className="px-3 py-2 rounded-dl-md bg-red-50 border border-dl-error text-dl-error text-dl-sm font-bold mb-4">
          {error}
        </div>
      )}

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
        <label className="dl-label">{t('onboarding.teamName')}</label>
        <input
          className="dl-input"
          placeholder={t("teams.teamNamePlaceholder")}
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
        />
        <p className="text-dl-xs text-dl-text-light mt-1">
          {t('onboarding.teamHelp')}
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
          onClick={handleCreate}
          disabled={!orgName.trim() || loading}
          className={`dl-btn-primary flex-1 py-2.5 font-black justify-center
            ${(!orgName.trim() || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {loading ? t('onboarding.settingUp') : t('onboarding.continueArrow')}
        </button>
      </div>
    </div>
  )
}
