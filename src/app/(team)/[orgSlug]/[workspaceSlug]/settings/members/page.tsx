'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { UserPlus, Mail } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'
import { WsSettingsShell } from '@/components/settings/WsSettingsShell'

type Member = { id: string; user_id: string; role: string; created_at: string }

export default function WorkspaceMembersPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string
  const [orgId, setOrgId] = useState('')
  const [wsId, setWsId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [orgMembers, setOrgMembers] = useState<{ user_id: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [addRole, setAddRole] = useState('editor')
  const [adding, setAdding] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function load() {
      const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single()
      if (!org) return
      setOrgId(org.id)
      const { data: ws } = await supabase.from('workspaces').select('id').eq('org_id', org.id).eq('slug', workspaceSlug).single()
      if (!ws) return
      setWsId(ws.id)
      const { data: memberList } = await supabase.from('workspace_members').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: true })
      setMembers(memberList ?? [])
      const { data: orgMemberList } = await supabase.from('org_members').select('user_id').eq('org_id', org.id)
      setOrgMembers(orgMemberList ?? [])
      setLoading(false)
    }
    load()
  }, [orgSlug, workspaceSlug])

  const existingUserIds = new Set(members.map(m => m.user_id))
  const availableOrgMembers = orgMembers.filter(om => !existingUserIds.has(om.user_id))

  const handleAdd = async () => {
    if (!selectedUser || !wsId) return
    setAdding(true)
    await supabase.from('workspace_members').insert({ workspace_id: wsId, user_id: selectedUser, role: addRole })
    const { data } = await supabase.from('workspace_members').select('*').eq('workspace_id', wsId).order('created_at', { ascending: true })
    setMembers(data ?? [])
    setAdding(false); setAddOpen(false); setSelectedUser('')
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId || !wsId) return
    setInviting(true)
    // Create invitation record
    await supabase.from('invitations').insert({
      org_id: orgId,
      workspace_id: wsId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: (await supabase.auth.getSession()).data.session?.user.id,
    })
    setInviting(false)
    setInviteSent(true)
    setTimeout(() => {
      setInviteSent(false)
      setInviteOpen(false)
      setInviteEmail('')
    }, 1500)
  }

  return (
    <WsSettingsShell orgSlug={orgSlug} workspaceSlug={workspaceSlug}>
      {loading ? <div className="space-y-3"><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /></div> : <>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-dl-2xl font-black text-dl-text-dark">{t('teams.members')}</h1>
          <div className="flex gap-2">
            <button onClick={() => setInviteOpen(true)} className="dl-btn-secondary">
              <Mail size={14} /> {t('teams.inviteByEmail')}
            </button>
            {availableOrgMembers.length > 0 && (
              <button onClick={() => setAddOpen(true)} className="dl-btn-primary">
                <UserPlus size={14} /> {t('teams.addMember')}
              </button>
            )}
          </div>
        </div>

        <div className="dl-card overflow-hidden">
          <table className="dl-table">
            <thead><tr><th>User</th><th>{t('common.role')}</th><th>Joined</th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td className="font-bold font-mono text-dl-xs">{m.user_id.slice(0, 8)}...</td>
                  <td><span className={m.role === 'admin' ? 'dl-badge-info' : m.role === 'editor' ? 'dl-badge-warning' : 'dl-badge-neutral'}>{m.role}</span></td>
                  <td className="text-dl-text-medium">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add existing org member dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="bg-dl-bg border border-dl-border rounded-dl-lg shadow-dl-lg p-0 max-w-md">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-dl-xl font-black text-dl-text-dark">{t('teams.addMemberToTeam')}</DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-4 space-y-4">
              <div>
                <label className="dl-label">{t('settings.members')}</label>
                <select className="dl-input" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                  <option value="">{t("common.choose")}</option>
                  {availableOrgMembers.map(om => <option key={om.user_id} value={om.user_id}>{om.user_id.slice(0, 12)}...</option>)}
                </select>
              </div>
              <div>
                <label className="dl-label">{t("common.role")}</label>
                <select className="dl-input" value={addRole} onChange={e => setAddRole(e.target.value)}>
                  <option value="admin">{t("common.admin")}</option>
                  <option value="editor">{t("common.editor")}</option>
                  <option value="viewer">{t("common.viewer")}</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setAddOpen(false)} className="dl-btn-secondary">{t("common.cancel")}</button>
                <button onClick={handleAdd} disabled={!selectedUser || adding} className={`dl-btn-primary ${!selectedUser || adding ? 'opacity-40' : ''}`}>
                  {adding ? t('teams.creating') : t('teams.addMember')}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invite by email dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="bg-dl-bg border border-dl-border rounded-dl-lg shadow-dl-lg p-0 max-w-md">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-dl-xl font-black text-dl-text-dark">{t('teams.inviteByEmail')}</DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-4 space-y-4">
              <div>
                <label className="dl-label">{t('teams.inviteEmail')}</label>
                <input
                  className="dl-input"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="dl-label">{t('teams.inviteRole')}</label>
                <select className="dl-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="admin">{t("common.admin")}</option>
                  <option value="editor">{t("common.editor")}</option>
                  <option value="viewer">{t("common.viewer")}</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setInviteOpen(false)} className="dl-btn-secondary">{t("common.cancel")}</button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting || inviteSent}
                  className={`dl-btn-primary ${!inviteEmail.trim() || inviting ? 'opacity-40' : ''}`}
                >
                  {inviteSent ? t('teams.inviteSent') : inviting ? t('teams.inviteSending') : t('teams.inviteSend')}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>}
    </WsSettingsShell>
  )
}
