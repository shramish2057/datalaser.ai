'use client'

import { Layers } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface DimensionNodeProps {
  label: string
  entityCount?: number
  topValues?: { label: string; count: number }[]
  x: number
  y: number
  visible: boolean
  onClick?: () => void
}

/* ------------------------------------------------------------------ */
/*  Positioned HTML overlay for dimension nodes.                      */
/*  NOTE: In the current implementation, Sigma renders nodes on       */
/*  canvas. This component is available for future use when richer    */
/*  HTML overlays are needed (positioned at screen coords from        */
/*  Sigma's camera).                                                  */
/* ------------------------------------------------------------------ */

export function DimensionNode({ label, entityCount, topValues, x, y, visible, onClick }: DimensionNodeProps) {
  if (!visible) return null

  return (
    <div
      onClick={onClick}
      className="absolute pointer-events-auto cursor-pointer group"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}
    >
      <div
        className="px-3 py-2 rounded-xl bg-[#111111] border border-[#222222]
          group-hover:border-[#3f3f46] transition-all duration-200
          shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[110px]"
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Layers size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-xs text-zinc-400 truncate max-w-[90px]">{label}</span>
        </div>

        {/* Count */}
        {entityCount !== undefined && (
          <div className="text-sm font-semibold text-white mb-1.5">
            {entityCount.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">values</span>
          </div>
        )}

        {/* Mini bars for top values */}
        {topValues && topValues.length > 0 && (
          <div className="space-y-1">
            {topValues.slice(0, 3).map((v, i) => {
              const max = Math.max(...topValues.map(x => x.count))
              const pct = max > 0 ? (v.count / max) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500/50 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate max-w-[50px]">{v.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
