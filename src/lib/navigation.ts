import type { Organization, Workspace, Project } from '@/types/database'

export function projectUrl(
  org: Organization,
  workspace: Workspace,
  project: Project,
  tab: 'overview' | 'sources' | 'sources/new' | 'insights' | 'ask' | 'dashboard' | 'settings' = 'overview'
): string {
  if (org.type === 'personal') {
    const base = `/projects/${project.id}`
    return tab === 'overview' ? base : `${base}/${tab}`
  }
  const base = `/${org.slug}/${workspace.slug}/${project.slug}`
  return tab === 'overview' ? base : `${base}/${tab}`
}

export function workspaceUrl(
  org: Organization,
  workspace: Workspace,
  tab?: 'settings' | 'settings/members'
): string {
  if (org.type === 'personal') return '/projects'
  const base = `/${org.slug}/${workspace.slug}`
  return tab ? `${base}/${tab}` : base
}

export function orgUrl(
  org: Organization,
  tab?: 'settings' | 'settings/members' | 'settings/billing' | 'settings/api-keys'
): string {
  if (org.type === 'personal') return tab ? `/settings/${tab.replace('settings/', '')}` : '/projects'
  const base = `/${org.slug}`
  return tab ? `${base}/${tab}` : base
}

export function newProjectUrl(org: Organization, workspace: Workspace): string {
  if (org.type === 'personal') return '/projects/new'
  return `/${org.slug}/${workspace.slug}/new`
}
