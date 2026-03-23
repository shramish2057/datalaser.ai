'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'
import { WsSettingsShell } from '@/components/settings/WsSettingsShell'

type Member = { id: string; user_id: string; role: string; created_at: string }

export default function WorkspaceMembersPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string
  const [wsId, setWsId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [orgMembers, setOrgMembers] = useState<{ user_id: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [addRole, setAddRole] = useState('editor')
  const [adding, setAdding] = useState(false)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function load() {
      const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single()
      if (!org) return
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

  return (
    <WsSettingsShell orgSlug={orgSlug} workspaceSlug={workspaceSlug}>
      {loading ? <div className="space-y-3"><div className="h-10 rounded-mb-md mb-shimmer" /><div className="h-10 rounded-mb-md mb-shimmer" /></div> : <>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-mb-2xl font-black text-mb-text-dark">{t("settings.members")}</h1>
          {availableOrgMembers.length > 0 && <button onClick={() => setAddOpen(true)} className="mb-btn-primary"><UserPlus size={14} /> Add member</button>}
        </div>
        <div className="mb-card overflow-hidden">
          <table className="mb-table"><thead><tr><th>User</th><th>Role</th><th>Joined</th></tr></thead><tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td className="font-bold font-mono text-mb-xs">{m.user_id.slice(0, 8)}...</td>
                <td><span className={m.role === 'admin' ? 'mb-badge-info' : m.role === 'editor' ? 'mb-badge-warning' : 'mb-badge-neutral'}>{m.role}</span></td>
                <td className="text-mb-text-medium">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="bg-mb-bg border border-mb-border rounded-mb-lg shadow-mb-lg p-0 max-w-md">
            <DialogHeader className="p-6 pb-0"><DialogTitle className="text-mb-xl font-black text-mb-text-dark">Add member to workspace</DialogTitle></DialogHeader>
            <div className="p-6 pt-4 space-y-4">
              <div><label className="mb-label">Select org member</label><select className="mb-input" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                <option value="">Choose...</option>
                {availableOrgMembers.map(om => <option key={om.user_id} value={om.user_id}>{om.user_id.slice(0, 12)}...</option>)}
              </select></div>
              <div><label className="mb-label">Role</label><select className="mb-input" value={addRole} onChange={e => setAddRole(e.target.value)}>
                <option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
              </select></div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setAddOpen(false)} className="mb-btn-secondary">Cancel</button>
                <button onClick={handleAdd} disabled={!selectedUser || adding} className={`mb-btn-primary ${!selectedUser || adding ? 'opacity-40' : ''}`}>{adding ? 'Adding...' : 'Add member'}</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>}
    </WsSettingsShell>
  )
}
