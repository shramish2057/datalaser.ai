'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import type { Organization, Workspace, Project } from '@/types/database'

export type TeamContext = {
  org: Organization
  workspace: Workspace
  project: Project
  projectId: string
  base: string           // e.g. /acme/engineering/analytics
  workspaceBase: string  // e.g. /acme/engineering
  orgBase: string        // e.g. /acme
  loading: boolean
}

/**
 * Hook to resolve team slugs → real IDs.
 * Provides the same projectId that personal routes get from useParams().
 */
export function useTeamProject(): TeamContext & { supabase: ReturnType<typeof createBrowserClient> } {
  const [org, setOrg] = useState<Organization | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const params = useParams()
  const router = useRouter()

  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string
  const projectSlug = params.projectSlug as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function resolve() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // Resolve org
      const { data: o } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', orgSlug)
        .single()
      if (!o) { router.push('/projects'); return }
      setOrg(o)

      if (!workspaceSlug) { setLoading(false); return }

      // Resolve workspace
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('org_id', o.id)
        .eq('slug', workspaceSlug)
        .single()
      if (!ws) { router.push(`/${orgSlug}`); return }
      setWorkspace(ws)

      if (!projectSlug) { setLoading(false); return }

      // Resolve project
      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', ws.id)
        .eq('slug', projectSlug)
        .single()
      if (!proj) { router.push(`/${orgSlug}/${workspaceSlug}`); return }
      setProject(proj)

      setLoading(false)
    }
    resolve()
  }, [orgSlug, workspaceSlug, projectSlug])

  const base = `/${orgSlug}/${workspaceSlug}/${projectSlug}`
  const workspaceBase = `/${orgSlug}/${workspaceSlug}`
  const orgBase = `/${orgSlug}`

  return {
    org: org!,
    workspace: workspace!,
    project: project!,
    projectId: project?.id ?? '',
    base,
    workspaceBase,
    orgBase,
    loading,
    supabase,
  }
}
