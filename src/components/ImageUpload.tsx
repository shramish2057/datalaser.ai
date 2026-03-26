'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ImageUploadProps {
  /** Current image URL (or null) */
  value: string | null
  /** Called with the new public URL after successful upload, or null on remove */
  onChange: (url: string | null) => void
  /** Entity type for storage path: user, org, workspace, project */
  entityType: 'user' | 'org' | 'workspace' | 'project'
  /** Entity ID for storage path */
  entityId: string
  /** Fallback content when no image (e.g. initial letter badge) */
  fallback?: React.ReactNode
  /** Size of the preview */
  size?: 'sm' | 'md' | 'lg'
  /** Shape */
  shape?: 'circle' | 'rounded'
}

const SIZE_MAP = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
}

export function ImageUpload({
  value,
  onChange,
  entityType,
  entityId,
  fallback,
  size = 'md',
  shape = 'rounded',
}: ImageUploadProps) {
  const t = useTranslations()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    if (!file || !entityId) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entity_type', entityType)
      formData.append('entity_id', entityId)

      const res = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.url) {
        onChange(data.url)
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false)
    }
  }, [entityType, entityId, onChange])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [upload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) upload(file)
  }, [upload])

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-dl-lg'

  return (
    <div className="flex items-center gap-4">
      {/* Preview */}
      <div
        className={`${SIZE_MAP[size]} ${shapeClass} overflow-hidden flex-shrink-0 relative
          border-2 transition-colors cursor-pointer
          ${dragOver ? 'border-dl-brand bg-dl-brand-hover' : 'border-dl-border hover:border-dl-brand'}
          ${!value ? 'bg-dl-bg-medium' : ''}
        `}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-dl-bg-medium">
            <Loader2 size={18} className="animate-spin text-dl-text-light" />
          </div>
        ) : value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : fallback ? (
          <div className="w-full h-full flex items-center justify-center">
            {fallback}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Upload size={18} className="text-dl-text-light" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="dl-btn-secondary text-dl-xs py-1.5 px-3"
        >
          <Upload size={12} />
          {value ? t('common.change') : t('common.upload')}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-dl-xs text-dl-text-light hover:text-red-500 transition-colors font-bold flex items-center gap-1"
          >
            <X size={11} /> {t('common.remove')}
          </button>
        )}
        <p className="text-[10px] text-dl-text-light">PNG, JPG, SVG. Max 2MB.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
