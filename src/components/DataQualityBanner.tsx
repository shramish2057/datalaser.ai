'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, CheckCircle, ArrowUpRight, Wand2 } from 'lucide-react'
import type { DataQualityReport } from '@/lib/dataQuality'

export function DataQualityBanner({ report, prepareUrl }: { report: DataQualityReport; prepareUrl?: string }) {
  const [expanded, setExpanded] = useState(report.level === 'red')

  if (report.level === 'good') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-mb-lg bg-green-50 border border-green-200 mb-6">
        <CheckCircle size={15} className="text-mb-success flex-shrink-0" />
        <span className="text-mb-sm font-bold text-green-700">Data quality: Good</span>
        <span className="text-mb-sm text-green-600 ml-1">&mdash; {report.summary}</span>
        <span className="ml-auto text-mb-xs font-bold text-green-600">Score: {report.score}/100</span>
      </div>
    )
  }

  const colors = {
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-500',
      title: 'text-yellow-800',
      text: 'text-yellow-700',
      badge: 'bg-yellow-100 text-yellow-700',
    },
    amber: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: 'text-orange-500',
      title: 'text-orange-800',
      text: 'text-orange-700',
      badge: 'bg-orange-100 text-orange-700',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-mb-error',
      title: 'text-red-800',
      text: 'text-red-700',
      badge: 'bg-red-100 text-red-700',
    },
  }

  const c = colors[report.level]
  const Icon = report.level === 'red' ? AlertCircle : AlertTriangle

  const issueLabels: Record<string, string> = {
    missing_values: 'Missing values',
    mixed_types: 'Mixed types',
    format_inconsistency: 'Format inconsistency',
    high_cardinality: 'High cardinality',
    mostly_empty: 'Mostly empty',
  }

  return (
    <div className={`rounded-mb-lg border ${c.bg} ${c.border} mb-6 overflow-hidden`}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon size={15} className={`${c.icon} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <span className={`text-mb-sm font-black ${c.title}`}>
            {report.level === 'yellow' ? 'Minor data quality issues' :
             report.level === 'amber' ? 'Data quality issues detected' :
             'Significant data quality issues'}
          </span>
          <span className={`text-mb-sm ${c.text} ml-2`}>&mdash; {report.summary}</span>
        </div>
        <span className={`text-mb-xs font-bold px-2 py-0.5 rounded-full ${c.badge} flex-shrink-0`}>
          Score: {report.score}/100
        </span>
        <span className={`text-mb-xs font-bold ${c.text} flex items-center gap-1 flex-shrink-0`}>
          {report.warnings.length} issue{report.warnings.length !== 1 ? 's' : ''}
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`border-t ${c.border} px-4 py-3`}>
          {/* Warning list */}
          <div className="space-y-2 mb-3">
            {report.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`
                  text-mb-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5
                  ${w.severity === 'red' ? 'bg-red-100 text-red-700' :
                    w.severity === 'amber' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'}
                `}>
                  {w.severity.toUpperCase()}
                </span>
                <div>
                  <span className={`text-mb-sm font-bold ${c.title}`}>{w.column}</span>
                  <span className={`text-mb-sm ${c.text} ml-1`}>
                    &mdash; {issueLabels[w.issue]}: {w.detail}
                  </span>
                  {w.affectedRows != null && (
                    <span className={`text-mb-xs ${c.text} ml-1`}>
                      ({w.affectedRows.toLocaleString()} rows affected)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Clean this data action */}
          {prepareUrl && (
            <div className={`flex items-center justify-between pt-3 border-t ${c.border} mb-3`}>
              <span className={`text-mb-xs font-bold ${c.text}`}>
                Fix these issues with the data preparation pipeline
              </span>
              <a
                href={prepareUrl}
                className="mb-btn-primary text-mb-xs px-3 py-1.5 flex items-center gap-1 ml-4 flex-shrink-0"
              >
                <Wand2 size={12} />
                Clean this data
              </a>
            </div>
          )}

          {/* Upgrade prompt */}
          {report.upgradePrompt && (
            <div className={`flex items-center justify-between pt-3 border-t ${c.border}`}>
              <span className={`text-mb-xs ${c.text}`}>{report.upgradePrompt}</span>
              <button className="mb-btn-primary text-mb-xs px-3 py-1.5 flex items-center gap-1 ml-4 flex-shrink-0">
                Upgrade to Enterprise
                <ArrowUpRight size={12} />
              </button>
            </div>
          )}

          {/* Proceed anyway note for red */}
          {report.level === 'red' && report.canProceed && (
            <p className={`text-mb-xs ${c.text} mt-2`}>
              You can still proceed with analysis — results may be inaccurate in affected areas.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
