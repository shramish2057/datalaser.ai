'use client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { Users, User } from 'lucide-react'

export default function SetupPage() {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'personal' | 'team' | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleContinue = async () => {
    if (!name.trim() || !mode) return
    setLoading(true)

    // Store in localStorage for next steps to use
    localStorage.setItem('datalaser_onboarding', JSON.stringify({
      name: name.trim(),
      mode,
    }))

    if (mode === 'personal') {
      router.push('/onboarding/project')
    } else {
      router.push('/onboarding/org')
    }
  }

  return (
    <div className="max-w-lg mx-auto pt-16 px-6">
      <StepIndicator current={1} labels={['You', 'Project', 'Data']} />

      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">
        {t('onboarding.welcome')}
      </h1>
      <p className="text-dl-text-medium text-dl-base mb-10">
        {t('onboarding.setupSubtitle')}
      </p>

      <div className="mb-6">
        <label className="dl-label">{t('onboarding.yourName')}</label>
        <input
          className="dl-input"
          placeholder={t("onboarding.fullName")}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="mb-10">
        <label className="dl-label">{t('onboarding.howUsing')}</label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => setMode('personal')}
            className={`
              p-4 rounded-dl-lg border text-left transition-all
              ${mode === 'personal'
                ? 'border-dl-brand bg-dl-brand-hover'
                : 'border-dl-border-dark hover:border-dl-brand'}
            `}
          >
            <User size={20} className={`mb-2 ${mode === 'personal' ? 'text-dl-brand' : 'text-dl-text-light'}`} />
            <div className="text-dl-sm font-black text-dl-text-dark">{t('onboarding.justMe')}</div>
            <div className="text-dl-xs text-dl-text-light mt-0.5">
              {t('onboarding.justMeDesc')}
            </div>
          </button>

          <button
            onClick={() => setMode('team')}
            className={`
              p-4 rounded-dl-lg border text-left transition-all
              ${mode === 'team'
                ? 'border-dl-brand bg-dl-brand-hover'
                : 'border-dl-border-dark hover:border-dl-brand'}
            `}
          >
            <Users size={20} className={`mb-2 ${mode === 'team' ? 'text-dl-brand' : 'text-dl-text-light'}`} />
            <div className="text-dl-sm font-black text-dl-text-dark">{t('onboarding.myTeam')}</div>
            <div className="text-dl-xs text-dl-text-light mt-0.5">
              {t('onboarding.myTeamDesc')}
            </div>
          </button>
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!name.trim() || !mode || loading}
        className={`dl-btn-primary w-full py-2.5 text-dl-base font-black justify-center
          ${(!name.trim() || !mode || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {loading ? t('onboarding.settingUp') : t('onboarding.continueArrow')}
      </button>
    </div>
  )
}
