'use client'

import { useTranslations } from 'next-intl'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Check, Eye, Lock } from 'lucide-react'
import { ProjectIconBadge } from '@/components/ProjectIcon'

interface Props {
  orgId: string
  workspaces: any[]
  projects: any[]
  members: any[]
  assignments: any[]
  onRefresh: () => void
}

export function AccessProjectsTab({ orgId, workspaces, projects, members, assignments, onRefresh }: Props) {
  const t = useTranslations()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleVisibilityChange = async (projectId: string, visibility: 'team' | 'assigned') => {
    await supabase.from('projects').update({ visibility }).eq('id', projectId)
    onRefresh()
  }

  const toggleAssignment = async (projectId: string, userId: string, isAssigned: boolean) => {
    if (isAssigned) {
      await supabase.from('project_assignments').delete().eq('project_id', projectId).eq('user_id', userId)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('project_assignments').insert({
        project_id: projectId,
        user_id: userId,
        granted_by: session?.user.id,
      })
    }
    onRefresh()
  }

  // Group projects by workspace
  const grouped = workspaces.map(ws => ({
    workspace: ws,
    projects: projects.filter((p: any) => p.workspace_id === ws.id),
  })).filter(g => g.projects.length > 0)

  const unassigned = projects.filter((p: any) => !workspaces.some((ws: any) => ws.id === p.workspace_id))

  return (
    <div className="space-y-6">
      {grouped.map(group => (
        <div key={group.workspace.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{group.workspace.icon || '💼'}</span>
            <h3 className="text-dl-sm font-black text-dl-text-dark">{group.workspace.name}</h3>
            <span className="text-dl-xs text-dl-text-light">({group.projects.length})</span>
          </div>

          <div className="space-y-2">
            {group.projects.map((project: any) => {
              const projectAssignments = assignments.filter((a: any) => a.project_id === project.id)
              const isTeamVisible = project.visibility === 'team'

              return (
                <div key={project.id} className="dl-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <ProjectIconBadge icon={project.icon} color={project.color} size="sm" />
                      <span className="text-dl-sm font-bold text-dl-text-dark">{project.name}</span>
                    </div>

                    {/* Visibility toggle */}
                    <div className="flex items-center gap-1 bg-dl-bg-light rounded-full p-0.5">
                      <button
                        onClick={() => handleVisibilityChange(project.id, 'team')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all
                          ${isTeamVisible
                            ? 'bg-white text-dl-text-dark shadow-sm'
                            : 'text-dl-text-light hover:text-dl-text-medium'
                          }`}
                      >
                        <Eye size={11} /> {t('access.visibilityTeam')}
                      </button>
                      <button
                        onClick={() => handleVisibilityChange(project.id, 'assigned')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all
                          ${!isTeamVisible
                            ? 'bg-white text-dl-text-dark shadow-sm'
                            : 'text-dl-text-light hover:text-dl-text-medium'
                          }`}
                      >
                        <Lock size={11} /> {t('access.visibilityAssigned')}
                      </button>
                    </div>
                  </div>

                  {/* Member assignment (only shown when visibility = assigned) */}
                  {!isTeamVisible && (
                    <div className="pt-3 border-t border-dl-border">
                      <p className="text-dl-xs text-dl-text-light mb-2">{t('access.projectAccess')}:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {members.map((member: any) => {
                          const isAssigned = projectAssignments.some((a: any) => a.user_id === member.user_id)
                          const isCreator = project.created_by === member.user_id
                          const isOwner = member.role === 'owner'
                          const alwaysHasAccess = isCreator || isOwner

                          return (
                            <button
                              key={member.user_id}
                              onClick={() => !alwaysHasAccess && toggleAssignment(project.id, member.user_id, isAssigned)}
                              disabled={alwaysHasAccess}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all
                                ${alwaysHasAccess
                                  ? 'bg-emerald-50 text-emerald-600 cursor-default'
                                  : isAssigned
                                    ? 'bg-dl-brand-hover text-dl-brand border border-dl-brand'
                                    : 'bg-dl-bg-light text-dl-text-light border border-dl-border hover:border-dl-brand cursor-pointer'
                                }`}
                            >
                              {(alwaysHasAccess || isAssigned) && <Check size={10} />}
                              {member.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {unassigned.length > 0 && (
        <div>
          <h3 className="text-dl-sm font-black text-dl-text-light mb-3">{t('access.noTeamsYet')}</h3>
          <div className="space-y-2">
            {unassigned.map((project: any) => (
              <div key={project.id} className="dl-card p-4 flex items-center gap-2.5">
                <ProjectIconBadge icon={project.icon} color={project.color} size="sm" />
                <span className="text-dl-sm font-bold text-dl-text-medium">{project.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
