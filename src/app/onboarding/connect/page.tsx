'use client'
import { useTranslations } from 'next-intl'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import Papa from 'papaparse'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { ConnectorIcon } from '@/components/onboarding/ConnectorIcons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Connector = { name: string; icon: string; type: string; category: string }

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

type UploadedFile = {
  name: string
  rows: number
  columns: ColumnMeta[]
  sampleRows: string[][]  // first 5 full rows for insights pipeline
}

const NULL_VALUES = new Set(['', 'null', 'NULL', 'NA', 'N/A', '#N/A', 'NaN', 'undefined', '\\N', 'None', 'nil', '#VALUE!', '#REF!', '?'])

function isNullValue(v: string): boolean {
  return v === undefined || v === null || NULL_VALUES.has(v.trim())
}

/** Detect column type from sample values */
function detectColumnType(name: string, values: string[]): ColumnMeta['dtype'] {
  const lower = name.toLowerCase()
  // ID-like columns
  if (/^(id|_id|uuid|key)$/.test(lower) || lower.endsWith('_id') || lower.endsWith('id') && lower.length <= 20) {
    return 'id'
  }
  // Date-like columns
  if (/date|time|created|updated|timestamp|_at$|_on$/.test(lower)) {
    return 'date'
  }
  // Check actual values — are they mostly numbers?
  const nonEmpty = values.filter(v => !isNullValue(v))
  if (nonEmpty.length === 0) return 'text'
  const numericCount = nonEmpty.filter(v => !isNaN(Number(v)) && v.trim() !== '').length
  if (numericCount / nonEmpty.length >= 0.8) return 'numeric'
  // Long text
  const avgLen = nonEmpty.reduce((sum, v) => sum + v.length, 0) / nonEmpty.length
  if (avgLen > 50) return 'text'
  return 'categorical'
}

/** Build column metadata from parsed rows */
function buildColumnMeta(
  headers: string[],
  allRows: string[][],
  totalRowCount: number
): ColumnMeta[] {
  // Use up to 200 rows for quality stats
  const qualityRows = allRows.slice(0, 200)
  const qualityCount = qualityRows.length

  return headers.map((name, i) => {
    const rawValues = qualityRows.map(row => row[i] ?? '')
    const nonNull = rawValues.filter(v => !isNullValue(v))
    const nullCount = qualityCount - nonNull.length
    const nullRate = qualityCount > 0 ? nullCount / qualityCount : 0
    const uniqueRate = nonNull.length > 0 ? new Set(nonNull).size / nonNull.length : 0

    const sampleValues = nonNull.slice(0, 20)
    const dtype = detectColumnType(name, sampleValues)

    // Mixed types: genuine non-numeric text in a numeric column
    let mixedTypes = false
    if (dtype === 'numeric' && sampleValues.length > 0) {
      const genuineText = sampleValues.filter(v => {
        const t = v.trim()
        return t !== '' && isNaN(Number(t))
      })
      mixedTypes = genuineText.length > 0 && genuineText.length < sampleValues.length
    }

    let formatIssues = false
    if (dtype === 'date') {
      const formats = new Set<string>()
      for (const v of sampleValues) {
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) formats.add('MM/DD/YYYY')
        else if (/^\d{4}-\d{2}-\d{2}/.test(v)) formats.add('YYYY-MM-DD')
        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(v)) formats.add('DD-MM-YYYY')
        else if (/^[A-Za-z]+ \d{1,2},? \d{4}$/.test(v)) formats.add('Month DD YYYY')
      }
      formatIssues = formats.size > 1
    }

    return {
      name,
      dtype,
      sample: sampleValues.slice(0, 5),
      nullRate,
      uniqueRate,
      mixedTypes,
      formatIssues,
      totalValues: qualityCount > 0 ? Math.round(nonNull.length * (totalRowCount / qualityCount)) : 0,
    }
  })
}

