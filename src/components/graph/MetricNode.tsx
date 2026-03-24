'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface MetricNodeProps {
  label: string
  value?: string | number
  trend?: 'up' | 'down' | 'flat'
  unit?: string
  verified?: boolean
  x: number
  y: number
  visible: boolean
  onClick?: () => void
}

/* ------------------------------------------------------------------ */
/*  Positioned HTML overlay for metric nodes.                         */
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

export function MetricNode({ label, value, trend, unit, verified, x, y, visible, onClick }: MetricNodeProps) {
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
        className="px-3 py-2 rounded-xl bg-[#111111] border border-[#222222]
          group-hover:border-[#3f3f46] transition-all duration-200
          shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[120px]"
      >
        {/* Label */}
        <div className="flex items-center gap-1.5 mb-1">
          {verified && (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          )}
          <span className="text-xs text-zinc-400 truncate max-w-[100px]">{label}</span>
        </div>

        {/* Value + trend */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-white tracking-tight">
            {value !== undefined ? String(value) : '--'}
          </span>
          {unit && <span className="text-xs text-zinc-500">{unit}</span>}
          {TrendIcon && (
            <TrendIcon
              size={12}
              className={
                trend === 'up' ? 'text-emerald-400' :
                trend === 'down' ? 'text-red-400' :
                'text-zinc-500'
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
