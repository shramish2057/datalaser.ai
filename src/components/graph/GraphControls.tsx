'use client'

import { RefreshCw, Edit3, Plus, Maximize2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface GraphControlsProps {
  onRefresh: () => void
  onEdit: () => void
  onFullscreen: () => void
  editMode: boolean
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function GraphControls({ onRefresh, onEdit, onFullscreen, editMode }: GraphControlsProps) {
  const t = useTranslations()

  const buttons = [
    {
      icon: RefreshCw,
      onClick: onRefresh,
      label: t('graph.refresh'),
      active: false,
    },
    {
      icon: Edit3,
      onClick: onEdit,
      label: t('graph.edit'),
      active: editMode,
    },
    {
      icon: Plus,
      onClick: () => {},
      label: t('graph.addKpi'),
      active: false,
    },
    {
      icon: Maximize2,
      onClick: onFullscreen,
      label: t('graph.fullscreen'),
      active: false,
    },
  ]

  return (
    <div className="flex items-center gap-1">
      {buttons.map((btn, i) => {
        const Icon = btn.icon
        return (
          <button
            key={i}
            onClick={btn.onClick}
            title={btn.label}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150
              ${btn.active
                ? 'bg-white/10 border border-white/20 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent'
              }`}
          >
            <Icon size={15} />
          </button>
        )
      })}
    </div>
  )
}
