'use client'
import { useTranslations, useLocale } from 'next-intl'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

export default function LoginPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/projects')
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-6">
          <span className="text-dl-brand font-black text-2xl">▲</span>
          <span className="font-black text-dl-2xl text-dl-text-dark">DataLaser</span>
        </div>
        <h1 className="text-dl-xl font-bold text-dl-text-dark mb-1">{t('auth.signInTitle')}</h1>
        <p className="text-dl-text-medium text-dl-sm">{t('auth.signInSubtitle')}</p>
      </div>

      <div className="dl-card p-6">
        {error && (
          <div className="mb-4 px-3 py-2 rounded-dl-md bg-red-50 border border-dl-error text-dl-error text-dl-sm font-bold">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="dl-label">{t('auth.emailLabel')}</label>
          <input className="dl-input" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} />
        </div>

        <div className="mb-4">
          <label className="dl-label">{t('common.password')}</label>
          <input className="dl-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        <button onClick={handleLogin} disabled={loading}
          className={`dl-btn-primary w-full justify-center py-2 text-dl-base ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}>
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-dl-border" />
          <span className="text-dl-text-light text-dl-xs font-bold">{t('auth.or')}</span>
          <div className="flex-1 h-px bg-dl-border" />
        </div>

        <button onClick={handleGoogle}
          className="dl-btn-secondary w-full justify-center py-2 text-dl-base">
          <svg width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('auth.signInGoogle')}
        </button>
      </div>

      <p className="text-center text-dl-sm text-dl-text-medium mt-4">
        {t('auth.noAccount')}{' '}
        <Link href="/en/signup" className="text-dl-brand font-bold hover:text-dl-brand-dark">
          {t('auth.createOne')}
        </Link>
      </p>
    </div>
  )
}
