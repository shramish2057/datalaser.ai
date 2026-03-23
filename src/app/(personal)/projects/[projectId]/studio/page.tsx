'use client'
import { useTranslations } from 'next-intl'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { FlaskConical } from 'lucide-react'

export default function StudioRedirectPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function redirect() {
      // Check for existing notebooks
      const { data: notebooks } = await supabase
        .from('studio_notebooks')
        .select('id')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (notebooks && notebooks.length > 0) {
        router.replace(`/projects/${projectId}/studio/${notebooks[0].id}`)
        return
      }

      // Create first notebook
      const { data: proj } = await supabase
        .from('projects').select('org_id').eq('id', projectId).single()

      const res = await fetch('/api/studio/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          org_id: proj?.org_id,
          title: 'First Analysis',
        }),
      })
      const nb = await res.json()
      if (nb.id) {
        router.replace(`/projects/${projectId}/studio/${nb.id}`)
      }
    }
    redirect()
  }, [projectId])

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <FlaskConical size={48} className="text-dl-text-light animate-pulse mb-4" />
      <p className="text-dl-sm text-dl-text-medium">Opening Studio...</p>
    </div>
  )
}
