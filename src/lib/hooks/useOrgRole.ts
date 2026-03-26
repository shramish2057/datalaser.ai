'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import type { OrgMember } from '@/types/database'

interface OrgRoleState {
  role: OrgMember['role'] | null
  isOwner: boolean
  isAdmin: boolean
  isMember: boolean
  isViewer: boolean
  loading: boolean
}

export function useOrgRole(orgSlug: string): OrgRoleState {
  const [state, setState] = useState<OrgRoleState>({
    role: null,
    isOwner: false,
    isAdmin: false,
    isMember: false,
    isViewer: false,
    loading: true,
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!orgSlug) return

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState(prev => ({ ...prev, loading: false }))
        return
      }

      // Get org by slug
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single()

      if (!org) {
        setState(prev => ({ ...prev, loading: false }))
        return
      }

      // Get user's membership role
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', org.id)
        .eq('user_id', session.user.id)
        .single()

      const role = (membership?.role as OrgMember['role']) || null

      setState({
        role,
        isOwner: role === 'owner',
        isAdmin: role === 'admin',
        isMember: role === 'member',
        isViewer: role === 'viewer',
        loading: false,
      })
    }

    load()
  }, [orgSlug])

  return state
}
