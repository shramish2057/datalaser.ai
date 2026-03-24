'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface KPINodeProps {
  label: string
  value?: string | number
  trend?: 'up' | 'down' | 'flat'
  formula?: string
  x: number
  y: number
  visible: boolean
  onClick?: () => void
}

/* ------------------------------------------------------------------ */
/*  Positioned HTML overlay for KPI nodes.                            */
/*  NOTE: In the current implementation, Sigma renders nodes on       */
/*  canvas. This component is available for future use when richer    */
/*  HTML overlays are needed (positioned at screen coords from        */
/*  Sigma's camera).                                                  */
/* ------------------------------------------------------------------ */

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

export function KPINode({ label, value, trend, formula, x, y, visible, onClick }: KPINodeProps) {
  if (!visible) return null

  const TrendIcon = trend ? TREND_ICON[trend] : null

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
        className="px-3.5 py-2.5 rounded-xl bg-[#111111] border border-purple-500/20
          group-hover:border-purple-500/40 transition-all duration-200
          shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[130px]"
      >
        {/* Label */}
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
          <span className="text-xs text-purple-300/70 font-medium uppercase tracking-wider truncate max-w-[100px]">
            {label}
          </span>
        </div>

        {/* Value + trend */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-white tracking-tight">
            {value !== undefined ? String(value) : '--'}
          </span>
          {TrendIcon && (
            <TrendIcon
              size={14}
              className={
                trend === 'up' ? 'text-emerald-400' :
                trend === 'down' ? 'text-red-400' :
                'text-zinc-500'
              }
            />
          )}
        </div>

        {/* Formula (condensed) */}
        {formula && (
          <div className="mt-1.5 px-2 py-1 bg-purple-500/5 rounded-md">
            <span className="text-[10px] text-purple-300/60 font-mono truncate block max-w-[110px]">
              {formula}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
