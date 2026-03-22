'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, MoreVertical, Loader2, ChevronDown, ChevronRight, Copy, Trash2, BookOpen } from 'lucide-react'
import type { StudioCell } from '@/types/studio'

type Props = {
  cell: StudioCell
  cellNumber: number
  isActive: boolean
  onRun: () => void
  onCodeChange: (code: string) => void
  onDelete: () => void
  onSaveToLibrary: () => void
  onClick: () => void
}

export default function CellCard({ cell, cellNumber, isActive, onRun, onCodeChange, onDelete, onSaveToLibrary, onClick }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [showStdout, setShowStdout] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const lines = cell.code.split('\n')
  const lineCount = Math.max(lines.length, 3)

  const execTime = cell.output?.execution_time_ms

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-mb-lg mb-2 cursor-pointer transition-all
        ${isActive ? 'border-mb-brand shadow-sm' : 'border-mb-border hover:border-mb-border-dark'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-mb-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Python</span>
          <span className="text-[11px] text-mb-text-light">Cell {cellNumber}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onRun() }}
            disabled={cell.status === 'running'}
            className="flex items-center gap-1 text-[11px] bg-mb-brand text-white px-2 py-0.5 rounded hover:bg-mb-brand-dark disabled:opacity-50"
          >
            {cell.status === 'running' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            Run
          </button>
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }} className="p-1 rounded hover:bg-mb-bg-medium">
              <MoreVertical size={13} className="text-mb-text-light" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-10 bg-white border border-mb-border rounded-mb-md shadow-mb-md py-1 w-40" onClick={e => e.stopPropagation()}>
                <button onClick={() => { onSaveToLibrary(); setShowMenu(false) }} className="w-full text-left px-3 py-1.5 text-[12px] text-mb-text-dark hover:bg-mb-bg-light flex items-center gap-2">
                  <BookOpen size={12} /> Save to Library
                </button>
                <div className="h-px bg-mb-border my-1" />
                <button onClick={() => { onDelete(); setShowMenu(false) }} className="w-full text-left px-3 py-1.5 text-[12px] text-mb-error hover:bg-red-50 flex items-center gap-2">
                  <Trash2 size={12} /> Delete cell
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code area */}
      <div className="relative" onClick={e => e.stopPropagation()}>
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-[32px] bg-[#1e1e1e] pointer-events-none z-10 pt-[10px]">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="text-right pr-2 text-[12px] leading-[1.5] text-[#858585]">{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={cell.code}
          onChange={e => onCodeChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const start = e.currentTarget.selectionStart
              const end = e.currentTarget.selectionEnd
              const newCode = cell.code.slice(0, start) + '  ' + cell.code.slice(end)
              onCodeChange(newCode)
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = start + 2
                  textareaRef.current.selectionEnd = start + 2
                }
              })
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onRun()
            }
          }}
          style={{
            width: '100%', minHeight: `${lineCount * 19.5 + 20}px`, maxHeight: '400px',
            padding: '10px 10px 10px 40px',
            fontFamily: "'Courier New', Courier, monospace", fontSize: '13px', lineHeight: '1.5',
            backgroundColor: '#1e1e1e', color: '#d4d4d4',
            border: 'none', borderRadius: '0', resize: 'vertical', outline: 'none',
            overflowY: 'auto',
          }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          cell.status === 'running' ? 'bg-mb-brand animate-pulse' :
          cell.status === 'done' ? 'bg-mb-success' :
          cell.status === 'error' ? 'bg-mb-error' : 'bg-mb-border-dark'
        }`} />
        <span className={
          cell.status === 'running' ? 'text-mb-brand' :
          cell.status === 'error' ? 'text-mb-error' : 'text-mb-text-light'
        }>
          {cell.status === 'idle' ? 'Ready' :
           cell.status === 'running' ? 'Running...' :
           cell.status === 'error' ? 'Error' :
           `Done${execTime ? ` · ${execTime}ms` : ''}`}
        </span>
      </div>

      {/* Stdout */}
      {cell.output?.stdout && (
        <div className="border-t border-mb-border" onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowStdout(!showStdout)} className="flex items-center gap-1 px-2 py-1 text-[11px] text-mb-text-light hover:text-mb-text-medium w-full">
            {showStdout ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Output ({cell.output.stdout.split('\n').length} lines)
          </button>
          {showStdout && (
            <pre className="bg-gray-900 text-gray-300 font-mono text-[11px] p-2 max-h-20 overflow-y-auto">
              {cell.output.stdout}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