/** Parse CSV using Papa Parse — handles all edge cases */
function parseCSV(text: string): { columns: ColumnMeta[]; rows: number; sampleRows: string[][] } {
  const result = Papa.parse(text, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false,   // keep everything as strings for our type detection
  })

  const allRows = result.data as string[][]
  if (allRows.length === 0) return { columns: [], rows: 0, sampleRows: [] }

  const headers = allRows[0].map(h => (h ?? '').trim())
  const dataRows = allRows.slice(1)

  const columns = buildColumnMeta(headers, dataRows, dataRows.length)
  const sampleRows = dataRows.slice(0, 5)

  return { columns, rows: dataRows.length, sampleRows }
}

/** Parse JSON — extract keys, detect types from sample values */
function parseJSON(text: string): { columns: ColumnMeta[]; rows: number; sampleRows: string[][] } {
  try {
    const data = JSON.parse(text)
    const arr = Array.isArray(data) ? data : [data]
    if (arr.length === 0) return { columns: [], rows: 0, sampleRows: [] }

    const keys = Object.keys(arr[0])
    const allStringRows = arr.map(row => keys.map(key => String(row[key] ?? '')))
    const columns = buildColumnMeta(keys, allStringRows, arr.length)
    const sampleRows = allStringRows.slice(0, 5)

    return { columns, rows: arr.length, sampleRows }
  } catch { /* ignore */ }
  return { columns: [], rows: 0, sampleRows: [] }
}

/** Parse XLSX using SheetJS — reads the first sheet */
async function parseXLSX(buffer: ArrayBuffer): Promise<{ columns: ColumnMeta[]; rows: number; sampleRows: string[][] }> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { columns: [], rows: 0, sampleRows: [] }

  const sheet = workbook.Sheets[sheetName]
  // Convert to array of arrays (all as strings)
  const raw: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  if (raw.length === 0) return { columns: [], rows: 0, sampleRows: [] }

  const headers = raw[0].map(h => String(h ?? '').trim())
  const dataRows = raw.slice(1).map(row =>
    headers.map((_, i) => String(row[i] ?? ''))
  )

  const columns = buildColumnMeta(headers, dataRows, dataRows.length)
  const sampleRows = dataRows.slice(0, 5)

  return { columns, rows: dataRows.length, sampleRows }
}

/** Parse Parquet — server-side only via pipeline service */
async function parseParquet(_buffer: ArrayBuffer): Promise<{ columns: ColumnMeta[]; rows: number; sampleRows: string[][] }> {
  // Parquet files are profiled server-side by the pipeline service
  return { columns: [], rows: 0, sampleRows: [] }
}

/** Persist source info so calibrate page can derive smart metrics + save to DB */
function persistSourceInfo(files: UploadedFile[], connectedSources: string[]) {
  const info = {
    files: files.map(f => ({
      name: f.name,
      rows: f.rows,
      columns: f.columns,
      sampleRows: f.sampleRows || [],
    })),
    connectedSources,
  }
  localStorage.setItem('datalaser_connect_info', JSON.stringify(info))
}

const CONNECTORS: Connector[] = [
  { name: 'PostgreSQL', icon: '🐘', type: 'Database', category: 'Databases' },
  { name: 'MySQL', icon: '🐬', type: 'Database', category: 'Databases' },
  { name: 'MongoDB', icon: '🍃', type: 'NoSQL', category: 'Databases' },
  { name: 'SQL Server', icon: '🗄️', type: 'Database', category: 'Databases' },
  { name: 'Snowflake', icon: '❄️', type: 'Warehouse', category: 'Warehouses' },
  { name: 'BigQuery', icon: '☁️', type: 'Warehouse', category: 'Warehouses' },
  { name: 'Redshift', icon: '🔴', type: 'Warehouse', category: 'Warehouses' },
  { name: 'Databricks', icon: '🔷', type: 'Lakehouse', category: 'Warehouses' },
  { name: 'Shopify', icon: '🛍️', type: 'E-commerce', category: 'Commerce' },
  { name: 'Stripe', icon: '💳', type: 'Payments', category: 'Commerce' },
  { name: 'Square', icon: '⬛', type: 'Payments', category: 'Commerce' },
  { name: 'Google Ads', icon: '📢', type: 'Ads', category: 'Marketing' },
  { name: 'Meta Ads', icon: '📘', type: 'Ads', category: 'Marketing' },
  { name: 'Google Analytics', icon: '📊', type: 'Analytics', category: 'Marketing' },
  { name: 'QuickBooks', icon: '💚', type: 'Accounting', category: 'Finance' },
  { name: 'Xero', icon: '🔵', type: 'Accounting', category: 'Finance' },
  { name: 'Plaid', icon: '🏦', type: 'Banking', category: 'Finance' },
]

