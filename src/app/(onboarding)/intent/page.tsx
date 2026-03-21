'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { assessDataQuality, type DataQualityReport } from '@/lib/dataQuality'
import { DataQualityBanner } from '@/components/DataQualityBanner'

type ColumnMeta = {
  name: string
  dtype: 'numeric' | 'categorical' | 'date' | 'id' | 'text'
  sample: string[]
  nullRate: number
  uniqueRate: number
  mixedTypes: boolean
  formatIssues: boolean
  totalValues: number
}

type ConnectInfo = {
  files: { name: string; rows: number; columns: ColumnMeta[]; sampleRows: string[][] }[]
  connectedSources: string[]
}

const CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart', icon: '▬', desc: 'Compare values across categories' },
  { id: 'line', label: 'Line Chart', icon: '📈', desc: 'Show trends over time' },
  { id: 'area', label: 'Area Chart', icon: '◭', desc: 'Trends with filled area' },
  { id: 'pie', label: 'Pie / Donut', icon: '◕', desc: 'Show proportions of a whole' },
  { id: 'scatter', label: 'Scatter Plot', icon: '⁘', desc: 'Find correlations between variables' },
  { id: 'heatmap', label: 'Heatmap', icon: '▦', desc: 'Show intensity across two dimensions' },
  { id: 'funnel', label: 'Funnel', icon: '⬡', desc: 'Show conversion or drop-off stages' },
  { id: 'table', label: 'Data Table', icon: '⊞', desc: 'Browse and filter raw data' },
  { id: 'stacked_bar', label: 'Stacked Bar', icon: '▬', desc: 'Compare parts of a whole across categories' },
]

export default function IntentPage() {
  const router = useRouter()
  const [connectInfo, setConnectInfo] = useState<ConnectInfo | null>(null)
  const [question, setQuestion] = useState('')
  const [selectedCharts, setSelectedCharts] = useState<string[]>(['bar'])
  const [xAxis, setXAxis] = useState('')
  const [yAxis, setYAxis] = useState('')
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('datalaser_connect_info')
    if (raw) {
      const info = JSON.parse(raw) as ConnectInfo
      setConnectInfo(info)
      const file = info.files[0]
      // Compute data quality report
      if (file?.columns) {
        const report = assessDataQuality(file.columns, file.rows)
        setQualityReport(report)
      }
      // Auto-select sensible defaults from detected columns
      if (file?.columns) {
        const dateCol = file.columns.find(c => c.dtype === 'date')
        const numCol = file.columns.find(c => c.dtype === 'numeric')
        const catCol = file.columns.find(c => c.dtype === 'categorical')
        if (dateCol) setXAxis(dateCol.name)
        else if (catCol) setXAxis(catCol.name)
        if (numCol) setYAxis(numCol.name)
        // Auto-suggest chart type
        if (dateCol && numCol) setSelectedCharts(['line'])
        else if (catCol && numCol) setSelectedCharts(['bar'])
      }
    }
  }, [])

  const file = connectInfo?.files[0]
  const numericCols = file?.columns.filter(c => c.dtype === 'numeric') ?? []
  const categoricalCols = file?.columns.filter(c => c.dtype === 'categorical' || c.dtype === 'date') ?? []

  const toggleChart = (id: string) => {
    setSelectedCharts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const handleLaunch = () => {
    // Save intent to localStorage for Ask Data page to pick up
    const intent = {
      question: question.trim() || `Give me a complete analysis of my ${file?.name} data`,
      chartTypes: selectedCharts,
      xAxis,
      yAxis,
      fileName: file?.name,
      columns: file?.columns,
      sampleRows: file?.sampleRows,
      rows: file?.rows,
      qualityReport,
    }
    localStorage.setItem('datalaser_data_intent', JSON.stringify(intent))
    router.push('/app/ask')
  }

  if (!connectInfo) return null

  return (
    <div className="max-w-2xl mx-auto pt-12 px-6 pb-24">
      <StepIndicator current={3} labels={['Workspace', 'Connect', 'Configure']} />

      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">
        What do you want to understand?
      </h1>
      <p className="text-mb-text-medium text-mb-base mb-8">
        We detected {file?.columns.length} columns and {file?.rows.toLocaleString()} rows
        in <span className="font-bold text-mb-text-dark">{file?.name}</span>.
        Tell us what you want to explore.
      </p>

      {/* Detected columns preview */}
      <div className="mb-card p-4 mb-6">
        <p className="mb-section-header mb-3">Detected columns</p>
        <div className="flex flex-wrap gap-2">
          {file?.columns.map(col => (
            <span key={col.name} className={`
              mb-badge font-mono text-mb-xs
              ${col.dtype === 'numeric' ? 'mb-badge-info' :
                col.dtype === 'date' ? 'mb-badge-warning' :
                col.dtype === 'categorical' ? 'mb-badge-neutral' :
                'bg-mb-bg-medium text-mb-text-light'}
            `}>
              {col.name}
              <span className="ml-1 opacity-60">({col.dtype})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Data quality banner */}
      {qualityReport && <DataQualityBanner report={qualityReport} />}

      {/* Question */}
      <div className="mb-6">
        <label className="mb-label">What question do you want answered? (optional)</label>
        <textarea
          className="mb-input min-h-[80px] resize-none"
          placeholder={`e.g. "What factors most influenced survival?" or "Show me sales by region over time"`}
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <p className="text-mb-text-light text-mb-xs mt-1">
          Leave blank and we&apos;ll auto-generate the most interesting analysis.
        </p>
      </div>

      {/* Axis selectors */}
      {categoricalCols.length > 0 && numericCols.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="mb-label">X Axis (categories / time)</label>
            <select
              className="mb-input"
              value={xAxis}
              onChange={e => setXAxis(e.target.value)}
            >
              <option value="">Auto-detect</option>
              {[...categoricalCols, ...file?.columns.filter(c => c.dtype === 'id') ?? []].map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-label">Y Axis (values to measure)</label>
            <select
              className="mb-input"
              value={yAxis}
              onChange={e => setYAxis(e.target.value)}
            >
              <option value="">Auto-detect</option>
              {numericCols.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Chart type selector */}
      <div className="mb-8">
        <label className="mb-label">Preferred visualisation types (select all that apply)</label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {CHART_TYPES.map(chart => (
            <button
              key={chart.id}
              onClick={() => toggleChart(chart.id)}
              className={`
                p-3 rounded-mb-lg border text-left transition-all
                ${selectedCharts.includes(chart.id)
                  ? 'border-mb-brand bg-mb-brand-hover'
                  : 'border-mb-border-dark hover:border-mb-brand'}
              `}
            >
              <div className="text-lg mb-1">{chart.icon}</div>
              <div className="text-mb-sm font-bold text-mb-text-dark">{chart.label}</div>
              <div className="text-mb-xs text-mb-text-light mt-0.5">{chart.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Launch */}
      <div className="fixed bottom-0 left-0 right-0 bg-mb-bg border-t border-mb-border px-8 py-3 flex items-center justify-between z-40">
        <span className="text-mb-text-medium text-mb-sm">
          Ready to analyse <span className="font-bold text-mb-text-dark">{file?.name}</span>
        </span>
        <button
          onClick={handleLaunch}
          className="mb-btn-primary px-8 py-2 text-mb-base font-black"
        >
          Launch DataLaser
        </button>
      </div>
    </div>
  )
}
