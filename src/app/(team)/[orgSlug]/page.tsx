'use client'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Layers } from 'lucide-react'
import type { Organization, Workspace } from '@/types/database'

export default function OrgHomePage() {
  const t = useTranslations()
  const [org, setOrg] = useState<Organization | null>(null)
  const [workspaces, setWorkspaces] = useState<(Workspace & { projectCount: number })[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const orgSlug = params.orgSlug as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: o } = await supabase
        .from('organizations').select('*').eq('slug', orgSlug).single()
      if (!o) { router.push('/projects'); return }
      setOrg(o)

      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)

      if (memberships && memberships.length > 0) {
        const wsIds = memberships.map(m => m.workspace_id)
        const { data: wsList } = await supabase
          .from('workspaces').select('*').eq('org_id', o.id).in('id', wsIds)
          .order('created_at', { ascending: true })

        const withCounts = await Promise.all((wsList ?? []).map(async ws => {
          const { count } = await supabase
            .from('projects').select('*', { count: 'exact', head: true })
            .eq('workspace_id', ws.id)
          return { ...ws, projectCount: count ?? 0 }
        }))
        setWorkspaces(withCounts)
      }

      setLoading(false)
    }
    load()
  }, [orgSlug])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-sans">
        <div className="text-dl-text-medium text-dl-base">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="font-sans">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">Workspaces</h1>
        <p className="text-dl-text-medium text-dl-base mb-8">Select a workspace to view its projects.</p>

        {workspaces.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-dl-bg-medium rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers size={28} className="text-dl-text-light" />
            </div>
            <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">No workspaces yet</h2>
            <p className="text-dl-text-medium text-dl-base mb-6">Create your first workspace to organize your projects.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => router.push(`/${orgSlug}/${ws.slug}`)}
                className="text-left dl-card p-5 hover:shadow-dl-md transition-all hover:border-dl-brand group"
              >
                <div className="w-10 h-10 rounded-dl-md flex items-center justify-center text-xl mb-3"
                  style={{ backgroundColor: (ws.color || '#4A9EDA') + '20' }}>
                  <span>{ws.icon || '💼'}</span>
                </div>
                <h3 className="text-dl-base font-black text-dl-text-dark mb-1 group-hover:text-dl-brand transition-colors">
                  {ws.name}
                </h3>
                <p className="text-dl-xs text-dl-text-light">
                  {ws.projectCount} project{ws.projectCount !== 1 ? 's' : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
