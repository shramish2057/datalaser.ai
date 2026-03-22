'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { StudioCell } from '@/types/studio'

type Props = {
  cell: StudioCell
  orgId: string
  projectId: string
  onSave: () => void
  onClose: () => void
}

const OPERATIONS = ['regression', 'anova', 'correlation', 'ttest', 'chisquare', 'forecast', 'descriptive', 'custom']

export default function SaveToLibraryModal({ cell, orgId, projectId, onSave, onClose }: Props) {
  const firstLine = cell.code.split('\n')[0]?.slice(0, 50) || 'Untitled'
  const [title, setTitle] = useState(firstLine)
  const [description, setDescription] = useState('')
  const [operation, setOperation] = useState('custom')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    await fetch('/api/studio/query-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, project_id: projectId, title, description, code: cell.code, operation, tags }),
    })
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-mb-lg shadow-xl w-[440px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-mb-border">
          <h3 className="text-mb-base font-black text-mb-text-dark">Save to Query Library</h3>
          <button onClick={onClose} className="text-mb-text-light hover:text-mb-text-dark"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className="mb-label">Title</label><input className="mb-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><label className="mb-label">Description</label><textarea className="mb-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div><label className="mb-label">Operation</label>
            <select className="mb-input" value={operation} onChange={e => setOperation(e.target.value)}>
              {OPERATIONS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div><label className="mb-label">Tags (comma-separated)</label><input className="mb-input" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="analysis, titanic" /></div>
          <div><label className="mb-label">Code</label>
            <pre className="bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[12px] p-3 rounded-mb-md max-h-32 overflow-y-auto">{cell.code}</pre>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="mb-btn-secondary text-mb-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving || !title.trim()} className={`mb-btn-primary text-mb-sm ${saving ? 'opacity-50' : ''}`}>
              {saving ? 'Saving...' : 'Save to Library'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
