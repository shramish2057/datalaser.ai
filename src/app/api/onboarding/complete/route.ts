import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createPersonalOrg,
  createTeamOrg,
  createProject,
} from '@/lib/bootstrap'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      userName, mode, orgName, workspaceName,
      projectName, projectIcon, projectColor,
    } = await request.json()

    let org, workspace

    if (mode === 'personal') {
      const result = await createPersonalOrg(user.id, userName)
      org = result.org
      workspace = result.workspace
    } else {
      const result = await createTeamOrg(
        user.id,
        orgName || userName,
        workspaceName || 'General'
      )
      org = result.org
      workspace = result.workspace
    }

    const project = await createProject(
      user.id,
      workspace.id,
      org.id,
      projectName,
      projectIcon,
      projectColor,
    )

    // Update user profile with name
    await supabase.from('profiles').upsert({
      id: user.id,
      workspace_name: workspace.name,
      role: 'Founder / CEO',
    })

    return NextResponse.json({ org, workspace, project })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Onboarding failed' },
      { status: 500 }
    )
  }
}
