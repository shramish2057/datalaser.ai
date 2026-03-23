'use client'

import { useState, useRef } from 'react'
import { Play, MoreVertical, Loader2, ChevronDown, ChevronRight, ChevronUp, Trash2, BookOpen, ArrowUp, ArrowDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { StudioCell } from '@/types/studio'

type Props = {
  cell: StudioCell
  cellNumber: number
  isActive: boolean
  isFirst: boolean
  isLast: boolean
  onRun: () => void
  onCodeChange: (code: string) => void
  onContentChange: (content: string) => void
  onTypeChange: (type: StudioCell['type']) => void
  onLevelChange: (level: 1 | 2 | 3) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onSaveToLibrary: () => void
  onClick: () => void
}

const LANG_COLORS: Record<string, string> = {
  python: 'bg-blue-100 text-blue-700',
  sql: 'bg-orange-100 text-orange-700',
  r: 'bg-green-100 text-green-700',
}

export default function CellCard({ cell, cellNumber, isActive, isFirst, isLast, onRun, onCodeChange, onContentChange, onTypeChange, onLevelChange, onDelete, onMoveUp, onMoveDown, onSaveToLibrary, onClick }: Props) {
  const t = useTranslations()
  const [showMenu, setShowMenu] = useState(false)
  const [showStdout, setShowStdout] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── HEADING CELL ──
  if (cell.type === 'heading') {
    const sizes = { 1: 'text-[22px] font-bold', 2: 'text-[18px] font-semibold', 3: 'text-[15px] font-semibold text-mb-text-medium' }
    return (
      <div onClick={onClick} className={`mb-2 group relative ${isActive ? 'ring-1 ring-mb-brand rounded-mb-md' : ''}`}>
        <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-0 flex gap-1 bg-white border border-mb-border rounded shadow-sm px-1 py-0.5 z-10 transition-opacity">
          {!isFirst && <button onClick={e => { e.stopPropagation(); onMoveUp() }} className="text-[10px] px-1 text-mb-text-light hover:bg-mb-bg-medium rounded" title="Move up"><ArrowUp size={10} /></button>}
          {!isLast && <button onClick={e => { e.stopPropagation(); onMoveDown() }} className="text-[10px] px-1 text-mb-text-light hover:bg-mb-bg-medium rounded" title="Move down"><ArrowDown size={10} /></button>}
          <div className="w-px h-3 bg-mb-border" />
          {([1, 2, 3] as const).map(l => (
            <button key={l} onClick={e => { e.stopPropagation(); onLevelChange(l) }}
              className={`text-[10px] px-1.5 py-0.5 rounded ${cell.level === l ? 'bg-mb-brand text-white' : 'text-mb-text-light hover:bg-mb-bg-medium'}`}>
              H{l}
            </button>
          ))}
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-[10px] px-1 text-mb-error hover:bg-red-50 rounded"><Trash2 size={10} /></button>
        </div>
        <input value={cell.content || ''} onChange={e => onContentChange(e.target.value)} onClick={e => e.stopPropagation()}
          placeholder={t('studio.sectionHeading')} className={`w-full bg-transparent border-none outline-none text-mb-text-dark px-4 py-2 ${sizes[cell.level || 1]}`} />
      </div>
    )
  }

  // ── TEXT CELL ──
  if (cell.type === 'text') {
    return (
      <div onClick={onClick} className={`mb-2 group relative ${isActive ? 'ring-1 ring-mb-brand rounded-mb-md' : ''}`}>
        <div className="opacity-0 group-hover:opacity-100 absolute -top-6 right-0 flex gap-1 bg-white border border-mb-border rounded shadow-sm px-1 py-0.5 z-10 transition-opacity">
          {!isFirst && <button onClick={e => { e.stopPropagation(); onMoveUp() }} className="text-[10px] px-1 text-mb-text-light hover:bg-mb-bg-medium rounded" title="Move up"><ArrowUp size={10} /></button>}
          {!isLast && <button onClick={e => { e.stopPropagation(); onMoveDown() }} className="text-[10px] px-1 text-mb-text-light hover:bg-mb-bg-medium rounded" title="Move down"><ArrowDown size={10} /></button>}
          <div className="w-px h-3 bg-mb-border" />
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-[10px] px-1 text-mb-error hover:bg-red-50 rounded"><Trash2 size={10} /></button>
        </div>
        <textarea value={cell.content || ''} onChange={e => { onContentChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
          onClick={e => e.stopPropagation()} placeholder={t('studio.writeNotes')}
          className="w-full bg-transparent border-none outline-none text-mb-text-dark px-4 py-2 text-[14px] leading-[1.8] resize-none min-h-[60px]" />
      </div>
    )
  }

  // ── CODE CELL (Python / SQL / R) ──
  const lines = cell.code.split('\n')
  const lineCount = Math.max(lines.length, 3)
  const execTime = cell.output?.execution_time_ms

  return (
    <div onClick={onClick} className={`bg-white border rounded-mb-lg mb-2 cursor-pointer transition-all
      ${isActive ? 'border-mb-brand shadow-sm' : 'border-mb-border hover:border-mb-border-dark'}`}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-mb-border">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowLangPicker(!showLangPicker) }}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${LANG_COLORS[cell.type] || LANG_COLORS.python} cursor-pointer`}>
              {cell.type === 'python' ? 'Python' : cell.type === 'sql' ? 'SQL' : 'R'} ▾
            </button>
            {showLangPicker && (
              <div className="absolute top-full left-0 z-10 bg-white border border-mb-border rounded shadow-sm py-1 w-24" onClick={e => e.stopPropagation()}>
                {(['python', 'sql', 'r'] as const).map(lang => (
                  <button key={lang} onClick={() => { onTypeChange(lang); setShowLangPicker(false) }}
                    className={`w-full text-left px-2 py-1 text-[11px] hover:bg-mb-bg-light ${cell.type === lang ? 'font-bold text-mb-brand' : ''}`}>
                    {lang === 'python' ? 'Python' : lang === 'sql' ? 'SQL' : 'R'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-[11px] text-mb-text-light">{t('studio.cell')} {cellNumber}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onRun() }} disabled={cell.status === 'running' || cell.type === 'r'}
            className="flex items-center gap-1 text-[11px] bg-mb-brand text-white px-2 py-0.5 rounded hover:bg-mb-brand-dark disabled:opacity-50">
            {cell.status === 'running' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Run
          </button>
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }} className="p-1 rounded hover:bg-mb-bg-medium">
              <MoreVertical size={13} className="text-mb-text-light" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-10 bg-white border border-mb-border rounded shadow-sm py-1 w-40" onClick={e => e.stopPropagation()}>
                {!isFirst && <button onClick={() => { onMoveUp(); setShowMenu(false) }} className="w-full text-left px-3 py-1.5 text-[12px] text-mb-text-dark hover:bg-mb-bg-light flex items-center gap-2">
                  <ArrowUp size={12} /> {t('studio.moveUp')}
                </button>}
                {!isLast && <button onClick={() => { onMoveDown(); setShowMenu(false) }} className="w-full text-left px-3 py-1.5 text-[12px] text-mb-text-dark hover:bg-mb-bg-light flex items-center gap-2">
                  <ArrowDown size={12} /> {t('studio.moveDown')}
                </button>}
                <button onClick={() => { onSaveToLibrary(); setShowMenu(false) }} className="w-full text-left px-3 py-1.5 text-[12px] text-mb-text-dark hover:bg-mb-bg-light flex items-center gap-2">
                  <BookOpen size={12} /> {t('studio.saveToLibrary')}
                </button>
                <div className="h-px bg-mb-border my-1" />
                <button onClick={() => { onDelete(); setShowMenu(false) }} className="w-full text-left px-3 py-1.5 text-[12px] text-mb-error hover:bg-red-50 flex items-center gap-2">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="relative" onClick={e => e.stopPropagation()}>
        <div className="absolute left-0 top-0 bottom-0 w-[32px] bg-[#1e1e1e] pointer-events-none z-10 pt-[10px]">
          {Array.from({ length: lineCount }, (_, i) => <div key={i} className="text-right pr-2 text-[12px] leading-[1.5] text-[#858585]">{i + 1}</div>)}
        </div>
        <textarea ref={textareaRef} value={cell.code} onChange={e => onCodeChange(e.target.value)} spellCheck={false} autoComplete="off"
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); const s = e.currentTarget.selectionStart; onCodeChange(cell.code.slice(0, s) + '  ' + cell.code.slice(e.currentTarget.selectionEnd)); requestAnimationFrame(() => { if (textareaRef.current) { textareaRef.current.selectionStart = s + 2; textareaRef.current.selectionEnd = s + 2 } }) }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onRun() }
          }}
          style={{ width: '100%', minHeight: `${lineCount * 19.5 + 20}px`, maxHeight: '400px', padding: '10px 10px 10px 40px', fontFamily: "'Courier New', Courier, monospace", fontSize: '13px', lineHeight: '1.5', backgroundColor: '#1e1e1e', color: '#d4d4d4', border: 'none', borderRadius: '0', resize: 'vertical', outline: 'none', overflowY: 'auto' }} />
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cell.status === 'running' ? 'bg-mb-brand animate-pulse' : cell.status === 'done' ? 'bg-mb-success' : cell.status === 'error' ? 'bg-mb-error' : 'bg-mb-border-dark'}`} />
        <span className={cell.status === 'running' ? 'text-mb-brand' : cell.status === 'error' ? 'text-mb-error' : 'text-mb-text-light'}>
          {cell.status === 'idle' ? t('studio.ready') : cell.status === 'running' ? t('common.running') : cell.status === 'error' ? t('studio.error') : `${t('studio.done')}${execTime ? ` · ${execTime}ms` : ''}`}
        </span>
      </div>
      {cell.output?.stdout && (
        <div className="border-t border-mb-border" onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowStdout(!showStdout)} className="flex items-center gap-1 px-2 py-1 text-[11px] text-mb-text-light w-full">
            {showStdout ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Output
          </button>
          {showStdout && <pre className="bg-gray-900 text-gray-300 font-mono text-[11px] p-2 max-h-20 overflow-y-auto">{cell.output.stdout}</pre>}
        </div>
      )}
    </div>
  )
}
