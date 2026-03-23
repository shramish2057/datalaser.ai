'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StudioSidebar from '@/components/studio/StudioSidebar'
import type { StudioNotebook, StudioSource, QueryLibraryItem, SchemaColumn } from '@/types/studio'

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const [projectName, setProjectName] = useState('')
  const [notebooks, setNotebooks] = useState<StudioNotebook[]>([])
  const [sources, setSources] = useState<StudioSource[]>([])
  const [queryLibrary, setQueryLibrary] = useState<QueryLibraryItem[]>([])
  const [schemaColumns, setSchemaColumns] = useState<SchemaColumn[]>([])
  const [activeSourceName, setActiveSourceName] = useState('')
  const [loading, setLoading] = useState(true)

  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const projectId = params.projectId as string
  const notebookId = params.notebookId as string || ''

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // Project name
      const { data: proj } = await supabase
        .from('projects').select('name, org_id').eq('id', projectId).single()
      if (proj) setProjectName(proj.name)

      // Notebooks
      const { data: nbs } = await supabase
        .from('studio_notebooks').select('*').eq('project_id', projectId)
        .order('updated_at', { ascending: false })
      setNotebooks(nbs ?? [])

      // Data sources
      const { data: srcs } = await supabase
        .from('data_sources')
        .select('id, name, source_type, file_path, pipeline_status')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      const studioSources: StudioSource[] = (srcs ?? []).map(s => ({
        id: s.id, name: s.name, source_type: s.source_type,
        file_path: s.file_path, table_name: null,
        pipeline_status: s.pipeline_status || 'unprepared',
        isActive: true,
      }))
      setSources(studioSources)

      // Schema columns from first source
      if (srcs && srcs.length > 0) {
        const first = srcs[0]
        setActiveSourceName(first.name)
        const { data: fullSrc } = await supabase
          .from('data_sources').select('schema_snapshot, sample_data')
          .eq('id', first.id).single()
        if (fullSrc) {
          const schema = fullSrc.schema_snapshot as { tables?: { columns: { name: string; type: string }[] }[] } | null
          const sample = fullSrc.sample_data as { tables?: { columns: string[]; rows: string[][] }[] } | null
          if (schema?.tables?.[0]) {
            const cols: SchemaColumn[] = schema.tables[0].columns.map((c, i) => {
              const sampleVals = sample?.tables?.[0]?.rows?.map(r => r[i] || '').slice(0, 3) || []
              return { name: c.name, dtype: c.type || 'text', null_rate: 0, sample_values: sampleVals }
            })
            setSchemaColumns(cols)
          }
        }
      }

      // Query library
      if (proj?.org_id) {
        const { data: ql } = await supabase
          .from('query_library').select('*').eq('org_id', proj.org_id)
          .order('use_count', { ascending: false }).limit(10)
        setQueryLibrary(ql ?? [])
      }

      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white font-sans">
        <div className="text-mb-text-medium text-mb-sm">Loading Studio...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white font-sans">
      {/* Top bar */}
      <div className="h-[48px] flex items-center justify-between border-b border-mb-border px-4 flex-shrink-0">
        <Link href={`/projects/${projectId}`} className="flex items-center gap-1.5 text-mb-sm text-mb-text-medium hover:text-mb-text-dark transition-colors">
          <ChevronLeft size={16} />
          {projectName}
        </Link>
        <span className="text-mb-sm font-semibold text-mb-text-dark tracking-wide">Studio</span>
        <div className="w-[100px]" /> {/* Spacer for balance */}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <StudioSidebar
          projectId={projectId}
          notebooks={notebooks}
          sources={sources}
          activeNotebookId={notebookId}
          schemaColumns={schemaColumns}
          activeSourceName={activeSourceName}
          queryLibrary={queryLibrary}
          onNotebookCreated={(nb) => setNotebooks(prev => [nb, ...prev])}
          onSourceConnected={(src) => setSources(prev => [src, ...prev])}
          onNotebookDeleted={(id) => setNotebooks(prev => prev.filter(nb => nb.id !== id))}
          onNotebookRenamed={(id, title) => setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, title } : nb))}
          onSourceDeleted={(id) => setSources(prev => prev.filter(s => s.id !== id))}
        />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
