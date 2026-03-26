'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

interface ProjectAccessState {
  hasAccess: boolean
  accessType: 'owner' | 'team' | 'assigned' | 'creator' | null
  loading: boolean
}

export function useProjectAccess(projectId: string): ProjectAccessState {
  const [state, setState] = useState<ProjectAccessState>({
    hasAccess: false,
    accessType: null,
    loading: true,
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!projectId) return

    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState({ hasAccess: false, accessType: null, loading: false })
        return
      }

      const userId = session.user.id

      // RLS already enforces access — if we can read the project, we have access
      const { data: project } = await supabase
        .from('projects')
        .select('id, org_id, workspace_id, visibility, created_by')
        .eq('id', projectId)
        .single()

      if (!project) {
        setState({ hasAccess: false, accessType: null, loading: false })
        return
      }

      // Determine access type for UI display
      if (project.created_by === userId) {
        setState({ hasAccess: true, accessType: 'creator', loading: false })
        return
      }

      // Check if org owner
      const { data: orgMembership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', project.org_id)
        .eq('user_id', userId)
        .single()

      if (orgMembership?.role === 'owner') {
        setState({ hasAccess: true, accessType: 'owner', loading: false })
        return
      }

      // Check workspace membership
      const { data: wsMembership } = await supabase
        .from('workspace_members')
        .select('project_access_type')
        .eq('workspace_id', project.workspace_id)
        .eq('user_id', userId)
        .single()

      if (wsMembership) {
        if (project.visibility === 'team' || wsMembership.project_access_type === 'all') {
          setState({ hasAccess: true, accessType: 'team', loading: false })
          return
        }

        // Check assignment
        const { data: assignment } = await supabase
          .from('project_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .single()

        if (assignment) {
          setState({ hasAccess: true, accessType: 'assigned', loading: false })
          return
        }
      }

      setState({ hasAccess: false, accessType: null, loading: false })
    }

    check()
  }, [projectId])

  return state
}
