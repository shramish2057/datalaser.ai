'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Plus, Database, Copy, Check, UploadCloud, X
} from 'lucide-react'
import type { StudioNotebook, StudioSource, QueryLibraryItem, SchemaColumn } from '@/types/studio'
import { useDropzone } from 'react-dropzone'

const OP_COLORS: Record<string, string> = {
  regression: 'bg-indigo-100 text-indigo-700',
  anova: 'bg-purple-100 text-purple-700',
  correlation: 'bg-teal-100 text-teal-700',
  ttest: 'bg-blue-100 text-blue-700',
  chisquare: 'bg-orange-100 text-orange-700',
  forecast: 'bg-green-100 text-green-700',
  descriptive: 'bg-mb-bg-medium text-mb-text-medium',
  custom: 'bg-mb-bg-medium text-mb-text-medium',
}

type Props = {
  projectId: string
  notebooks: StudioNotebook[]
  sources: StudioSource[]
  activeNotebookId: string
  schemaColumns: SchemaColumn[]
  activeSourceName: string
  queryLibrary: QueryLibraryItem[]
  onNotebookCreated: (nb: StudioNotebook) => void
  onSourceConnected: (src: StudioSource) => void
}

export default function StudioSidebar({
  projectId, notebooks, sources, activeNotebookId,
  schemaColumns, activeSourceName, queryLibrary,
  onNotebookCreated, onSourceConnected,
}: Props) {
  const router = useRouter()
  const [creatingNotebook, setCreatingNotebook] = useState(false)
  const [copiedCol, setCopiedCol] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)

  const base = `/projects/${projectId}/studio`

  const handleNewNotebook = async () => {
    setCreatingNotebook(true)
    try {
      const res = await fetch('/api/studio/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      const nb = await res.json()
      if (nb.id) {
        onNotebookCreated(nb)
        router.push(`${base}/${nb.id}`)
      }
    } finally {
      setCreatingNotebook(false)
    }
  }

  const copyColumnName = (name: string) => {
    navigator.clipboard.writeText(name)
    setCopiedCol(name)
    setTimeout(() => setCopiedCol(null), 1500)
  }

  const insertFromLibrary = (code: string, title: string) => {
    window.dispatchEvent(new CustomEvent('studio:insert-code', { detail: { code, title } }))
  }

  return (
    <>
      <aside className="w-[220px] flex-shrink-0 h-full bg-mb-bg-light border-r border-mb-border overflow-y-auto flex flex-col">

        {/* SECTION: DATA SOURCES */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light px-1 mb-1.5">
            Data Sources
          </p>
          {sources.map(src => (
            <div key={src.id} className="flex items-center gap-2 px-2 h-[32px] rounded-mb-md hover:bg-mb-bg-medium cursor-pointer">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                src.pipeline_status === 'ready' ? 'bg-mb-success' :
                src.pipeline_status === 'scheduled' ? 'bg-mb-brand' : 'bg-mb-border-dark'
              }`} />
              <span className="text-[13px] text-mb-text-dark truncate flex-1" style={{ maxWidth: 140 }}>
                {src.name}
              </span>
              <span className="text-[10px] text-mb-text-light flex-shrink-0 uppercase">
                {src.source_type === 'postgres' ? 'PG' :
                 src.source_type === 'mysql' ? 'SQL' :
                 src.source_type.toUpperCase().slice(0, 4)}
              </span>
            </div>
          ))}
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-mb-brand hover:bg-mb-brand-hover rounded-mb-md w-full mt-1"
          >
            <Plus size={12} /> Connect source
          </button>
        </div>

        <div className="h-px bg-mb-border mx-3 my-1" />

        {/* SECTION: NOTEBOOKS */}
        <div className="px-3 py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light px-1 mb-1.5">
            Notebooks
          </p>
          {notebooks.map(nb => {
            const active = nb.id === activeNotebookId
            return (
              <button
                key={nb.id}
                onClick={() => router.push(`${base}/${nb.id}`)}
                className={`flex items-center gap-2 px-2 h-[32px] rounded-mb-md w-full text-left
                  ${active ? 'bg-mb-brand-hover text-mb-brand' : 'hover:bg-mb-bg-medium text-mb-text-dark'}`}
              >
                <BookOpen size={14} className="flex-shrink-0" />
                <span className="text-[13px] truncate" style={{ maxWidth: 130 }}>{nb.title}</span>
              </button>
            )
          })}
          <button
            onClick={handleNewNotebook}
            disabled={creatingNotebook}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-mb-brand hover:bg-mb-brand-hover rounded-mb-md w-full mt-1"
          >
            <Plus size={12} /> {creatingNotebook ? 'Creating...' : 'New Analysis'}
          </button>
        </div>

        <div className="h-px bg-mb-border mx-3 my-1" />

        {/* SECTION: QUERY LIBRARY */}
        <div className="px-3 py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light px-1 mb-1.5">
            Saved Queries
          </p>
          {queryLibrary.length === 0 ? (
            <p className="text-[11px] text-mb-text-light px-1 py-2">No saved queries yet</p>
          ) : (
            queryLibrary.slice(0, 5).map(q => (
              <button
                key={q.id}
                onClick={() => insertFromLibrary(q.code, q.title)}
                className="w-full text-left px-2 py-1.5 rounded-mb-md hover:bg-mb-bg-medium"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${OP_COLORS[q.operation] || OP_COLORS.custom}`}>
                    {q.operation}
                  </span>
                  <span className="text-[12px] text-mb-text-dark truncate">{q.title}</span>
                </div>
                <span className="text-[10px] text-mb-text-light ml-7">{q.use_count} uses</span>
              </button>
            ))
          )}
        </div>

        <div className="h-px bg-mb-border mx-3 my-1" />

        {/* SECTION: SCHEMA */}
        <div className="px-3 py-1 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light px-1 mb-1.5">
            Schema
          </p>
          {!activeSourceName ? (
            <p className="text-[11px] text-mb-text-light px-1">Select a source above</p>
          ) : (
            <>
              <p className="text-[11px] font-medium text-mb-text-medium px-1 mb-2">{activeSourceName}</p>
              {schemaColumns.map(col => (
                <button
                  key={col.name}
                  onClick={() => copyColumnName(col.name)}
                  className="flex items-center gap-1.5 px-2 py-1 w-full rounded hover:bg-mb-bg-medium group"
                  title="Click to copy"
                >
                  <span className="font-mono text-[11px] text-mb-text-dark truncate flex-1 text-left">
                    {col.name}
                  </span>
                  {copiedCol === col.name ? (
                    <Check size={10} className="text-mb-success flex-shrink-0" />
                  ) : (
                    <Copy size={10} className="text-mb-text-light opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  )}
                  <span className={`text-[10px] flex-shrink-0 ${
                    col.dtype === 'numeric' ? 'text-blue-600' :
                    col.dtype === 'categorical' ? 'text-purple-600' :
                    col.dtype === 'date' ? 'text-green-600' : 'text-mb-text-light'
                  }`}>
                    {col.dtype.slice(0, 3)}
                  </span>
                  {col.null_rate > 0.05 && (
                    <span className="text-[9px] text-mb-error flex-shrink-0">{Math.round(col.null_rate * 100)}%</span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Connect source modal — simplified */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowConnectModal(false)}>
          <div className="bg-white rounded-mb-lg shadow-xl w-[480px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-mb-border">
              <h3 className="text-mb-base font-black text-mb-text-dark">Connect a data source</h3>
              <button onClick={() => setShowConnectModal(false)} className="text-mb-text-light hover:text-mb-text-dark">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <ConnectSourceUpload
                projectId={projectId}
                onDone={(src) => {
                  onSourceConnected(src)
                  setShowConnectModal(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ConnectSourceUpload({ projectId, onDone }: { projectId: string; onDone: (src: StudioSource) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/json': ['.json'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    onDrop: async (files) => {
      const file = files[0]
      if (!file) return
      setUploading(true)
      setError('')
      try {
        // Quick upload via the prep page's pattern
        const { createBrowserClient } = await import('@supabase/auth-helpers-nextjs')
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        await supabase.from('profiles').upsert({ id: user.id, workspace_name: 'workspace' })
        const ext = file.name.split('.').pop()?.toLowerCase() || 'csv'
        const { data: inserted } = await supabase.from('data_sources').insert({
          workspace_id: user.id, project_id: projectId, name: file.name,
          source_type: ext, category: 'file', status: 'active', row_count: 0, sync_frequency: 'manual',
        }).select('id').single()

        if (inserted) {
          const path = `${user.id}/${inserted.id}/${file.name}`
          await supabase.storage.from('data-sources').upload(path, file, { upsert: true })
          await supabase.from('data_sources').update({ file_path: path }).eq('id', inserted.id)
          onDone({ id: inserted.id, name: file.name, source_type: ext, file_path: path, table_name: null, pipeline_status: 'unprepared', isActive: true })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
  })

  return (
    <div>
      <div {...getRootProps()} className={`border-2 border-dashed rounded-mb-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-mb-brand bg-mb-brand-hover' : 'border-mb-border-dark hover:border-mb-brand'}`}>
        <input {...getInputProps()} />
        <UploadCloud className="w-8 h-8 text-mb-text-light mx-auto mb-2" />
        <p className="text-mb-text-medium text-mb-sm">{uploading ? 'Uploading...' : 'Drop a file here'}</p>
        <p className="text-mb-text-light text-mb-xs mt-1">CSV, Excel, or JSON</p>
      </div>
      {error && <p className="text-mb-error text-mb-xs mt-2">{error}</p>}
    </div>
  )
}
