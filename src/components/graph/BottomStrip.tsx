'use client'

import { AlertTriangle, TrendingUp, Info } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Insight {
  text: string
  type: 'warning' | 'positive' | 'info'
  node_id?: string
}

interface BottomStripProps {
  insights: Insight[]
  onInsightClick: (nodeId?: string) => void
}

/* ------------------------------------------------------------------ */
/*  Icon map                                                          */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG = {
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    bg: 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30',
    dot: 'bg-amber-400',
  },
  positive: {
    icon: TrendingUp,
    iconColor: 'text-emerald-400',
    bg: 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-400',
    bg: 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/30',
    dot: 'bg-blue-400',
  },
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function BottomStrip({ insights, onInsightClick }: BottomStripProps) {
  if (!insights || insights.length === 0) return null

  const displayInsights = insights.slice(0, 3)

  return (
    <div className="h-20 flex-shrink-0 bg-[#0a0a0a] border-t border-[#222222] px-6 flex items-center gap-4">
      {displayInsights.map((insight, i) => {
        const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.info
        const Icon = config.icon

        return (
          <button
            key={i}
            onClick={() => onInsightClick(insight.node_id)}
            className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200
              cursor-pointer group ${config.bg}`}
          >
            <div className="flex-shrink-0">
              <Icon size={16} className={config.iconColor} />
            </div>
            <p className="text-xs text-zinc-300 text-left leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
              {insight.text}
            </p>
          </button>
        )
      })}

      {/* Fill empty slots */}
      {Array.from({ length: Math.max(0, 3 - displayInsights.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="flex-1 h-[52px] rounded-xl border border-zinc-800/30" />
      ))}
    </div>
  )
}
