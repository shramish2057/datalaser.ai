'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import StepIndicator from '@/components/onboarding/StepIndicator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Connector = { name: string; icon: string; type: string; category: string }
type UploadedFile = { name: string; rows: number }

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

export default function ConnectPage() {
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

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.map(f => ({ name: f.name, rows: Math.floor(Math.random() * 10000) + 100 }))
    setUploadedFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
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

  const handleTest = async () => {
    setTestResult('testing')
    // Simulate test
    await new Promise(r => setTimeout(r, 1500))
    setTestResult('success')
  }

  const handleSave = async () => {
    if (!selectedConnector) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setConnectedSources(prev => [...prev, selectedConnector.name])
    setSaving(false)
    setModalOpen(false)
  }

  const totalConnected = connectedSources.length + uploadedFiles.length

  return (
    <>
      <div className="max-w-5xl mx-auto pt-12 px-6 pb-24">
        <StepIndicator current={2} labels={['Workspace', 'Connect', 'Calibrate']} />

        <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">Connect your data</h1>
        <p className="text-mb-text-medium text-mb-base mb-8">
          Connect a database, upload files, or both.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — Upload */}
          <div className="mb-card p-5">
            <h2 className="text-mb-base font-black text-mb-text-dark mb-4">Upload a file</h2>

            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-mb-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-mb-brand bg-mb-brand-hover' : 'border-mb-border-dark'}
              `}
            >
              <input {...getInputProps()} />
              <UploadCloud className="w-8 h-8 text-mb-text-light mx-auto mb-2" />
              <p className="text-mb-text-medium text-mb-sm">Drag files here, or click to browse</p>
              <p className="text-mb-text-light text-mb-xs mt-1">Supports CSV, XLSX, JSON, Parquet</p>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-mb-md bg-mb-bg-light border border-mb-border"
                  >
                    <span className="text-mb-sm font-bold text-mb-text-dark">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="mb-badge-success">{f.rows.toLocaleString()} rows</span>
                      <button
                        onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-mb-text-light hover:text-mb-error transition-colors"
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
          <div className="mb-card p-5">
            <h2 className="text-mb-base font-black text-mb-text-dark mb-4">Connect a database or app</h2>

            {/* Category tabs */}
            <div className="flex gap-1 mb-4 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`
                    pb-1 text-mb-sm font-bold cursor-pointer transition-colors px-2
                    ${category === cat
                      ? 'text-mb-brand border-b-2 border-mb-brand'
                      : 'text-mb-text-medium hover:text-mb-brand'}
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
                    className="flex items-center justify-between px-3 py-2 rounded-mb-md hover:bg-mb-bg-light cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-mb-md bg-mb-bg-medium flex items-center justify-center text-xs">
                        {conn.icon}
                      </div>
                      <span className="text-mb-sm font-bold text-mb-text-dark">{conn.name}</span>
                      <span className="mb-badge-neutral">{conn.type}</span>
                    </div>
                    <div>
                      {isConnected ? (
                        <span className="mb-badge-success">Connected</span>
                      ) : (
                        <span className="mb-btn-secondary text-mb-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="fixed bottom-0 left-0 right-0 bg-mb-bg border-t border-mb-border px-8 py-3 flex items-center justify-between z-40">
        <span className="text-mb-text-medium text-mb-sm">
          {totalConnected} source{totalConnected !== 1 ? 's' : ''} connected
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/calibrate')} className="mb-btn-subtle">Skip</button>
          <button onClick={() => router.push('/calibrate')} className="mb-btn-primary">Continue</button>
        </div>
      </div>

      {/* Connect modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-mb-bg border border-mb-border rounded-mb-lg shadow-mb-lg p-0 max-w-md">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-mb-xl font-black text-mb-text-dark">
              Connect to {selectedConnector?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-4">
            {(DB_FIELDS[selectedConnector?.name || ''] || [
              { label: 'API Key', placeholder: 'sk_live_...', type: 'password' },
            ]).map(field => (
              <div key={field.label}>
                <label className="mb-label">{field.label}</label>
                <input
                  className="mb-input"
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={formValues[field.label] || ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                />
              </div>
            ))}

            {testResult === 'success' && (
              <div className="px-3 py-2 rounded-mb-md bg-green-50 border border-mb-success text-mb-success text-mb-sm font-bold">
                Connection successful
              </div>
            )}
            {testResult === 'error' && (
              <div className="px-3 py-2 rounded-mb-md bg-red-50 border border-mb-error text-mb-error text-mb-sm font-bold">
                {testError || 'Connection failed'}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleTest}
                disabled={testResult === 'testing'}
                className={`mb-btn-secondary ${testResult === 'testing' ? 'opacity-60' : ''}`}
              >
                {testResult === 'testing' ? 'Testing...' : 'Test connection'}
              </button>
              <button
                onClick={handleSave}
                disabled={testResult !== 'success' || saving}
                className={`mb-btn-primary ${testResult !== 'success' || saving ? 'opacity-40 cursor-not-allowed' : ''}`}
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