const CATEGORIES = ['All', 'Databases', 'Warehouses', 'Commerce', 'Marketing', 'Finance']

const DB_FIELDS: Record<string, { label: string; placeholder: string; type?: string }[]> = {
  PostgreSQL: [
    { label: 'Host', placeholder: 'db.example.com' },
    { label: 'Port', placeholder: '5432' },
    { label: 'Database', placeholder: 'analytics' },
    { label: 'Username', placeholder: 'postgres' },
    { label: 'Password', placeholder: '••••••••', type: 'password' },
  ],
  MySQL: [
    { label: 'Host', placeholder: 'db.example.com' },
    { label: 'Port', placeholder: '3306' },
    { label: 'Database', placeholder: 'mydb' },
    { label: 'Username', placeholder: 'root' },
    { label: 'Password', placeholder: '••••••••', type: 'password' },
  ],
  Snowflake: [
    { label: 'Account', placeholder: 'xy12345.us-east-1' },
    { label: 'Warehouse', placeholder: 'COMPUTE_WH' },
    { label: 'Database', placeholder: 'ANALYTICS' },
    { label: 'Schema', placeholder: 'PUBLIC' },
    { label: 'Username', placeholder: 'admin' },
    { label: 'Password', placeholder: '••••••••', type: 'password' },
  ],
}

