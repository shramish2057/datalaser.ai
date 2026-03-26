import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
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

    // Verify owner
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Fetch org info
    const { data: org } = await admin
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch all workspaces (teams) in the org
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, name, slug, icon')
      .eq('org_id', orgId)

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ error: 'No teams found' }, { status: 400 })
    }

    // Fetch all projects grouped by workspace
    const { data: projects } = await admin
      .from('projects')
      .select('id, name, workspace_id, icon, color')
      .eq('org_id', orgId)

    // Fetch all VIL graphs for these projects
    const projectIds = (projects || []).map(p => p.id)
    const { data: vilGraphs } = await admin
      .from('vil_graphs')
      .select('project_id, graph_data, industry_type, industry_confidence, kpis_mapped, node_count, edge_count')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none'])

    // Build team summaries
    const teamGraphs = workspaces.map(ws => {
      const wsProjects = (projects || []).filter(p => p.workspace_id === ws.id)
      const wsGraphs = (vilGraphs || []).filter(vg =>
        wsProjects.some(p => p.id === vg.project_id)
      )

      // Compute team health score
      let healthScore = 50 // baseline
      if (wsGraphs.length > 0) {
        const avgNodes = wsGraphs.reduce((sum, g) => sum + (g.node_count || 0), 0) / wsGraphs.length
        const avgEdges = wsGraphs.reduce((sum, g) => sum + (g.edge_count || 0), 0) / wsGraphs.length
        const kpiCoverage = wsGraphs.reduce((sum, g) => sum + ((g.kpis_mapped as any[])?.length || 0), 0)

        // Score components
        healthScore = Math.min(100, Math.round(
          30 + // base
          Math.min(20, avgNodes * 2) + // node richness
          Math.min(15, avgEdges) + // relationship richness
          Math.min(20, kpiCoverage * 3) + // KPI coverage
          Math.min(15, wsProjects.length * 5) // project coverage
        ))
      }

      const status = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical'

      return {
        team_id: ws.id,
        team_name: ws.name,
        team_icon: ws.icon,
        team_slug: ws.slug,
        projects: wsProjects.map(p => ({
          id: p.id,
          name: p.name,
          icon: p.icon,
          color: p.color,
          has_graph: wsGraphs.some(g => g.project_id === p.id),
        })),
        health_score: healthScore,
        status,
        graph_data: wsGraphs.map(g => g.graph_data),
        industry_type: wsGraphs[0]?.industry_type || null,
      }
    })

    // Compute org-level health score (weighted average)
    const totalProjects = teamGraphs.reduce((sum, t) => sum + t.projects.length, 0)
    const orgHealthScore = totalProjects > 0
      ? Math.round(teamGraphs.reduce((sum, t) => sum + t.health_score * t.projects.length, 0) / totalProjects)
      : 0

    // Build org graph data (center org → teams → projects)
    const orgGraphNodes: any[] = [
      { id: 'org', type: 'org', label: org.name, value: orgHealthScore }
    ]
    const orgGraphEdges: any[] = []

    teamGraphs.forEach(team => {
      orgGraphNodes.push({
        id: `team:${team.team_id}`,
        type: 'team',
        label: team.team_name,
        value: team.health_score,
        metadata: { status: team.status, icon: team.team_icon, slug: team.team_slug },
      })
      orgGraphEdges.push({
        source: 'org',
        target: `team:${team.team_id}`,
        type: 'hierarchy',
        weight: 0.5,
      })

      team.projects.forEach(proj => {
        orgGraphNodes.push({
          id: `project:${proj.id}`,
          type: 'project',
          label: proj.name,
          parent: `team:${team.team_id}`,
          metadata: { icon: proj.icon, color: proj.color, has_graph: proj.has_graph },
        })
        orgGraphEdges.push({
          source: `team:${team.team_id}`,
          target: `project:${proj.id}`,
          type: 'hierarchy',
          weight: 0.3,
        })
      })
    })

    // Build team health scores map
    const teamHealthScores: Record<string, any> = {}
    teamGraphs.forEach(t => {
      teamHealthScores[t.team_id] = {
        score: t.health_score,
        status: t.status,
        name: t.team_name,
        icon: t.team_icon,
        slug: t.team_slug,
        project_count: t.projects.length,
        industry_type: t.industry_type,
      }
    })

    // Generate narratives (simplified — in production, call Claude via pipeline)
    const narrativeEn = `Across ${teamGraphs.length} teams and ${totalProjects} projects, the organization health score is ${orgHealthScore}/100. ` +
      teamGraphs.filter(t => t.status === 'critical').map(t => `${t.team_name} requires attention (score: ${t.health_score}).`).join(' ') +
      (teamGraphs.filter(t => t.status === 'critical').length === 0 ? 'All teams are operating within healthy parameters.' : '')

    const narrativeDe = `Über ${teamGraphs.length} Teams und ${totalProjects} Projekte beträgt der Organisations-Gesundheitswert ${orgHealthScore}/100. ` +
      teamGraphs.filter(t => t.status === 'critical').map(t => `${t.team_name} erfordert Aufmerksamkeit (Score: ${t.health_score}).`).join(' ') +
      (teamGraphs.filter(t => t.status === 'critical').length === 0 ? 'Alle Teams arbeiten innerhalb gesunder Parameter.' : '')

    // Upsert into org_vil_graphs
    const overviewData = {
      org_id: orgId,
      graph_data: { nodes: orgGraphNodes, edges: orgGraphEdges },
      narrative_de: narrativeDe,
      narrative_en: narrativeEn,
      cross_team_insights: [],
      team_health_scores: teamHealthScores,
      health_score: orgHealthScore,
      built_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await admin
      .from('org_vil_graphs')
      .select('id')
      .eq('org_id', orgId)
      .single()

    if (existing) {
      await admin.from('org_vil_graphs').update(overviewData).eq('id', existing.id)
    } else {
      await admin.from('org_vil_graphs').insert(overviewData)
    }

    return NextResponse.json({ exists: true, ...overviewData })
  } catch (error) {
    console.error('Overview build error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Build failed' },
      { status: 500 }
    )
  }
}
