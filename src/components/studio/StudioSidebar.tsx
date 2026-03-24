'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Plus, Database, Copy, Check, UploadCloud, X,
  MoreHorizontal, Pencil, Trash2, Server, Network
} from 'lucide-react'
import Link from 'next/link'
import type { StudioNotebook, StudioSource, QueryLibraryItem, SchemaColumn } from '@/types/studio'
import { useDropzone } from 'react-dropzone'
import { useTranslations } from 'next-intl'

const OP_COLORS: Record<string, string> = {
  regression: 'bg-indigo-100 text-indigo-700',
  anova: 'bg-purple-100 text-purple-700',
  correlation: 'bg-teal-100 text-teal-700',
  ttest: 'bg-blue-100 text-blue-700',
  chisquare: 'bg-orange-100 text-orange-700',
  forecast: 'bg-green-100 text-green-700',
  descriptive: 'bg-dl-bg-medium text-dl-text-medium',
  custom: 'bg-dl-bg-medium text-dl-text-medium',
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
  onNotebookDeleted?: (id: string) => void
  onNotebookRenamed?: (id: string, title: string) => void
  onSourceDeleted?: (id: string) => void
}

export default function StudioSidebar({
  projectId, notebooks, sources, activeNotebookId,
  schemaColumns, activeSourceName, queryLibrary,
  onNotebookCreated, onSourceConnected,
  onNotebookDeleted, onNotebookRenamed, onSourceDeleted,
}: Props) {
  const router = useRouter()
  const t = useTranslations()
  const [creatingNotebook, setCreatingNotebook] = useState(false)
  const [copiedCol, setCopiedCol] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)

  // Notebook menu state
  const [nbMenuId, setNbMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  // Source menu state
  const [srcMenuId, setSrcMenuId] = useState<string | null>(null)

  const base = `/projects/${projectId}/studio`

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

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

  const handleRenameNotebook = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return }
    try {
      await fetch(`/api/studio/notebooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameValue.trim() }),
      })
      onNotebookRenamed?.(id, renameValue.trim())
    } catch {}
    setRenamingId(null)
  }

  const handleDeleteNotebook = async (id: string) => {
    if (notebooks.length <= 1) return // Don't delete last notebook
    try {
      await fetch(`/api/studio/notebooks/${id}`, { method: 'DELETE' })
      onNotebookDeleted?.(id)
      if (id === activeNotebookId && notebooks.length > 1) {
        const next = notebooks.find(nb => nb.id !== id)
        if (next) router.push(`${base}/${next.id}`)
      }
    } catch {}
    setNbMenuId(null)
  }

  const handleDeleteSource = async (id: string) => {
    try {
      const { createBrowserClient } = await import('@supabase/auth-helpers-nextjs')
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      await supabase.from('data_sources').update({ status: 'deleted' }).eq('id', id)
      onSourceDeleted?.(id)
    } catch {}
    setSrcMenuId(null)
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
      <aside className="w-[260px] flex-shrink-0 h-full bg-dl-bg-light border-r border-dl-border overflow-y-auto flex flex-col">

        {/* SECTION: DATA SOURCES */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light px-1 mb-1.5">
            {t('nav.dataSources')}
          </p>
          {sources.map(src => (
            <div key={src.id} className="flex items-center gap-2 px-2 h-[32px] rounded-dl-md hover:bg-dl-bg-medium cursor-pointer group relative">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                src.pipeline_status === 'ready' ? 'bg-dl-success' :
                src.pipeline_status === 'scheduled' ? 'bg-dl-brand' : 'bg-dl-border-dark'
              }`} />
              <span className="text-[13px] text-dl-text-dark truncate flex-1" style={{ maxWidth: 120 }}>
                {src.name}
              </span>
              <span className="text-dl-xs text-dl-text-light flex-shrink-0 uppercase">
                {src.source_type === 'postgres' ? 'PG' :
                 src.source_type === 'mysql' ? 'SQL' :
                 src.source_type.toUpperCase().slice(0, 4)}
              </span>
              <button
                onClick={e => { e.stopPropagation(); setSrcMenuId(srcMenuId === src.id ? null : src.id) }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-dl-bg-medium"
              >
                <MoreHorizontal size={12} className="text-dl-text-light" />
              </button>
              {srcMenuId === src.id && (
                <div className="absolute right-0 top-full z-20 bg-white border border-dl-border rounded shadow-lg py-1 w-36">
                  <button onClick={() => handleDeleteSource(src.id)}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-dl-error hover:bg-red-50 flex items-center gap-2">
                    <Trash2 size={11} /> {t('sources.removeSource')}
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-dl-brand hover:bg-dl-brand-hover rounded-dl-md w-full mt-1"
          >
            <Plus size={12} /> {t('studio.connectSource')}
          </button>
        </div>

        <div className="h-px bg-dl-border mx-3 my-1" />

        {/* SECTION: NOTEBOOKS */}
        <div className="px-3 py-1">
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light px-1 mb-1.5">
            {t('studio.notebooks')}
          </p>
          {notebooks.map(nb => {
            const active = nb.id === activeNotebookId
            return (
              <div key={nb.id} className="relative group">
                {renamingId === nb.id ? (
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameNotebook(nb.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameNotebook(nb.id); if (e.key === 'Escape') setRenamingId(null) }}
                    className="w-full px-2 h-[32px] text-[13px] border border-dl-brand rounded-dl-md outline-none bg-white"
                  />
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => router.push(`${base}/${nb.id}`)}
                      className={`flex items-center gap-2 px-2 h-[32px] rounded-dl-md flex-1 text-left
                        ${active ? 'bg-dl-brand-hover text-dl-brand' : 'hover:bg-dl-bg-medium text-dl-text-dark'}`}
                    >
                      <BookOpen size={14} className="flex-shrink-0" />
                      <span className="text-[13px] truncate" style={{ maxWidth: 110 }}>{nb.title}</span>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setNbMenuId(nbMenuId === nb.id ? null : nb.id) }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-dl-bg-medium flex-shrink-0"
                    >
                      <MoreHorizontal size={12} className="text-dl-text-light" />
                    </button>
                  </div>
                )}
                {nbMenuId === nb.id && (
                  <div className="absolute right-0 top-full z-20 bg-white border border-dl-border rounded shadow-lg py-1 w-36">
                    <button onClick={() => { setRenamingId(nb.id); setRenameValue(nb.title); setNbMenuId(null) }}
                      className="w-full text-left px-3 py-1.5 text-[12px] text-dl-text-dark hover:bg-dl-bg-light flex items-center gap-2">
                      <Pencil size={11} /> Rename
                    </button>
                    {notebooks.length > 1 && (
                      <button onClick={() => handleDeleteNotebook(nb.id)}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-dl-error hover:bg-red-50 flex items-center gap-2">
                        <Trash2 size={11} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <button
            onClick={handleNewNotebook}
            disabled={creatingNotebook}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-dl-brand hover:bg-dl-brand-hover rounded-dl-md w-full mt-1"
          >
            <Plus size={12} /> {creatingNotebook ? t('common.creating') : t('studio.newAnalysis')}
          </button>
        </div>

        <div className="h-px bg-dl-border mx-3 my-1" />

        {/* SECTION: QUERY LIBRARY */}
        <div className="px-3 py-1">
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light px-1 mb-1.5">
            {t('studio.savedQueries')}
          </p>
          {queryLibrary.length === 0 ? (
            <p className="text-dl-xs text-dl-text-light px-1 py-2">{t('studio.noSavedQueries')}</p>
          ) : (
            queryLibrary.slice(0, 5).map(q => (
              <button
                key={q.id}
                onClick={() => insertFromLibrary(q.code, q.title)}
                className="w-full text-left px-2 py-1.5 rounded-dl-md hover:bg-dl-bg-medium"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-dl-xs font-bold ${OP_COLORS[q.operation] || OP_COLORS.custom}`}>
                    {q.operation}
                  </span>
                  <span className="text-[12px] text-dl-text-dark truncate">{q.title}</span>
                </div>
                <span className="text-dl-xs text-dl-text-light ml-7">{q.use_count} uses</span>
              </button>
            ))
          )}
        </div>

        <div className="h-px bg-dl-border mx-3 my-1" />

        {/* SECTION: SCHEMA */}
        <div className="px-3 py-1 flex-1">
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light px-1 mb-1.5">
            {t('studio.schema')}
          </p>
          {!activeSourceName ? (
            <p className="text-dl-xs text-dl-text-light px-1">{t('studio.selectSource')}</p>
          ) : (
            <>
              <p className="text-dl-xs font-medium text-dl-text-medium px-1 mb-2">{activeSourceName}</p>
              {schemaColumns.map(col => (
                <button
                  key={col.name}
                  onClick={() => copyColumnName(col.name)}
                  className="flex items-center gap-1.5 px-2 py-1 w-full rounded hover:bg-dl-bg-medium group"
                  title={t("common.copy")}
                >
                  <span className="font-mono text-dl-xs text-dl-text-dark truncate flex-1 text-left">
                    {col.name}
                  </span>
                  {copiedCol === col.name ? (
                    <Check size={10} className="text-dl-success flex-shrink-0" />
                  ) : (
                    <Copy size={10} className="text-dl-text-light opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  )}
                  <span className={`text-dl-xs flex-shrink-0 ${
                    col.dtype === 'numeric' ? 'text-blue-600' :
                    col.dtype === 'categorical' ? 'text-purple-600' :
                    col.dtype === 'date' ? 'text-green-600' : 'text-dl-text-light'
                  }`}>
                    {col.dtype.slice(0, 3)}
                  </span>
                  {col.null_rate > 0.05 && (
                    <span className="text-[9px] text-dl-error flex-shrink-0">{Math.round(col.null_rate * 100)}%</span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Visual Graph mini-view */}
        <div className="h-px bg-dl-border mx-3 my-1" />
        <div className="px-3 py-1">
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light px-1 mb-1.5">
            Visual Graph
          </p>
          <Link
            href={`/projects/${projectId}/graph`}
            className="flex items-center gap-2 px-2 py-2 rounded-dl-md hover:bg-dl-bg-medium text-dl-xs text-dl-text-medium hover:text-dl-brand transition-colors"
          >
            <Network size={14} />
            <span>Open Visual Graph</span>
          </Link>
        </div>
      </aside>

      {/* Connect source modal — tabs for File Upload + Database */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowConnectModal(false)}>
          <div className="bg-white rounded-dl-lg shadow-xl w-[520px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-dl-border">
              <h3 className="text-dl-base font-black text-dl-text-dark">Connect a data source</h3>
              <button onClick={() => setShowConnectModal(false)} className="text-dl-text-light hover:text-dl-text-dark">
                <X size={16} />
              </button>
            </div>
            <ConnectSourceModal
              projectId={projectId}
              onDone={(src) => {
                onSourceConnected(src)
                setShowConnectModal(false)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}


// ── Connect Source Modal with File + Database tabs ──

const DB_CONNECTORS = [
  { id: 'postgres', name: 'PostgreSQL', icon: 'PG', fields: ['host', 'port', 'database', 'username', 'password'] },
  { id: 'mysql', name: 'MySQL', icon: 'SQL', fields: ['host', 'port', 'database', 'username', 'password'] },
  { id: 'mssql', name: 'SQL Server', icon: 'MS', fields: ['host', 'port', 'database', 'username', 'password'] },
  { id: 'mongodb', name: 'MongoDB', icon: 'MG', fields: ['connection_string'] },
  { id: 'snowflake', name: 'Snowflake', icon: 'SF', fields: ['account', 'warehouse', 'database', 'schema', 'username', 'password'] },
  { id: 'bigquery', name: 'BigQuery', icon: 'BQ', fields: ['project_id', 'credentials_json'] },
  { id: 'redshift', name: 'Redshift', icon: 'RS', fields: ['host', 'port', 'database', 'username', 'password'] },
]

function ConnectSourceModal({ projectId, onDone }: { projectId: string; onDone: (src: StudioSource) => void }) {
  const t = useTranslations()
  const [tab, setTab] = useState<'file' | 'database'>('file')

  return (
    <div>
      <div className="flex border-b border-dl-border">
        <button onClick={() => setTab('file')}
          className={`flex-1 py-2.5 text-[13px] font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
            tab === 'file' ? 'border-dl-brand text-dl-brand' : 'border-transparent text-dl-text-medium hover:text-dl-text-dark'
          }`}>
          <UploadCloud size={14} /> {t('sources.fileUpload')}
        </button>
        <button onClick={() => setTab('database')}
          className={`flex-1 py-2.5 text-[13px] font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
            tab === 'database' ? 'border-dl-brand text-dl-brand' : 'border-transparent text-dl-text-medium hover:text-dl-text-dark'
          }`}>
          <Server size={14} /> {t('sources.database')}
        </button>
      </div>
      <div className="p-4">
        {tab === 'file' ? (
          <ConnectSourceUpload projectId={projectId} onDone={onDone} />
        ) : (
          <ConnectDatabaseForm projectId={projectId} onDone={onDone} />
        )}
      </div>
    </div>
  )
}


function ConnectSourceUpload({ projectId, onDone }: { projectId: string; onDone: (src: StudioSource) => void }) {
  const t = useTranslations()
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
      <div {...getRootProps()} className={`border-2 border-dashed rounded-dl-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-dl-brand bg-dl-brand-hover' : 'border-dl-border-dark hover:border-dl-brand'}`}>
        <input {...getInputProps()} />
        <UploadCloud className="w-8 h-8 text-dl-brand/60 mx-auto mb-2" />
        <p className="text-dl-text-medium text-dl-sm">{uploading ? t('common.upload') + '...' : t('sources.dropFile')}</p>
        <p className="text-dl-text-light text-dl-xs mt-1">{t('sources.csvExcelJson')}</p>
      </div>
      {error && <p className="text-dl-error text-dl-xs mt-2">{error}</p>}
    </div>
  )
}


function ConnectDatabaseForm({ projectId, onDone }: { projectId: string; onDone: (src: StudioSource) => void }) {
  const t = useTranslations()
  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [sourceName, setSourceName] = useState('')
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState('')

  const connector = DB_CONNECTORS.find(c => c.id === selectedDb)

  const handleTest = async () => {
    if (!connector) return
    setTesting(true); setTestResult(null); setError('')
    try {
      const res = await fetch('/api/sources/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: connector.id, credentials: fields }),
      })
      const data = await res.json()
      setTestResult({ ok: data.success, message: data.success ? 'Connection successful' : (data.error || 'Connection failed') })
    } catch {
      setTestResult({ ok: false, message: 'Connection test failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = async () => {
    if (!connector || !testResult?.ok) return
    setConnecting(true); setError('')
    try {
      const category = ['snowflake', 'bigquery', 'redshift'].includes(connector.id) ? 'warehouse' : 'database'
      const res = await fetch('/api/sources/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          source_type: connector.id,
          category,
          name: sourceName || `${connector.name} Database`,
          credentials: fields,
        }),
      })
      const data = await res.json()
      if (data.success && data.source) {
        onDone({
          id: data.source.id, name: data.source.name,
          source_type: connector.id, file_path: null,
          table_name: null, pipeline_status: 'ready', isActive: true,
        })
      } else {
        setError(data.error || 'Failed to connect')
      }
    } catch {
      setError('Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  if (!selectedDb) {
    return (
      <div className="space-y-2">
        <p className="text-dl-text-medium text-[13px] mb-3">{t('sources.selectDatabase')}</p>
        {DB_CONNECTORS.map(db => (
          <button key={db.id} onClick={() => { setSelectedDb(db.id); setFields({}); setTestResult(null) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-dl-md border border-dl-border hover:border-dl-brand hover:bg-dl-brand-hover transition-colors text-left">
            <div className="w-8 h-8 rounded-dl-md bg-dl-bg-medium flex items-center justify-center text-dl-xs font-bold text-dl-text-medium flex-shrink-0">
              {db.icon}
            </div>
            <span className="text-[13px] font-medium text-dl-text-dark">{db.name}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => { setSelectedDb(null); setTestResult(null); setError('') }}
        className="text-[12px] text-dl-brand hover:underline mb-3">
        ← Back to database list
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-dl-md bg-dl-bg-medium flex items-center justify-center text-dl-xs font-bold text-dl-text-medium">
          {connector!.icon}
        </div>
        <span className="text-[14px] font-bold text-dl-text-dark">{connector!.name}</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-dl-xs font-semibold text-dl-text-medium uppercase tracking-wider">Display Name</label>
          <input value={sourceName} onChange={e => setSourceName(e.target.value)}
            placeholder={t('sources.displayName')}
            className="w-full mt-1 px-3 py-2 text-[13px] border border-dl-border rounded-dl-md outline-none focus:border-dl-brand" />
        </div>
        {connector!.fields.map(field => (
          <div key={field}>
            <label className="text-dl-xs font-semibold text-dl-text-medium uppercase tracking-wider">
              {field.replace(/_/g, ' ')}
            </label>
            <input
              type={field === 'password' || field === 'credentials_json' ? 'password' : 'text'}
              value={fields[field] || ''}
              onChange={e => setFields(prev => ({ ...prev, [field]: e.target.value }))}
              placeholder={field === 'port' ? '5432' : field === 'host' ? 'localhost' : ''}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-dl-border rounded-dl-md outline-none focus:border-dl-brand font-mono"
            />
          </div>
        ))}
      </div>

      {testResult && (
        <div className={`mt-3 px-3 py-2 rounded-dl-md text-[12px] ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {testResult.message}
        </div>
      )}
      {error && <p className="text-dl-error text-dl-xs mt-2">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={handleTest} disabled={testing}
          className="flex-1 py-2 text-[13px] font-medium border border-dl-border rounded-dl-md hover:border-dl-brand hover:text-dl-brand transition-colors disabled:opacity-50">
          {testing ? t('sources.testing') : t('sources.testConnection')}
        </button>
        <button onClick={handleConnect} disabled={!testResult?.ok || connecting}
          className="flex-1 py-2 text-[13px] font-bold text-white bg-dl-brand rounded-dl-md hover:bg-dl-brand-dark transition-colors disabled:opacity-50">
          {connecting ? t('sources.connecting') : t('sources.connect')}
        </button>
      </div>
    </div>
  )
}