export default function ConnectPage({ projectId }: { projectId?: string } = {}) {
  const t = useTranslations()
  const [category, setCategory] = useState('All')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [connectedSources, setConnectedSources] = useState<string[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [saving, setSaving] = useState(false)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const addParsedFile = useCallback((parsed: { columns: ColumnMeta[]; rows: number; sampleRows: string[][] }, fileName: string) => {
    setUploadedFiles(prev => {
      const updated = [...prev, {
        name: fileName,
        rows: parsed.rows,
        columns: parsed.columns,
        sampleRows: parsed.sampleRows,
      }]
      persistSourceInfo(updated, connectedSources)
      return updated
    })
  }, [connectedSources])

  const onDrop = useCallback((accepted: File[]) => {
    accepted.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'csv') {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          addParsedFile(parseCSV(text), file.name)
          // Store raw file for pipeline profiling
          try {
            sessionStorage.setItem('datalaser_raw_file', text)
            sessionStorage.setItem('datalaser_raw_file_name', file.name)
          } catch { /* quota exceeded — will fall back to sample */ }
        }
        reader.readAsText(file)
      } else if (ext === 'json') {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          addParsedFile(parseJSON(text), file.name)
          try {
            sessionStorage.setItem('datalaser_raw_file', text)
            sessionStorage.setItem('datalaser_raw_file_name', file.name)
          } catch { /* quota exceeded */ }
        }
        reader.readAsText(file)
      } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const buffer = e.target?.result as ArrayBuffer
          const parsed = await parseXLSX(buffer)
          addParsedFile(parsed, file.name)
        }
        reader.readAsArrayBuffer(file)
      } else if (ext === 'parquet') {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const buffer = e.target?.result as ArrayBuffer
          const parsed = await parseParquet(buffer)
          if (parsed.columns.length > 0) {
            addParsedFile(parsed, file.name)
          } else {
            // Parquet parsing failed — store with metadata only
            addParsedFile({ columns: [], rows: 0, sampleRows: [] }, file.name)
          }
        }
        reader.readAsArrayBuffer(file)
      }
    })
  }, [connectedSources, addParsedFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
      'application/octet-stream': ['.parquet'],
    },
  })

  const filtered = category === 'All' ? CONNECTORS : CONNECTORS.filter(c => c.category === category)

  const openConnectModal = (conn: Connector) => {
    setSelectedConnector(conn)
    setFormValues({})
    setTestResult('idle')
    setTestError('')
    setModalOpen(true)
  }

  // Map connector name → API source_type
  const connectorToSourceType: Record<string, string> = {
    PostgreSQL: 'postgres', MySQL: 'mysql', MongoDB: 'mongodb',
    'SQL Server': 'mssql', Snowflake: 'snowflake', BigQuery: 'bigquery',
    Redshift: 'redshift', Databricks: 'databricks', Shopify: 'shopify',
    Stripe: 'stripe', Square: 'square', 'Google Ads': 'google_ads',
    'Meta Ads': 'meta_ads', 'Google Analytics': 'google_analytics',
    QuickBooks: 'quickbooks', Xero: 'xero', Plaid: 'plaid',
  }

  const connectorToCategory: Record<string, string> = {
    Databases: 'database', Warehouses: 'warehouse', Commerce: 'ecommerce',
    Marketing: 'marketing', Finance: 'finance',
  }

  const handleTest = async () => {
    if (!selectedConnector) return
    setTestResult('testing')
    setTestError('')
    try {
      const res = await fetch('/api/sources/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: connectorToSourceType[selectedConnector.name] || selectedConnector.name.toLowerCase(),
          credentials: formValues,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestResult('success')
      } else {
        setTestResult('error')
        setTestError(data.error || data.message || 'Connection failed')
      }
    } catch (e) {
      setTestResult('error')
      setTestError(e instanceof Error ? e.message : 'Connection test failed')
    }
  }

  const handleSave = async () => {
    if (!selectedConnector) return
    setSaving(true)
    try {
      const sourceType = connectorToSourceType[selectedConnector.name] || selectedConnector.name.toLowerCase()
      const category = connectorToCategory[selectedConnector.category] || 'database'

      const res = await fetch('/api/sources/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedConnector.name,
          source_type: sourceType,
          category,
          credentials: formValues,
          project_id: projectId || undefined,
        }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setConnectedSources(prev => {
          const updated = [...prev, selectedConnector.name]
          persistSourceInfo(uploadedFiles, updated)
          return updated
        })
        setModalOpen(false)
      } else {
        setTestError(data.error || data.message || 'Failed to save connection')
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const totalConnected = connectedSources.length + uploadedFiles.length

  const handleContinue = () => {
    if (projectId) {
      // Store projectId so downstream pages can redirect correctly
      localStorage.setItem('datalaser_project_id', projectId)
    }
    const hasOnlyFiles = uploadedFiles.length > 0 && connectedSources.length === 0
    if (hasOnlyFiles) {
      router.push('/onboarding/intent')
    } else {
      router.push('/onboarding/calibrate')
    }
  }

  const handleSkip = () => {
    if (projectId) {
      localStorage.setItem('datalaser_project_id', projectId)
      router.push(`/projects/${projectId}`)
      return
    }
    router.push('/onboarding/calibrate')
  }

  return (
    <>
      <div className="max-w-5xl mx-auto pt-12 px-6 pb-24">
        <StepIndicator current={2} labels={['Workspace', 'Connect', 'Calibrate']} />

        <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">Connect your data</h1>
        <p className="text-dl-text-medium text-dl-base mb-8">
          Connect a database, upload files, or both.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — Upload */}
          <div className="dl-card p-5">
            <h2 className="text-dl-base font-black text-dl-text-dark mb-4">Upload a file</h2>

            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-dl-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-dl-brand bg-dl-brand-hover' : 'border-dl-border-dark'}
              `}
            >
              <input {...getInputProps()} />
              <UploadCloud className="w-8 h-8 text-dl-brand/60 mx-auto mb-2" />
              <p className="text-dl-text-medium text-dl-sm">Drag files here, or click to browse</p>
              <p className="text-dl-text-light text-dl-xs mt-1">Supports CSV, Excel (.xlsx/.xls), JSON, Parquet</p>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-dl-md bg-dl-bg-light border border-dl-border"
                  >
                    <span className="text-dl-sm font-bold text-dl-text-dark">{f.name}</span>
                    <div className="flex items-center gap-2">
                      {f.columns?.length > 0 && (
                        <span className="dl-badge-neutral">{f.columns.length} cols</span>
                      )}
                      <span className="dl-badge-success">{f.rows.toLocaleString()} rows</span>
                      <button
                        onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-dl-text-light hover:text-dl-error transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Database */}
          <div className="dl-card p-5">
            <h2 className="text-dl-base font-black text-dl-text-dark mb-4">Connect a database or app</h2>

            {/* Category tabs */}
            <div className="flex gap-1 mb-4 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`
                    pb-1 text-dl-sm font-bold cursor-pointer transition-colors px-2
                    ${category === cat
                      ? 'text-dl-brand border-b-2 border-dl-brand'
                      : 'text-dl-text-medium hover:text-dl-brand'}
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Connector list */}
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filtered.map(conn => {
                const isConnected = connectedSources.includes(conn.name)
                return (
                  <div
                    key={conn.name}
                    onClick={() => !isConnected && openConnectModal(conn)}
                    className="flex items-center justify-between px-3 py-2 rounded-dl-md hover:bg-dl-bg-light cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-dl-md bg-dl-bg-medium flex items-center justify-center">
                        <ConnectorIcon name={conn.name} />
                      </div>
                      <span className="text-dl-sm font-bold text-dl-text-dark">{conn.name}</span>
                      <span className="dl-badge-neutral">{conn.type}</span>
                    </div>
                    <div>
                      {isConnected ? (
                        <span className="dl-badge-success">{t("common.connected")}</span>
                      ) : (
                        <span className="dl-btn-secondary text-dl-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Connect
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-dl-bg border-t border-dl-border px-8 py-3 flex items-center justify-between z-40">
        <span className="text-dl-text-medium text-dl-sm">
          {totalConnected} source{totalConnected !== 1 ? 's' : ''} connected
        </span>
        <div className="flex items-center gap-3">
          <button onClick={handleSkip} className="dl-btn-subtle">Skip</button>
          <button onClick={handleContinue} className="dl-btn-primary">Continue</button>
        </div>
      </div>

      {/* Connect modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-dl-bg border border-dl-border rounded-dl-lg shadow-dl-lg p-0 max-w-md">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-dl-xl font-black text-dl-text-dark">
              Connect to {selectedConnector?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-4">
            {(DB_FIELDS[selectedConnector?.name || ''] || [
              { label: 'API Key', placeholder: 'sk_live_...', type: 'password' },
            ]).map(field => (
              <div key={field.label}>
                <label className="dl-label">{field.label}</label>
                <input
                  className="dl-input"
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={formValues[field.label] || ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                />
              </div>
            ))}

            {testResult === 'success' && (
              <div className="px-3 py-2 rounded-dl-md bg-green-50 border border-dl-success text-dl-success text-dl-sm font-bold">
                Connection successful
              </div>
            )}
            {testResult === 'error' && (
              <div className="px-3 py-2 rounded-dl-md bg-red-50 border border-dl-error text-dl-error text-dl-sm font-bold">
                {testError || 'Connection failed'}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleTest}
                disabled={testResult === 'testing'}
                className={`dl-btn-secondary ${testResult === 'testing' ? 'opacity-60' : ''}`}
              >
                {testResult === 'testing' ? 'Testing...' : 'Test connection'}
              </button>
              <button
                onClick={handleSave}
                disabled={testResult !== 'success' || saving}
                className={`dl-btn-primary ${testResult !== 'success' || saving ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
