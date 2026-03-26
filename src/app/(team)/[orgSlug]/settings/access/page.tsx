'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { OrgSettingsShell } from '@/components/settings/OrgSettingsShell'
import { AccessTeamsTab } from '@/components/settings/AccessTeamsTab'
import { AccessMembersTab } from '@/components/settings/AccessMembersTab'
import { AccessProjectsTab } from '@/components/settings/AccessProjectsTab'

type Tab = 'teams' | 'members' | 'projects'

export default function AccessControlPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const [activeTab, setActiveTab] = useState<Tab>('teams')
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)

  // Shared data loaded once, passed to tabs
  const [members, setMembers] = useState<any[]>([])
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [wsMemberships, setWsMemberships] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadData = useCallback(async () => {
    // Get org
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()
    if (!org) return
    setOrgId(org.id)

    // Fetch members via service-role API
    const membersRes = await fetch(`/api/org/${org.id}/members`)
    if (membersRes.ok) {
      const data = await membersRes.json()
      setMembers(data.members || [])
      setWsMemberships(data.workspace_memberships || [])
      setWorkspaces(data.workspaces || [])
    }

    // Fetch projects (RLS-filtered — owner sees all)
    const { data: projectList } = await supabase
      .from('projects')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
    setProjects(projectList || [])

    // Fetch project assignments
    const { data: assignmentList } = await supabase
      .from('project_assignments')
      .select('*')
    setAssignments(assignmentList || [])

    setLoading(false)
  }, [orgSlug])

  useEffect(() => { loadData() }, [loadData])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'teams', label: t('access.tabTeams') },
    { id: 'members', label: t('access.tabMembers') },
    { id: 'projects', label: t('access.tabProjects') },
  ]

  return (
    <OrgSettingsShell orgSlug={orgSlug}>
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">{t('access.title')}</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-dl-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-dl-sm font-bold transition-colors border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'text-dl-brand border-dl-brand'
                : 'text-dl-text-medium border-transparent hover:text-dl-text-dark'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 rounded-dl-md dl-shimmer" />
          <div className="h-10 rounded-dl-md dl-shimmer" />
          <div className="h-10 rounded-dl-md dl-shimmer" />
        </div>
      ) : (
        <>
          {activeTab === 'teams' && (
            <AccessTeamsTab
              orgId={orgId}
              orgSlug={orgSlug}
              workspaces={workspaces}
              members={members}
              projects={projects}
              onRefresh={loadData}
            />
          )}
          {activeTab === 'members' && (
            <AccessMembersTab
              orgId={orgId}
              members={members}
              workspaces={workspaces}
              wsMemberships={wsMemberships}
              projects={projects}
              assignments={assignments}
              onRefresh={loadData}
            />
          )}
          {activeTab === 'projects' && (
            <AccessProjectsTab
              orgId={orgId}
              workspaces={workspaces}
              projects={projects}
              members={members}
              assignments={assignments}
              onRefresh={loadData}
            />
          )}
        </>
      )}
    </OrgSettingsShell>
  )
}
