'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Save, Mail } from 'lucide-react'
import { SettingsShell } from '@/components/settings/SettingsShell'

export default function AccountSettingsPage() {
  const t = useTranslations()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('free')
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
      setEmail(user.email ?? '')
      setDisplayName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '')

      // Get org plan
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

  const handleSave = async () => {
    setSaving(true)
    await supabase.auth.updateUser({
      data: { full_name: displayName },
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
          <div className="h-10 rounded-mb-md mb-shimmer" />
          <div className="h-10 rounded-mb-md mb-shimmer" />
          <div className="h-10 rounded-mb-md mb-shimmer" />
        </div>
      </SettingsShell>
    )
  }

  return (
    <SettingsShell>
      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-6">Account</h1>

      {/* Display name */}
      <div className="mb-6">
        <label className="mb-label">Display name</label>
        <input
          className="mb-input"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
        />
      </div>

      {/* Email */}
      <div className="mb-6">
        <label className="mb-label">Email</label>
        <div className="mb-input bg-mb-bg-light text-mb-text-medium cursor-not-allowed flex items-center gap-2">
          <Mail size={14} className="text-mb-text-light" />
          {email}
        </div>
      </div>

      {/* Account type */}
      <div className="mb-6">
        <label className="mb-label">Account type</label>
        <div className="flex items-center gap-2 mt-1">
          <span className={`
            px-3 py-1 rounded-full text-mb-xs font-black
            ${plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
              plan === 'pro' ? 'bg-mb-brand-hover text-mb-brand' :
              'bg-mb-bg-medium text-mb-text-medium'}
          `}>
            {planLabel}
          </span>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`mb-btn-primary px-6 py-2 ${saving ? 'opacity-40' : ''}`}
      >
        <Save size={14} />
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
      </button>

      {/* Password */}
      <div className="mt-8 pt-6 border-t border-mb-border">
        <h2 className="text-mb-base font-black text-mb-text-dark mb-2">Password</h2>
        <p className="text-mb-text-medium text-mb-sm mb-4">
          We&apos;ll send a password reset link to your email.
        </p>
        <button
          onClick={handlePasswordReset}
          disabled={resetSent}
          className="mb-btn-secondary"
        >
          {resetSent ? 'Reset email sent' : 'Change password'}
        </button>
      </div>
    </SettingsShell>
  )
}
