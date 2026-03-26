'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { ChevronDown, Check } from 'lucide-react'

interface Props {
  orgId: string
  members: any[]
  workspaces: any[]
  wsMemberships: any[]
  projects: any[]
  assignments: any[]
  onRefresh: () => void
}

const ROLES = ['owner', 'admin', 'member', 'viewer'] as const

export function AccessMembersTab({ orgId, members, workspaces, wsMemberships, projects, assignments, onRefresh }: Props) {
  const t = useTranslations()
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      owner: t('access.roleOwner'),
      admin: t('access.roleAdmin'),
      member: t('access.roleMember'),
      viewer: t('access.roleViewer'),
    }
    return map[role] || role
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    await fetch(`/api/org/${orgId}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, role: newRole }),
    })
    onRefresh()
  }

  const getMemberTeams = (userId: string) => {
    return wsMemberships
      .filter((wm: any) => wm.user_id === userId)
      .map((wm: any) => {
        const ws = workspaces.find((w: any) => w.id === wm.workspace_id)
        return { ...wm, workspace: ws }
      })
      .filter((wm: any) => wm.workspace)
  }

  const getMemberAssignments = (userId: string) => {
    return assignments.filter((a: any) => a.user_id === userId)
  }

  const toggleTeam = async (userId: string, workspaceId: string, isMember: boolean) => {
    if (isMember) {
      // Remove from team
      await supabase.from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
    } else {
      // Add to team
      await supabase.from('workspace_members')
        .insert({ workspace_id: workspaceId, user_id: userId, role: 'editor' })
    }
    onRefresh()
  }

  const toggleProjectAssignment = async (userId: string, projectId: string, isAssigned: boolean) => {
    if (isAssigned) {
      await supabase.from('project_assignments')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('project_assignments')
        .insert({ project_id: projectId, user_id: userId, granted_by: session?.user.id })
    }
    onRefresh()
  }

  if (members.length === 0) {
    return <p className="text-dl-text-medium text-center py-12">{t('access.noMembersYet')}</p>
  }

  return (
    <div className="space-y-2">
      {members.map((member: any) => {
        const isExpanded = expandedMember === member.user_id
        const memberTeams = getMemberTeams(member.user_id)
        const memberAssignments = getMemberAssignments(member.user_id)

        return (
          <div key={member.id} className="dl-card overflow-hidden">
            {/* Member row */}
            <button
              onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
              className="w-full flex items-center justify-between p-4 hover:bg-dl-bg-light transition-colors"
            >
              <div className="flex items-center gap-3">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-dl-bg-medium flex items-center justify-center text-dl-xs font-black text-dl-text-medium">
                    {member.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-dl-sm font-bold text-dl-text-dark">{member.name}</p>
                  <p className="text-dl-xs text-dl-text-light">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={member.role}
                  onChange={e => { e.stopPropagation(); handleRoleChange(member.id, e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  className={`text-dl-xs font-bold px-2.5 py-1 rounded-full border-0 cursor-pointer
                    ${member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                      member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      member.role === 'viewer' ? 'bg-gray-100 text-gray-500' :
                      'bg-dl-bg-medium text-dl-text-medium'}`}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
                <ChevronDown size={14} className={`text-dl-text-light transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Expanded: team + project assignment */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-dl-border space-y-4">
                {/* Team assignment */}
                <div>
                  <p className="text-dl-xs font-bold text-dl-text-medium mb-2">{t('access.teamAssignment')}</p>
                  <div className="flex flex-wrap gap-2">
                    {workspaces.map((ws: any) => {
                      const isMemberOfTeam = memberTeams.some((mt: any) => mt.workspace?.id === ws.id)
                      return (
                        <button
                          key={ws.id}
                          onClick={() => toggleTeam(member.user_id, ws.id, isMemberOfTeam)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-dl-xs font-bold transition-all
                            ${isMemberOfTeam
                              ? 'bg-dl-brand-hover text-dl-brand border border-dl-brand'
                              : 'bg-dl-bg-light text-dl-text-light border border-dl-border hover:border-dl-brand'
                            }`}
                        >
                          {isMemberOfTeam && <Check size={11} />}
                          {ws.icon || '💼'} {ws.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Project-level access (for teams where member has 'assigned' access) */}
                {memberTeams.length > 0 && (
                  <div>
                    <p className="text-dl-xs font-bold text-dl-text-medium mb-2">{t('access.projectAccess')}</p>
                    {memberTeams.map((mt: any) => {
                      const teamProjects = projects.filter((p: any) => p.workspace_id === mt.workspace?.id)
                      if (teamProjects.length === 0) return null
                      return (
                        <div key={mt.workspace?.id} className="mb-3">
                          <p className="text-dl-xs text-dl-text-light mb-1.5">{mt.workspace?.icon} {mt.workspace?.name}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {teamProjects.map((project: any) => {
                              const isAssigned = memberAssignments.some((a: any) => a.project_id === project.id)
                              const hasTeamAccess = project.visibility === 'team'
                              return (
                                <button
                                  key={project.id}
                                  onClick={() => toggleProjectAssignment(member.user_id, project.id, isAssigned)}
                                  disabled={hasTeamAccess}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-dl-md text-[11px] font-bold transition-all
                                    ${hasTeamAccess
                                      ? 'bg-emerald-50 text-emerald-600 cursor-default'
                                      : isAssigned
                                        ? 'bg-dl-brand-hover text-dl-brand border border-dl-brand'
                                        : 'bg-dl-bg-light text-dl-text-light border border-dl-border hover:border-dl-brand cursor-pointer'
                                    }`}
                                  title={hasTeamAccess ? t('access.visibilityTeam') : undefined}
                                >
                                  {(hasTeamAccess || isAssigned) && <Check size={10} />}
                                  {project.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
