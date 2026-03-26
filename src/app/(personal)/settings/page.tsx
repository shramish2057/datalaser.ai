'use client'
import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save, Mail, Globe } from 'lucide-react'
import { SettingsShell } from '@/components/settings/SettingsShell'
import { ImageUpload } from '@/components/ImageUpload'

const LANGUAGES = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', region: 'Deutschland' },
  { code: 'en', label: 'English', flag: '🇺🇸', region: 'United States' },
]

export default function AccountSettingsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [plan, setPlan] = useState('free')
  const [selectedLocale, setSelectedLocale] = useState(locale)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      setDisplayName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '')

      // Load avatar from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)

      const { data: membership } = await supabase
        .from('org_members')
        .select('organizations(plan)')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (membership) {
        const org = membership.organizations as unknown as { plan: string }
        setPlan(org?.plan ?? 'free')
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleAvatarChange = async (url: string | null) => {
    setAvatarUrl(url)
    if (userId) {
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await supabase.auth.updateUser({ data: { full_name: displayName } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLanguageChange = async (newLocale: string) => {
    setSelectedLocale(newLocale)
    document.cookie = `dl_locale=${newLocale};path=/;max-age=${365 * 24 * 3600}`
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ locale: newLocale }).eq('id', user.id)
      }
    } catch {}
    router.refresh()
  }

  const handlePasswordReset = async () => {
    await supabase.auth.resetPasswordForEmail(email)
    setResetSent(true)
    setTimeout(() => setResetSent(false), 5000)
  }

  const planLabel = plan === 'enterprise' ? 'Enterprise' : plan === 'pro' ? 'Pro' : 'Free'

  if (loading) {
    return (
      <SettingsShell>
        <div className="space-y-4">
          <div className="h-10 rounded-dl-md dl-shimmer" />
          <div className="h-10 rounded-dl-md dl-shimmer" />
          <div className="h-10 rounded-dl-md dl-shimmer" />
        </div>
      </SettingsShell>
    )
  }

  return (
    <SettingsShell>
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">
        {locale === 'de' ? 'Konto' : 'Account'}
      </h1>

      {/* Avatar */}
      <div className="mb-6">
        <label className="dl-label mb-2">{locale === 'de' ? 'Profilbild' : 'Profile picture'}</label>
        <ImageUpload
          value={avatarUrl}
          onChange={handleAvatarChange}
          entityType="user"
          entityId={userId}
          shape="circle"
          size="lg"
          fallback={
            <span className="text-xl font-black text-dl-text-medium">
              {displayName?.[0]?.toUpperCase() || '?'}
            </span>
          }
        />
      </div>

      {/* Display name */}
      <div className="mb-6">
        <label className="dl-label">{locale === 'de' ? 'Anzeigename' : 'Display name'}</label>
        <input className="dl-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
      </div>

      {/* Email */}
      <div className="mb-6">
        <label className="dl-label">{locale === 'de' ? 'E-Mail' : 'Email'}</label>
        <div className="dl-input bg-dl-bg-light text-dl-text-medium cursor-not-allowed flex items-center gap-2">
          <Mail size={14} className="text-dl-text-light" />
          {email}
        </div>
      </div>

      {/* Language & Region */}
      <div className="mb-6">
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
                <p className="text-dl-xs text-dl-text-light">{lang.region}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-dl-xs text-dl-text-light mt-2">
          {selectedLocale === 'de'
            ? 'Ändert Sprache, KI-Antworten, Zahlen- und Datumsformat für alle Projekte.'
            : 'Changes language, AI responses, number and date format for all projects.'}
        </p>
      </div>

      {/* Account type */}
      <div className="mb-6">
        <label className="dl-label">{locale === 'de' ? 'Kontotyp' : 'Account type'}</label>
        <div className="flex items-center gap-2 mt-1">
          <span className={`px-3 py-1 rounded-full text-dl-xs font-black
            ${plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
              plan === 'pro' ? 'bg-dl-brand-hover text-dl-brand' :
              'bg-dl-bg-medium text-dl-text-medium'}`}>
            {planLabel}
          </span>
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className={`dl-btn-primary px-6 py-2 ${saving ? 'opacity-40' : ''}`}>
        <Save size={14} />
        {saving ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
      </button>

      {/* Password */}
      <div className="mt-8 pt-6 border-t border-dl-border">
        <h2 className="text-dl-base font-black text-dl-text-dark mb-2">
          {locale === 'de' ? 'Passwort' : 'Password'}
        </h2>
        <p className="text-dl-text-medium text-dl-sm mb-4">
          {locale === 'de'
            ? 'Wir senden einen Link zum Zurücksetzen des Passworts an Ihre E-Mail.'
            : "We'll send a password reset link to your email."}
        </p>
        <button onClick={handlePasswordReset} disabled={resetSent} className="dl-btn-secondary">
          {resetSent
            ? (locale === 'de' ? 'E-Mail gesendet' : 'Reset email sent')
            : (locale === 'de' ? 'Passwort ändern' : 'Change password')}
        </button>
      </div>
    </SettingsShell>
  )
}
