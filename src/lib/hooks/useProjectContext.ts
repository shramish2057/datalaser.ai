'use client'

import { useParams } from 'next/navigation'
import { useContext } from 'react'
import { TeamProjectCtx } from '@/lib/teamContext'

/**
 * Shared hook that works in BOTH personal and team routes.
 * Returns { projectId, basePath } regardless of route type.
 *
 * - Personal route: projectId from URL params, basePath = /projects/{id}
 * - Team route: projectId from TeamProjectCtx, basePath = /{org}/{ws}/{proj}
 *
 * This is the ONLY hook pages should use to get project context.
 * Never use useParams().projectId or useTeamProjectContext() directly in pages.
 */
export function useProjectContext() {
  const params = useParams()
  const teamCtx = useContext(TeamProjectCtx)

  // Team route: TeamProjectCtx has a non-empty projectId
  if (teamCtx.projectId) {
    return {
      projectId: teamCtx.projectId,
      basePath: teamCtx.base,
      isTeam: true,
    }
  }

  // Personal route: projectId from URL params
  const projectId = params.projectId as string
  return {
    projectId,
    basePath: `/projects/${projectId}`,
    isTeam: false,
  }
}
