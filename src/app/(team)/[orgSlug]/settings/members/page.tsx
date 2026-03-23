'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { UserPlus, Mail, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrgSettingsShell } from '@/components/settings/OrgSettingsShell'
import { formatDistanceToNow } from 'date-fns'

type Member = { id: string; user_id: string; role: string; created_at: string; email?: string }
type Invite = { id: string; email: string; role: string; created_at: string; accepted_at: string | null }

export default function OrgMembersPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function load() {
      const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single()
      if (!org) return
      setOrgId(org.id)

      const { data: memberList } = await supabase.from('org_members').select('*').eq('org_id', org.id).order('created_at', { ascending: true })
      setMembers(memberList ?? [])

      const { data: inviteList } = await supabase.from('invitations').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
      setInvites(inviteList ?? [])
      setLoading(false)
    }
    load()
  }, [orgSlug])

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return
    setInviting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('invitations').insert({
      org_id: orgId,
      email: inviteEmail.trim(),
      role: inviteRole,
      token: crypto.randomUUID(),
      invited_by: user?.id ?? '',
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    setInviting(false); setInviteOpen(false); setInviteEmail(''); setInviteRole('member')
    // Reload invites
    const { data } = await supabase.from('invitations').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    setInvites(data ?? [])
  }

  return (
    <OrgSettingsShell orgSlug={orgSlug}>
      {loading ? <div className="space-y-3"><div className="h-10 rounded-mb-md mb-shimmer" /><div className="h-10 rounded-mb-md mb-shimmer" /><div className="h-10 rounded-mb-md mb-shimmer" /></div> : <>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-mb-2xl font-black text-mb-text-dark">{t("settings.members")}</h1>
          <button onClick={() => setInviteOpen(true)} className="mb-btn-primary"><UserPlus size={14} /> Invite member</button>
        </div>

        <div className="mb-card overflow-hidden mb-8">
          <table className="mb-table"><thead><tr><th>User</th><th>Role</th><th>Joined</th></tr></thead><tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td className="font-bold font-mono text-mb-xs">{m.user_id.slice(0, 8)}...</td>
                <td><span className={m.role === 'owner' ? 'mb-badge-info' : m.role === 'admin' ? 'mb-badge-warning' : 'mb-badge-neutral'}>{m.role}</span></td>
                <td className="text-mb-text-medium">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody></table>
        </div>

        {invites.length > 0 && (
          <div>
            <p className="mb-section-header mb-3">Pending Invitations</p>
            <div className="mb-card overflow-hidden">
              <table className="mb-table"><thead><tr><th>Email</th><th>Role</th><th>Sent</th><th>{t("common.status")}</th></tr></thead><tbody>
                {invites.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-bold flex items-center gap-2"><Mail size={12} className="text-mb-text-light" />{inv.email}</td>
                    <td><span className="mb-badge-neutral">{inv.role}</span></td>
                    <td className="text-mb-text-medium">{formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}</td>
                    <td>{inv.accepted_at ? <span className="mb-badge-success">Accepted</span> : <span className="mb-badge-warning flex items-center gap-1"><Clock size={10} /> Pending</span>}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>
        )}

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="bg-mb-bg border border-mb-border rounded-mb-lg shadow-mb-lg p-0 max-w-md">
            <DialogHeader className="p-6 pb-0"><DialogTitle className="text-mb-xl font-black text-mb-text-dark">Invite a member</DialogTitle></DialogHeader>
            <div className="p-6 pt-4 space-y-4">
              <div><label className="mb-label">Email</label><input className="mb-input" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
              <div><label className="mb-label">Role</label><select className="mb-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="admin">{t("common.admin")}</option><option value="member">{t("common.member")}</option><option value="viewer">{t("common.viewer")}</option>
              </select></div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setInviteOpen(false)} className="mb-btn-secondary">Cancel</button>
                <button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting} className={`mb-btn-primary ${!inviteEmail.trim() || inviting ? 'opacity-40' : ''}`}>{inviting ? 'Sending...' : 'Send invite'}</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>}
    </OrgSettingsShell>
  )
}
