'use client'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Layers, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Organization, Workspace } from '@/types/database'

export default function OrgHomePage() {
  const t = useTranslations()
  const [org, setOrg] = useState<Organization | null>(null)
  const [workspaces, setWorkspaces] = useState<(Workspace & { projectCount: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const params = useParams()
  const orgSlug = params.orgSlug as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: o } = await supabase
        .from('organizations').select('*').eq('slug', orgSlug).single()
      if (!o) { router.push('/projects'); return }
      setOrg(o)

      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)

      if (memberships && memberships.length > 0) {
        const wsIds = memberships.map(m => m.workspace_id)
        const { data: wsList } = await supabase
          .from('workspaces').select('*').eq('org_id', o.id).in('id', wsIds)
          .order('created_at', { ascending: true })

        const withCounts = await Promise.all((wsList ?? []).map(async ws => {
          const { count } = await supabase
            .from('projects').select('*', { count: 'exact', head: true })
            .eq('workspace_id', ws.id)
          return { ...ws, projectCount: count ?? 0 }
        }))

        setWorkspaces(withCounts)
      }

      setLoading(false)
    }
    load()
  }, [orgSlug])

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !org) return
    setCreating(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const slug = newTeamName.trim().toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const { data: ws, error } = await supabase
      .from('workspaces')
      .insert({
        org_id: org.id,
        name: newTeamName.trim(),
        slug,
        icon: '💼',
      })
      .select()
      .single()

    if (ws) {
      await supabase.from('workspace_members').insert({
        workspace_id: ws.id,
        user_id: session.user.id,
        role: 'admin',
      })
      router.push(`/${orgSlug}/${ws.slug}`)
    }

    setCreating(false)
    setCreateOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-sans">
        <div className="text-dl-text-medium text-dl-base">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="font-sans">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">{t('teams.title')}</h1>
            <p className="text-dl-text-medium text-dl-base">{t('teams.selectTeam')}</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="dl-btn-primary px-5 py-2 font-black"
          >
            <Plus size={15} /> {t('teams.createTeam')}
          </button>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-dl-bg-medium rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers size={28} className="text-dl-text-light" />
            </div>
            <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{t('teams.noTeams')}</h2>
            <p className="text-dl-text-medium text-dl-base mb-6">{t('teams.noTeamsDesc')}</p>
            <button onClick={() => setCreateOpen(true)} className="dl-btn-primary px-6 py-2.5 font-black">
              {t('teams.createTeam')} &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => router.push(`/${orgSlug}/${ws.slug}`)}
                className="text-left dl-card p-5 hover:shadow-dl-md transition-all hover:border-dl-brand group"
              >
                <div className="w-10 h-10 rounded-dl-md flex items-center justify-center text-xl mb-3"
                  style={{ backgroundColor: (ws.color || '#191919') + '20' }}>
                  <span>{ws.icon || '💼'}</span>
                </div>
                <h3 className="text-dl-base font-black text-dl-text-dark mb-1 group-hover:text-dl-brand transition-colors">
                  {ws.name}
                </h3>
                <p className="text-dl-xs text-dl-text-light">
                  {ws.projectCount} {ws.projectCount === 1 ? 'project' : 'projects'}
                </p>
              </button>
            ))}

            {/* Create team card */}
            <button
              onClick={() => setCreateOpen(true)}
              className="text-left border-2 border-dashed border-dl-border-dark rounded-dl-lg p-5
                hover:border-dl-brand hover:bg-dl-brand-hover transition-all flex flex-col items-center justify-center min-h-[120px] text-center"
            >
              <div className="w-10 h-10 rounded-dl-md bg-dl-bg-medium flex items-center justify-center mb-3">
                <Plus size={20} className="text-dl-text-light" />
              </div>
              <p className="text-dl-sm font-black text-dl-text-medium">{t('teams.newTeam')}</p>
            </button>
          </div>
        )}
      </div>

      {/* Create team dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-dl-bg border border-dl-border rounded-dl-lg shadow-dl-lg p-0 max-w-md">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-dl-xl font-black text-dl-text-dark">{t('teams.createTeam')}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-4">
            <div>
              <label className="dl-label">{t('teams.teamName')}</label>
              <input
                className="dl-input"
                placeholder={t('teams.teamNamePlaceholder')}
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCreateOpen(false)} className="dl-btn-secondary">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim() || creating}
                className={`dl-btn-primary ${!newTeamName.trim() || creating ? 'opacity-40' : ''}`}
              >
                {creating ? t('teams.creating') : t('teams.createTeam')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
