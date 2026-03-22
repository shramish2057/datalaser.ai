import { createClient } from '@/lib/supabase/server'
import type { Organization, Workspace, Project, OrgMember, WorkspaceMember, AppContext } from '@/types/database'

/**
 * Get or create the full app context for a user.
 * Called after login and during onboarding.
 */
export async function getOrCreateUserContext(userId: string): Promise<AppContext | null> {
  const supabase = await createClient()

  // Check if user already has an org
  const { data: membership } = await supabase
    .from('org_members')
    .select(`
      role,
      organizations (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!membership) return null

  const org = membership.organizations as unknown as Organization
  const orgRole = membership.role as OrgMember['role']

  // Get the first workspace in this org the user belongs to
  const { data: wsMembership } = await supabase
    .from('workspace_members')
    .select(`
      role,
      workspaces (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!wsMembership) return null

  const workspace = wsMembership.workspaces as unknown as Workspace
  const workspaceRole = wsMembership.role as WorkspaceMember['role']

  return {
    org,
    workspace,
    project: null,
    orgRole,
    workspaceRole,
    isPersonal: org.type === 'personal',
  }
}

/**
 * Create a new personal organization + workspace for a user.
 * Called during onboarding for individual users.
 */
export async function createPersonalOrg(
  userId: string,
  userName: string
): Promise<{ org: Organization; workspace: Workspace }> {
  const supabase = await createClient()

  const slug = userName.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).slice(2, 6)

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: userName,
      slug,
      type: 'personal',
      owner_id: userId,
      plan: 'free',
    })
    .select()
    .single()

  if (orgError || !org) throw new Error(`Failed to create org: ${orgError?.message}`)

  await supabase.from('org_members').insert({
    org_id: org.id,
    user_id: userId,
    role: 'owner',
  })

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      org_id: org.id,
      name: 'My Workspace',
      slug: 'my-workspace',
      icon: '💼',
    })
    .select()
    .single()

  if (wsError || !workspace) throw new Error(`Failed to create workspace: ${wsError?.message}`)

  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'admin',
  })

  return { org, workspace }
}

/**
 * Create a new team organization.
 * Called during onboarding for team users.
 */
export async function createTeamOrg(
  userId: string,
  orgName: string,
  workspaceName: string = 'General'
): Promise<{ org: Organization; workspace: Workspace }> {
  const supabase = await createClient()

  const orgSlug = orgName.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const wsSlug = workspaceName.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: orgName,
      slug: orgSlug,
      type: 'team',
      owner_id: userId,
      plan: 'free',
    })
    .select()
    .single()

  if (orgError || !org) throw new Error(`Failed to create org: ${orgError?.message}`)

  await supabase.from('org_members').insert({
    org_id: org.id,
    user_id: userId,
    role: 'owner',
  })

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      org_id: org.id,
      name: workspaceName,
      slug: wsSlug,
      icon: '💼',
    })
    .select()
    .single()

  if (wsError || !workspace) throw new Error(`Failed to create workspace: ${wsError?.message}`)

  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'admin',
  })

  return { org, workspace }
}

/**
 * Create a new project inside a workspace.
 */
export async function createProject(
  userId: string,
  workspaceId: string,
  orgId: string,
  name: string,
  icon: string = '📊',
  color: string = '#4A9EDA'
): Promise<Project> {
  const supabase = await createClient()

  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).slice(2, 6)

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      org_id: orgId,
      name,
      slug,
      icon,
      color,
      created_by: userId,
    })
    .select()
    .single()

  if (error || !project) throw new Error(`Failed to create project: ${error?.message}`)
  return project
}

/**
 * Get a project by ID with permission check.
 */
export async function getProject(
  userId: string,
  projectId: string
): Promise<Project | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  return data
}

/**
 * Get all projects for a workspace.
 */
export async function getWorkspaceProjects(
  workspaceId: string
): Promise<Project[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return data ?? []
}

/**
 * After login — figure out where to redirect the user.
 * Returns the correct home URL based on their org type and setup status.
 */
export async function getPostLoginRedirect(userId: string): Promise<string> {
  const context = await getOrCreateUserContext(userId)

  // No org yet — send to onboarding
  if (!context) return '/onboarding/setup'

  // Personal user — send to projects list
  if (context.isPersonal) return '/projects'

  // Team user — send to org home
  return `/${context.org.slug}`
}
