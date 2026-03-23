'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Plus, Play, Loader2, Lightbulb, ChevronDown, ChevronRight, Send, FlaskConical,
  Heading1, Type, Code
} from 'lucide-react'
import type { StudioCell, StudioNotebook, StudioSource, ProactiveSuggestion, SchemaColumn } from '@/types/studio'
import { buildSchemaContext } from '@/lib/studio/buildSchemaContext'
import CellCard from '@/components/studio/CellCard'
import OutputPanel from '@/components/studio/OutputPanel'
import SaveToLibraryModal from '@/components/studio/SaveToLibraryModal'

function detectOperation(code: string): string {
  const c = code.toLowerCase()
  if (c.includes('regression') || c.includes('ols')) return 'regression'
  if (c.includes('anova') || c.includes('f_oneway')) return 'anova'
  if (c.includes('corr')) return 'correlation'
  if (c.includes('ttest')) return 'ttest'
  if (c.includes('chi2') || c.includes('crosstab')) return 'chisquare'
  if (c.includes('describe')) return 'descriptive'
  return 'custom'
}

function extractColumns(code: string, columns: SchemaColumn[]): string[] {
  return columns.filter(c => code.includes(c.name)).map(c => c.name)
}

const CYCLING_MSGS = [
  'Analysing your data schema...', 'Planning analysis structure...',
  'Writing statistical code...', 'Building visualisations...', 'Almost ready...',
]

