import { describe, it, expect } from 'vitest'
import { projectUrl, workspaceUrl, orgUrl, newProjectUrl } from '@/lib/navigation'
import type { Organization, Workspace, Project } from '@/types/database'

const personalOrg: Organization = {
  id: 'org-1',
  name: 'Personal',
  slug: 'personal',
  type: 'personal',
  logo_url: null,
  plan: 'free',
  billing_email: null,
  owner_id: 'user-1',
  created_at: '2026-01-01',
}

const teamOrg: Organization = {
  id: 'org-2',
  name: 'Acme Corp',
  slug: 'acme',
  type: 'team',
  logo_url: null,
  plan: 'pro',
  billing_email: 'billing@acme.com',
  owner_id: 'user-1',
  created_at: '2026-01-01',
}

const workspace: Workspace = {
  id: 'ws-1',
  org_id: 'org-2',
  name: 'Marketing',
  slug: 'marketing',
  description: null,
  icon: 'chart',
  color: 'blue',
  created_at: '2026-01-01',
}

const project: Project = {
  id: 'proj-1',
  workspace_id: 'ws-1',
  org_id: 'org-2',
  name: 'Q1 Analysis',
  slug: 'q1-analysis',
  description: null,
  icon: 'bar-chart',
  color: 'green',
  created_by: 'user-1',
  created_at: '2026-01-01',
}

describe('projectUrl', () => {
  describe('personal org', () => {
    it('returns /projects/{id} for overview (default)', () => {
      expect(projectUrl(personalOrg, workspace, project)).toBe('/projects/proj-1')
    })

    it('returns /projects/{id} for explicit overview tab', () => {
      expect(projectUrl(personalOrg, workspace, project, 'overview')).toBe('/projects/proj-1')
    })

    it('returns /projects/{id}/sources for sources tab', () => {
      expect(projectUrl(personalOrg, workspace, project, 'sources')).toBe('/projects/proj-1/sources')
    })

    it('returns /projects/{id}/insights for insights tab', () => {
      expect(projectUrl(personalOrg, workspace, project, 'insights')).toBe('/projects/proj-1/insights')
    })

    it('returns /projects/{id}/ask for ask tab', () => {
      expect(projectUrl(personalOrg, workspace, project, 'ask')).toBe('/projects/proj-1/ask')
    })

    it('returns /projects/{id}/dashboard for dashboard tab', () => {
      expect(projectUrl(personalOrg, workspace, project, 'dashboard')).toBe('/projects/proj-1/dashboard')
    })

    it('returns /projects/{id}/settings for settings tab', () => {
      expect(projectUrl(personalOrg, workspace, project, 'settings')).toBe('/projects/proj-1/settings')
    })

    it('returns /projects/{id}/sources/new for sources/new tab', () => {
      expect(projectUrl(personalOrg, workspace, project, 'sources/new')).toBe('/projects/proj-1/sources/new')
    })
  })

  describe('team org', () => {
    it('returns /{orgSlug}/{wsSlug}/{projSlug} for overview', () => {
      expect(projectUrl(teamOrg, workspace, project)).toBe('/acme/marketing/q1-analysis')
    })

    it('returns /{orgSlug}/{wsSlug}/{projSlug}/sources for sources tab', () => {
      expect(projectUrl(teamOrg, workspace, project, 'sources')).toBe('/acme/marketing/q1-analysis/sources')
    })

    it('returns /{orgSlug}/{wsSlug}/{projSlug}/insights for insights tab', () => {
      expect(projectUrl(teamOrg, workspace, project, 'insights')).toBe('/acme/marketing/q1-analysis/insights')
    })
  })
})

describe('workspaceUrl', () => {
  describe('personal org', () => {
    it('returns /projects', () => {
      expect(workspaceUrl(personalOrg, workspace)).toBe('/projects')
    })

    it('returns /projects regardless of tab for personal', () => {
      expect(workspaceUrl(personalOrg, workspace, 'settings')).toBe('/projects')
    })
  })

  describe('team org', () => {
    it('returns /{orgSlug}/{wsSlug}', () => {
      expect(workspaceUrl(teamOrg, workspace)).toBe('/acme/marketing')
    })

    it('returns /{orgSlug}/{wsSlug}/settings for settings tab', () => {
      expect(workspaceUrl(teamOrg, workspace, 'settings')).toBe('/acme/marketing/settings')
    })

    it('returns /{orgSlug}/{wsSlug}/settings/members for members tab', () => {
      expect(workspaceUrl(teamOrg, workspace, 'settings/members')).toBe('/acme/marketing/settings/members')
    })
  })
})

describe('orgUrl', () => {
  describe('personal org', () => {
    it('returns /projects without tab', () => {
      expect(orgUrl(personalOrg)).toBe('/projects')
    })

    it('returns /settings/members for settings/members tab', () => {
      expect(orgUrl(personalOrg, 'settings/members')).toBe('/settings/members')
    })

    it('returns /settings/billing for settings/billing tab', () => {
      expect(orgUrl(personalOrg, 'settings/billing')).toBe('/settings/billing')
    })

    it('returns /settings/api-keys for settings/api-keys tab', () => {
      expect(orgUrl(personalOrg, 'settings/api-keys')).toBe('/settings/api-keys')
    })

    it('returns /settings/settings for settings tab (replace strips "settings/" prefix)', () => {
      // orgUrl for personal: `/settings/${tab.replace('settings/', '')}` — when tab is 'settings', replace yields 'settings'
      expect(orgUrl(personalOrg, 'settings')).toBe('/settings/settings')
    })
  })

  describe('team org', () => {
    it('returns /{orgSlug} without tab', () => {
      expect(orgUrl(teamOrg)).toBe('/acme')
    })

    it('returns /{orgSlug}/settings for settings tab', () => {
      expect(orgUrl(teamOrg, 'settings')).toBe('/acme/settings')
    })

    it('returns /{orgSlug}/settings/billing for billing tab', () => {
      expect(orgUrl(teamOrg, 'settings/billing')).toBe('/acme/settings/billing')
    })
  })
})

describe('newProjectUrl', () => {
  it('returns /projects/new for personal org', () => {
    expect(newProjectUrl(personalOrg, workspace)).toBe('/projects/new')
  })

  it('returns /{orgSlug}/{wsSlug}/new for team org', () => {
    expect(newProjectUrl(teamOrg, workspace)).toBe('/acme/marketing/new')
  })
})
