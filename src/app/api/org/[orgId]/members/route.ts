import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify caller is owner or admin of this org
    const { data: callerMembership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use admin client to bypass RLS and get ALL org members
    const admin = createAdminClient()

    const { data: members, error: membersError } = await admin
      .from('org_members')
      .select('id, org_id, user_id, role, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    // Fetch user profiles for display
    const userIds = members.map((m: { user_id: string }) => m.user_id)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, avatar_url')
      .in('id', userIds)

    // Fetch auth user metadata for names/emails
    const enrichedMembers = await Promise.all(
      members.map(async (m: { user_id: string; id: string; org_id: string; role: string; created_at: string }) => {
        const { data: { user: authUser } } = await admin.auth.admin.getUserById(m.user_id)
        const profile = profiles?.find((p: { id: string }) => p.id === m.user_id)
        return {
          ...m,
          email: authUser?.email || '',
          name: authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || '',
          avatar_url: profile?.avatar_url || null,
        }
      })
    )

    // Also fetch workspace memberships for each member
    const { data: wsMemberships } = await admin
      .from('workspace_members')
      .select('id, workspace_id, user_id, role, project_access_type')
      .in('user_id', userIds)

    // Fetch workspaces for this org
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, name, slug')
      .eq('org_id', orgId)

    return NextResponse.json({
      members: enrichedMembers,
      workspace_memberships: wsMemberships || [],
      workspaces: workspaces || [],
    })
  } catch (error) {
    console.error('Org members error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