export default function NotebookWorkspace() {
  const params = useParams()
  const projectId = params.projectId as string
  const notebookId = params.notebookId as string

  const [notebook, setNotebook] = useState<StudioNotebook | null>(null)
  const [cells, setCells] = useState<StudioCell[]>([])
  const [activeCellId, setActiveCellId] = useState<string | null>(null)
  const [sources, setSources] = useState<StudioSource[]>([])
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null)
  const fileRef = useRef<File | null>(null)
  const [proactive, setProactive] = useState<ProactiveSuggestion[]>([])
  const [isLoadingProactive, setIsLoadingProactive] = useState(false)
  const [proactiveCollapsed, setProactiveCollapsed] = useState(false)
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [schemaColumns, setSchemaColumns] = useState<SchemaColumn[]>([])
  const [schemaContext, setSchemaContext] = useState('')
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)
  const [libraryCell, setLibraryCell] = useState<StudioCell | null>(null)
  const [notebookTitle, setNotebookTitle] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [cycleIdx, setCycleIdx] = useState(0)
  const saveTimeout = useRef<NodeJS.Timeout>(null)

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  // ── Load data ──
  useEffect(() => {
    async function load() {
      const nbRes = await fetch(`/api/studio/notebooks/${notebookId}`)
      const nb = await nbRes.json()
      if (nb.id) { setNotebook(nb); setCells(nb.cells || []); setNotebookTitle(nb.title) }

      const { data: proj } = await supabase.from('projects').select('org_id').eq('id', projectId).single()
      if (proj) setOrgId(proj.org_id)

      const { data: srcs } = await supabase.from('data_sources')
        .select('id, name, source_type, file_path, pipeline_status, schema_snapshot, sample_data')
        .eq('project_id', projectId).eq('status', 'active').order('created_at', { ascending: false })

      const mapped: StudioSource[] = (srcs ?? []).map(s => ({
        id: s.id, name: s.name, source_type: s.source_type, file_path: s.file_path,
        table_name: null, pipeline_status: s.pipeline_status || 'unprepared', isActive: false,
      }))

      if (mapped.length > 0) {
        const readyId = mapped.find(s => s.pipeline_status === 'ready')?.id || mapped[0].id
        mapped.forEach(s => { s.isActive = s.id === readyId })
        setSources(mapped); setActiveSourceId(readyId)

        const active = srcs?.find(s => s.id === readyId)
        if (active?.file_path) {
          const { data: blob } = await supabase.storage.from('data-sources').download(active.file_path)
          if (blob) fileRef.current = new File([blob], active.name, { type: 'text/csv' })
        }

        if (active?.schema_snapshot) {
          const schema = active.schema_snapshot as { tables?: { columns: { name: string; type: string }[] }[] }
          const sample = active.sample_data as { tables?: { columns: string[]; rows: string[][] }[] } | null
          if (schema.tables?.[0]) {
            const cols: SchemaColumn[] = schema.tables[0].columns.map((c, i) => ({
              name: c.name, dtype: c.type || 'text', null_rate: 0,
              sample_values: sample?.tables?.[0]?.rows?.map(r => r[i] || '').slice(0, 3) || [],
            }))
            setSchemaColumns(cols)
            setSchemaContext(buildSchemaContext(active.name, cols, 80, nb.cells || []))

            setIsLoadingProactive(true)
            try {
              const pRes = await fetch('/api/studio/proactive', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_name: active.name, quality_score: 80, warnings: [], columns: cols, source_id: readyId }),
              })
              const suggestions = await pRes.json()
              if (Array.isArray(suggestions)) setProactive(suggestions)
            } catch {} finally { setIsLoadingProactive(false) }
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [notebookId, projectId])

  // Cycling messages
  useEffect(() => {
    if (!isGenerating) return
    const iv = setInterval(() => setCycleIdx(p => (p + 1) % CYCLING_MSGS.length), 3000)
    return () => clearInterval(iv)
  }, [isGenerating])

  // Auto-save
  useEffect(() => {
    if (!notebook || cells.length === 0) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setIsSaving(true)
      await fetch(`/api/studio/notebooks/${notebookId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cells }),
      })
      setIsSaving(false); setLastSavedAt(new Date())
    }, 2000)
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current) }
  }, [cells])

  // Listen for sidebar code insert
  useEffect(() => {
    const handler = (e: Event) => {
      const { code } = (e as CustomEvent).detail
      const c: StudioCell = { id: crypto.randomUUID(), type: 'python', code, output: null, status: 'idle', created_at: new Date().toISOString() }
      setCells(prev => [...prev, c]); setActiveCellId(c.id)
    }
    window.addEventListener('studio:insert-code', handler)
    return () => window.removeEventListener('studio:insert-code', handler)
  }, [])

  // ── Cell execution ──
  async function runCell(cellId: string) {
    const cell = cells.find(c => c.id === cellId)
    if (!cell || cell.type === 'heading' || cell.type === 'text') return

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, status: 'running' as const, output: null } : c))
    const startTime = Date.now()
    const src = sources.find(s => s.id === activeSourceId)

    try {
      const fileTypes = ['csv', 'xlsx', 'xls', 'json', 'parquet', 'file']
      const isFile = !src || fileTypes.includes(src.source_type) || !!src.file_path

      let codeToRun = cell.code
      if (cell.type === 'sql') {
        codeToRun = `import pandas as pd\ntry:\n    import pandasql as ps\n    result = ps.sqldf("""${cell.code}""", {'df': df})\nexcept ImportError:\n    result = df.head(10)`
      }

      let execResult: Record<string, unknown>
      if (isFile) {
        if (!fileRef.current) throw new Error('No file loaded.')
        const fd = new FormData()
        fd.append('file', fileRef.current); fd.append('code', codeToRun)
        fd.append('file_type', src?.source_type || 'csv'); fd.append('cell_id', cellId)
        console.log('[Studio] Executing cell:', cellId, 'code:', codeToRun.slice(0, 100))
        const res = await fetch('/api/studio/execute', { method: 'POST', body: fd })
        execResult = await res.json()
        console.log('[Studio] Execute result:', JSON.stringify(execResult).slice(0, 300))
      } else {
        const res = await fetch('/api/studio/execute-db', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: activeSourceId, code: codeToRun, cell_id: cellId }),
        })
        execResult = await res.json()
      }

      let interpretation = null, key_findings: string[] = [], recommended_actions: string[] = []
      if (execResult.success) {
        try {
          const iRes = await fetch('/api/studio/interpret', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation: detectOperation(cell.code), result: execResult.output,
              columns_used: extractColumns(cell.code, schemaColumns), source_name: src?.name || '',
              source_id: activeSourceId }),
          })
          const interp = await iRes.json()
          interpretation = interp.interpretation || null
          key_findings = interp.key_findings || []
          recommended_actions = interp.recommended_actions || []
        } catch {}
      }

      setCells(prev => prev.map(c => c.id === cellId ? {
        ...c, status: (execResult.success ? 'done' : 'error') as StudioCell['status'],
        output: { success: !!execResult.success, result: execResult.output ?? null,
          stdout: String(execResult.stdout || ''), error: (execResult.error as string) || null,
          chart_data: (execResult.chart_data ?? null) as StudioCell['output'] extends null ? never : NonNullable<StudioCell['output']>['chart_data'],
          interpretation, key_findings, recommended_actions, stats_table: null, execution_time_ms: Date.now() - startTime },
      } : c))
    } catch (e) {
      setCells(prev => prev.map(c => c.id === cellId ? {
        ...c, status: 'error' as const,
        output: { success: false, result: null, stdout: '', error: e instanceof Error ? e.message : 'Failed',
          chart_data: null, interpretation: null, key_findings: [], recommended_actions: [],
          stats_table: null, execution_time_ms: Date.now() - startTime },
      } : c))
    }
  }

  // ── Generate full notebook ──
  async function handleGenerateNotebook() {
    if (!genPrompt.trim()) return
    setIsGenerating(true); setCycleIdx(0)
    try {
      const fd = new FormData()
      if (fileRef.current) fd.append('file', fileRef.current)
      fd.append('question', genPrompt)
      fd.append('schema_context', schemaContext)
      fd.append('generate_full_notebook', 'true')
      fd.append('file_type', sources.find(s => s.id === activeSourceId)?.source_type || 'csv')

      console.log('[Studio] Generating notebook, prompt:', genPrompt.slice(0, 80))
      const res = await fetch('/api/studio/suggest', { method: 'POST', body: fd })
      const data = await res.json()
      console.log('[Studio] Generate response:', JSON.stringify(data).slice(0, 500))

      if (data.cells && Array.isArray(data.cells) && data.cells.length > 0) {
        const newCells: StudioCell[] = data.cells.map((c: Record<string, unknown>) => ({
          id: crypto.randomUUID(),
          type: c.type || 'text',
          code: (c.code as string) || '',
          content: (c.content as string) || '',
          level: (c.level as 1 | 2 | 3) || undefined,
          output: null, status: 'idle', created_at: new Date().toISOString(),
        }))
        setCells(newCells)
        setNotebookTitle(genPrompt.slice(0, 50))

        // Auto-run code cells sequentially
        for (const cell of newCells) {
          if (cell.type === 'python' || cell.type === 'sql') {
            await runCell(cell.id)
          }
        }
      } else {
        console.error('[Studio] Generation returned no cells:', data)
      }
    } catch (e) { console.error('[Studio] Generation error:', e) } finally {
      setIsGenerating(false)
    }
  }

  // ── Ask Claude (generates full section: heading + intro + code + explanation) ──
  async function handleAsk() {
    if (!question.trim()) return
    setIsAsking(true)
    try {
      const fd = new FormData()
      if (fileRef.current) fd.append('file', fileRef.current)
      fd.append('question', question)
      fd.append('file_type', sources.find(s => s.id === activeSourceId)?.source_type || 'csv')
      fd.append('schema_context', schemaContext)
      const res = await fetch('/api/studio/suggest', { method: 'POST', body: fd })
      const data = await res.json()
      const suggestion = data.suggestion || {}
      const code = suggestion.code || `# ${question}\nresult = df.describe().to_dict()`
      const explanation = suggestion.explanation || ''
      const title = suggestion.title || question.slice(0, 60)

      const now = new Date().toISOString()
      const headingCell: StudioCell = {
        id: crypto.randomUUID(), type: 'heading', code: '', content: title,
        level: 2, output: null, status: 'idle', created_at: now,
      }
      const introCell: StudioCell = {
        id: crypto.randomUUID(), type: 'text', code: '',
        content: explanation || `Analysing: ${question}`,
        output: null, status: 'idle', created_at: now,
      }
      const codeCell: StudioCell = {
        id: crypto.randomUUID(), type: 'python', code,
        output: null, status: 'idle', created_at: now,
      }

      setCells(prev => [...prev, headingCell, introCell, codeCell])
      setActiveCellId(codeCell.id); setQuestion('')
      // Auto-run the code cell, then add explanation after results
      setTimeout(async () => {
        await runCell(codeCell.id)
      }, 100)
    } catch {} finally { setIsAsking(false) }
  }

  function addCellFromSuggestion(s: ProactiveSuggestion) {
    const c: StudioCell = { id: crypto.randomUUID(), type: 'python', code: s.code, output: null, status: 'idle', created_at: new Date().toISOString() }
    setCells(prev => [...prev, c]); setActiveCellId(c.id); setTimeout(() => runCell(c.id), 100)
  }

  function addCell(type: StudioCell['type']) {
    const c: StudioCell = {
      id: crypto.randomUUID(), type,
      code: type === 'python' ? '# Your analysis\nresult = df.describe().to_dict()' : type === 'sql' ? 'SELECT * FROM df LIMIT 10' : '',
      content: type === 'heading' ? '' : type === 'text' ? '' : undefined,
      level: type === 'heading' ? 2 : undefined,
      output: null, status: 'idle', created_at: new Date().toISOString(),
    }
    setCells(prev => [...prev, c]); setActiveCellId(c.id)
  }

  async function handlePublishInsight(cell: StudioCell) {
    if (!cell.output?.success) return
    const { data } = await supabase.from('insight_documents').insert({
      project_id: projectId, title: `Studio: ${cell.code.split('\n')[0]?.slice(0, 40) || 'Analysis'}`,
      executive_summary: cell.output.interpretation || 'Analysis from DataLaser Studio',
    }).select('id').single()
    if (data) {
      const updated = [...(notebook?.published_insights || []), data.id]
      await fetch(`/api/studio/notebooks/${notebookId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ published_insights: updated }) })
      setNotebook(prev => prev ? { ...prev, published_insights: updated } : prev)
    }
  }

  async function saveTitle() {
    if (notebookTitle !== notebook?.title) {
      await fetch(`/api/studio/notebooks/${notebookId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: notebookTitle }) })
    }
  }

  const activeSrc = sources.find(s => s.id === activeSourceId) || null
  const firstNumeric = schemaColumns.find(c => c.dtype === 'numeric')?.name || 'value'

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 size={24} className="text-mb-brand animate-spin" /></div>

  // ── GENERATION SCREEN (when no cells) ──
  if (cells.length === 0 && !isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <FlaskConical size={48} className="text-mb-brand mb-4" />
        <h2 className="text-[20px] font-bold text-mb-text-dark mb-2">Describe your analysis</h2>
        <p className="text-mb-text-medium text-mb-sm mb-6 text-center max-w-lg">
          DataLaser will generate a complete notebook with headings, code, charts, and narrative
        </p>
        <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleGenerateNotebook() }}
          rows={4} placeholder={`e.g. Analyse how passenger class affected survival rates and ticket pricing. Include correlation analysis, statistical significance tests, and visualisations.`}
          className="w-full max-w-[600px] border border-mb-border rounded-mb-lg p-3 text-[14px] resize-none outline-none focus:border-mb-brand" />
        <div className="flex gap-2 mt-3 flex-wrap justify-center">
          {[`Correlation analysis of all numeric columns`, `Which factors predict ${firstNumeric}?`, `Trend analysis and forecasting`].map(chip => (
            <button key={chip} onClick={() => setGenPrompt(chip)}
              className="text-[12px] px-3 py-1.5 rounded-full border border-mb-border text-mb-text-medium hover:border-mb-brand hover:text-mb-brand transition-colors">
              {chip}
            </button>
          ))}
        </div>
        <button onClick={handleGenerateNotebook} disabled={!genPrompt.trim()}
          className={`mt-6 bg-mb-brand text-white text-[15px] px-8 py-3 rounded-mb-lg font-bold hover:bg-mb-brand-dark transition-colors ${!genPrompt.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Generate Full Analysis →
        </button>
      </div>
    )
  }

  // ── GENERATING SCREEN ──
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <FlaskConical size={48} className="text-mb-brand animate-spin mb-4" style={{ animationDuration: '3s' }} />
        <p className="text-mb-text-dark text-mb-sm font-bold mb-1">{CYCLING_MSGS[cycleIdx]}</p>
        <p className="text-mb-text-light text-mb-xs">This takes about 15-20 seconds</p>
      </div>
    )
  }

  // ── MAIN WORKSPACE ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action bar */}
      <div className="h-[40px] flex items-center px-4 border-b border-mb-border flex-shrink-0 bg-white gap-3">
        <input value={notebookTitle} onChange={e => setNotebookTitle(e.target.value)} onBlur={saveTitle}
          className="bg-transparent border-none outline-none text-mb-sm font-medium text-mb-text-dark w-48" />
        <span className="text-[11px] text-mb-text-light">{isSaving ? 'Saving...' : lastSavedAt ? 'Saved' : ''}</span>
        <div className="w-px h-4 bg-mb-border" />
        <button onClick={() => addCell('heading')} className="text-[11px] text-mb-text-light hover:text-mb-text-dark p-1 rounded hover:bg-mb-bg-light" title="Add heading">
          <Heading1 size={14} />
        </button>
        <button onClick={() => addCell('text')} className="text-[11px] text-mb-text-light hover:text-mb-text-dark p-1 rounded hover:bg-mb-bg-light" title="Add text">
          <Type size={14} />
        </button>
        <button onClick={() => addCell('python')} className="text-[11px] text-mb-text-light hover:text-mb-text-dark p-1 rounded hover:bg-mb-bg-light" title="Add code cell">
          <Code size={14} />
        </button>
        <div className="w-px h-4 bg-mb-border" />
        <button onClick={async () => { for (const c of cells) if (c.type === 'python' || c.type === 'sql') await runCell(c.id) }}
          className="text-[11px] bg-mb-brand text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-mb-brand-dark">
          <Play size={11} /> Run All
        </button>
      </div>

      {/* Two panels */}
      <div className="flex flex-1 overflow-hidden" style={{ minWidth: 1200 }}>
        {/* LEFT — Editor */}
        <div className="overflow-y-auto border-r border-mb-border bg-mb-bg-light p-3" data-panel="left" style={{ flexBasis: '48%', flexShrink: 0 }}>
          {/* Proactive */}
          {proactive.length > 0 && (
            <div className="mb-3">
              <button onClick={() => setProactiveCollapsed(!proactiveCollapsed)} className="flex items-center gap-1.5 w-full text-left mb-2">
                {proactiveCollapsed ? <ChevronRight size={14} className="text-mb-text-light" /> : <ChevronDown size={14} className="text-mb-text-light" />}
                <Lightbulb size={14} className="text-amber-500" />
                <span className="text-mb-sm font-medium text-mb-text-dark">{proactive.length} suggested analyses</span>
              </button>
              {!proactiveCollapsed && (isLoadingProactive ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-mb-lg bg-mb-bg-medium animate-pulse" />)}</div>
              ) : (
                <div className="space-y-2">
                  {proactive.map(s => (
                    <div key={s.id} className="bg-white border border-mb-border rounded-mb-lg p-3 hover:border-mb-brand transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-mb-bg-medium text-mb-text-medium">{s.operation}</span>
                        <span className="text-mb-sm font-medium text-mb-text-dark">{s.title}</span>
                      </div>
                      <p className="text-[11px] text-mb-text-medium mb-2">{s.description}</p>
                      <button onClick={() => addCellFromSuggestion(s)} className="text-[11px] text-mb-brand hover:underline">→ Analyse</button>
                    </div>
                  ))}
                </div>
              ))}
              <div className="h-px bg-mb-border my-3" />
            </div>
          )}

          {/* Ask */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light mb-2">Ask about your data</p>
            <textarea value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAsk() }}
              placeholder="e.g. Does passenger class affect survival?" rows={2}
              className="w-full border border-mb-border rounded-mb-md p-2 text-[13px] resize-none outline-none focus:border-mb-brand" />
            <button onClick={handleAsk} disabled={isAsking || !question.trim()}
              className={`mt-2 w-full flex items-center justify-center gap-1.5 bg-mb-brand text-white text-[13px] py-2 rounded-mb-md hover:bg-mb-brand-dark ${isAsking || !question.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isAsking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {isAsking ? 'Analysing...' : 'Analyse →'}
            </button>
          </div>
          <div className="h-px bg-mb-border my-3" />

          {/* Cells */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mb-text-light">Cells ({cells.length})</p>
            </div>
            {cells.map((cell, i) => (
              <CellCard key={cell.id} cell={cell} cellNumber={i + 1} isActive={cell.id === activeCellId}
                isFirst={i === 0} isLast={i === cells.length - 1}
                onRun={() => runCell(cell.id)}
                onCodeChange={code => setCells(prev => prev.map(c => c.id === cell.id ? { ...c, code } : c))}
                onContentChange={content => setCells(prev => prev.map(c => c.id === cell.id ? { ...c, content } : c))}
                onTypeChange={type => setCells(prev => prev.map(c => c.id === cell.id ? { ...c, type } : c))}
                onLevelChange={level => setCells(prev => prev.map(c => c.id === cell.id ? { ...c, level } : c))}
                onDelete={() => setCells(prev => prev.filter(c => c.id !== cell.id))}
                onMoveUp={() => setCells(prev => { const idx = prev.findIndex(c => c.id === cell.id); if (idx <= 0) return prev; const arr = [...prev]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; return arr })}
                onMoveDown={() => setCells(prev => { const idx = prev.findIndex(c => c.id === cell.id); if (idx < 0 || idx >= prev.length - 1) return prev; const arr = [...prev]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr })}
                onSaveToLibrary={() => setLibraryCell(cell)}
                onClick={() => setActiveCellId(cell.id)} />
            ))}
          </div>
        </div>

        {/* RIGHT — Report */}
        <div className="overflow-hidden" style={{ flexBasis: '52%' }}>
          <OutputPanel cells={cells} notebook={notebook} activeSource={activeSrc} onPublishInsight={handlePublishInsight} />
        </div>
      </div>

      {libraryCell && (
        <SaveToLibraryModal cell={libraryCell} orgId={orgId} projectId={projectId}
          onSave={() => setLibraryCell(null)} onClose={() => setLibraryCell(null)} />
      )}
    </div>
  )
}
