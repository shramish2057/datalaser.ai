'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Database, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTeamProjectContext } from '@/lib/teamContext'

type Source = { id: string; name: string; source_type: string; status: string; last_synced_at: string | null; row_count: number }

export default function TeamSourcesPage() {
  const t = useTranslations()
  const { projectId, base } = useTeamProjectContext()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  async function loadSources() {
    if (!projectId) return
    const { data } = await supabase.from('data_sources').select('id, name, source_type, status, last_synced_at, row_count').eq('project_id', projectId).order('created_at', { ascending: false })
    setSources(data ?? []); setLoading(false)
  }
  useEffect(() => { loadSources() }, [projectId])

  const handleRefresh = async (sourceId: string) => { setRefreshingId(sourceId); await supabase.from('data_sources').update({ status: 'syncing', last_synced_at: new Date().toISOString() }).eq('id', sourceId); await loadSources(); setRefreshingId(null) }
  const handleDelete = async (sourceId: string, sourceName: string) => { if (!confirm(t('studio.deleteConfirm', { name: sourceName }))) return; await supabase.from('data_sources').delete().eq('id', sourceId); setSources(prev => prev.filter(s => s.id !== sourceId)) }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-8 space-y-3"><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /></div>

  if (sources.length === 0) return (
    <div className="flex items-center justify-center h-full p-8"><div className="text-center max-w-sm">
      <div className="w-16 h-16 rounded-full bg-dl-bg-medium flex items-center justify-center mx-auto mb-4"><Database size={28} className="text-dl-text-light" /></div>
      <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">No data sources yet</h2>
      <p className="text-dl-text-medium text-dl-base mb-6">Connect a database, upload a CSV, or link a SaaS tool to get started.</p>
      <button className="dl-btn-primary px-6 py-2" onClick={() => router.push(`${base}/sources/new`)}><Plus size={14} /> Add your first data source</button>
    </div></div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-dl-2xl font-black text-dl-text-dark">Data Sources</h1><p className="text-dl-text-light text-dl-sm mt-0.5">{sources.length} source{sources.length !== 1 ? 's' : ''} connected</p></div>
        <button className="dl-btn-primary" onClick={() => router.push(`${base}/sources/new`)}><Plus size={14} /> {t("sources.addSource")}</button>
      </div>
      <div className="dl-card overflow-hidden"><table className="dl-table"><thead><tr><th>{t("common.sourceName")}</th><th>{t("common.type")}</th><th>{t("common.status")}</th><th>{t("common.lastSynced")}</th><th className="text-right">Row Count</th><th className="text-right">Actions</th></tr></thead><tbody>
        {sources.map(src => (<tr key={src.id}><td className="font-bold">{src.name}</td><td>{src.source_type}</td>
          <td><span className={src.status === 'active' ? 'dl-badge-success' : src.status === 'error' ? 'dl-badge-error' : 'dl-badge-neutral'}>{src.status}</span></td>
          <td className="text-dl-text-medium">{src.last_synced_at ? formatDistanceToNow(new Date(src.last_synced_at), { addSuffix: true }) : '—'}</td>
          <td className="text-right font-mono">{src.row_count.toLocaleString()}</td>
          <td className="text-right"><div className="flex items-center justify-end gap-1">
            <button onClick={() => handleRefresh(src.id)} disabled={refreshingId === src.id} className="dl-btn-subtle p-1.5" title={t("common.run")}><RefreshCw size={14} className={refreshingId === src.id ? 'animate-spin' : ''} /></button>
            <button onClick={() => handleDelete(src.id, src.name)} className="dl-btn-subtle p-1.5 hover:text-dl-error" title={t("common.delete")}><Trash2 size={14} /></button>
          </div></td></tr>))}
      </tbody></table></div>
    </div>
  )
}
