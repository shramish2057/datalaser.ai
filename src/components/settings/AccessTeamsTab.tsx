'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Plus, Users, FolderOpen, Trash2, Edit3 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  orgId: string
  orgSlug: string
  workspaces: any[]
  members: any[]
  projects: any[]
  onRefresh: () => void
}

export function AccessTeamsTab({ orgId, orgSlug, workspaces, members, projects, onRefresh }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const slug = newName.trim().toLowerCase()
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

    const { data: ws } = await supabase.from('workspaces').insert({
      org_id: orgId,
      name: newName.trim(),
      slug,
      description: newDesc.trim() || null,
      icon: '💼',
    }).select().single()

    if (ws) {
      await supabase.from('workspace_members').insert({
        workspace_id: ws.id,
        user_id: session.user.id,
        role: 'admin',
      })
    }

    setCreating(false)
    setCreateOpen(false)
    setNewName('')
    setNewDesc('')
    onRefresh()
  }

  const handleDelete = async (wsId: string, wsName: string) => {
    if (!confirm(t('access.deleteTeamConfirm'))) return
    await supabase.from('workspaces').delete().eq('id', wsId)
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-dl-text-medium text-dl-sm">
          {workspaces.length} {workspaces.length === 1 ? 'team' : 'teams'}
        </p>
        <button onClick={() => setCreateOpen(true)} className="dl-btn-primary text-dl-sm">
          <Plus size={14} /> {t('access.createTeam')}
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="text-center py-12">
          <Users size={32} className="text-dl-text-light mx-auto mb-3" />
          <p className="text-dl-text-medium font-bold">{t('access.noTeamsYet')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map(ws => {
            const wsProjects = projects.filter((p: any) => p.workspace_id === ws.id)
            const wsMembers = members.filter((m: any) =>
              // count members who belong to this workspace via workspace_memberships
              true // simplified — we show all for now
            )
            return (
              <div key={ws.id} className="dl-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-dl-md bg-dl-bg-medium flex items-center justify-center text-lg">
                    {ws.icon || '💼'}
                  </div>
                  <div>
                    <p className="text-dl-sm font-black text-dl-text-dark">{ws.name}</p>
                    <div className="flex items-center gap-3 text-dl-xs text-dl-text-light mt-0.5">
                      <span className="flex items-center gap-1"><FolderOpen size={11} /> {wsProjects.length} {t('overview.projects').toLowerCase()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => router.push(`/${orgSlug}/${ws.slug}/settings`)}
                    className="p-2 rounded-dl-md text-dl-text-light hover:text-dl-brand hover:bg-dl-bg-light transition-colors"
                    title={t('access.editTeam')}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(ws.id, ws.name)}
                    className="p-2 rounded-dl-md text-dl-text-light hover:text-red-500 hover:bg-red-50 transition-colors"
                    title={t('access.deleteTeam')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-dl-bg border border-dl-border rounded-dl-lg shadow-dl-lg p-0 max-w-md">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-dl-xl font-black text-dl-text-dark">{t('access.createTeam')}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-4">
            <div>
              <label className="dl-label">{t('teams.teamName')}</label>
              <input className="dl-input" placeholder={t('teams.teamNamePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCreateOpen(false)} className="dl-btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={!newName.trim() || creating} className={`dl-btn-primary ${!newName.trim() || creating ? 'opacity-40' : ''}`}>
                {creating ? t('teams.creating') : t('access.createTeam')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
