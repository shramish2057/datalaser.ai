'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'

interface Anomaly {
  id: string
  source_id: string
  project_id: string
  type: string
  severity: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
  resolved_at: string | null
  source_name?: string
}

export default function AlertsPage() {
  const t = useTranslations()
  const params = useParams()
  const projectId = params.projectId as string
  const [alerts, setAlerts] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<Record<string, boolean>>({})

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function loadAlerts() {
    // Fetch unresolved anomalies for this project
    const { data: anomalies } = await supabase
      .from('anomalies')
      .select('*')
      .eq('project_id', projectId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })

    if (!anomalies || anomalies.length === 0) {
      setAlerts([])
      setLoading(false)
      return
    }

    // Fetch source names for each unique source_id
    const sourceIds = [...new Set(anomalies.map(a => a.source_id))]
    const { data: sources } = await supabase
      .from('data_sources')
      .select('id, name')
      .in('id', sourceIds)

    const sourceMap = new Map<string, string>()
    for (const src of sources || []) {
      sourceMap.set(src.id, src.name)
    }

    const enriched: Anomaly[] = anomalies.map(a => ({
      ...a,
      source_name: sourceMap.get(a.source_id) || 'Unknown source',
    }))

    setAlerts(enriched)
    setLoading(false)
  }

  useEffect(() => {
    loadAlerts()
  }, [projectId])

  const handleDismiss = async (alertId: string) => {
    setDismissing(prev => ({ ...prev, [alertId]: true }))
    await supabase
      .from('anomalies')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    setDismissing(prev => ({ ...prev, [alertId]: false }))
  }

  const base = `/projects/${projectId}`

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-3">
        <div className="h-10 rounded-dl-md dl-shimmer" />
        <div className="h-10 rounded-dl-md dl-shimmer" />
        <div className="h-10 rounded-dl-md dl-shimmer" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-dl-2xl font-black text-dl-text-dark">{t('alerts.title')}</h1>
        {alerts.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-100 text-red-700 text-dl-xs font-bold">
            {alerts.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="bg-white border border-dl-border rounded-dl-lg p-8 text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-500" />
          </div>
          <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{t('alerts.noAlerts')}</h2>
          <p className="text-dl-text-medium text-dl-base">{t('alerts.noAlertsDesc')}</p>
        </div>
      )}

      {/* Alert cards */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map(alert => {
            const isCritical = alert.severity === 'critical'
            const tableName = (alert.metadata?.table as string) || ''
            const isDrift = alert.type === 'schema_drift'

            return (
              <div
                key={alert.id}
                className={`bg-white border rounded-dl-lg p-4 flex items-start gap-4 ${
                  isCritical ? 'border-red-300' : 'border-amber-300'
                }`}
              >
                {/* Severity icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {isCritical ? (
                    <XCircle size={20} className="text-red-500" />
                  ) : (
                    <AlertTriangle size={20} className="text-amber-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-dl-sm font-bold text-dl-text-dark">
                      {alert.source_name}
                    </span>
                    {tableName && (
                      <>
                        <span className="text-dl-text-light">/</span>
                        <span className="text-dl-sm font-medium text-dl-text-medium">{tableName}</span>
                      </>
                    )}
                    <span className={`text-dl-xs font-bold px-1.5 py-0.5 rounded ${
                      isDrift ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {isDrift ? t('alerts.schemaDrift') : t('alerts.healthDegradation')}
                    </span>
                  </div>
                  <p className="text-dl-sm text-dl-text-medium mb-1">{alert.message}</p>
                  <p className="text-dl-xs text-dl-text-light">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {tableName && (
                    <Link
                      href={`${base}/sources/${alert.source_id}/quick-clean?table=${encodeURIComponent(tableName)}`}
                      className="dl-btn-secondary text-dl-xs px-3 py-1.5"
                    >
                      {t('alerts.fix')}
                    </Link>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    disabled={dismissing[alert.id]}
                    className="dl-btn-subtle text-dl-xs px-3 py-1.5 hover:text-dl-text-dark"
                  >
                    {dismissing[alert.id] ? t('alerts.dismissed') : t('alerts.dismiss')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
