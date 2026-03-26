'use client'

interface KPIOrbProps {
  label: string
  value: string | number
  unit?: string
  health: 'good' | 'warning' | 'critical'
  x: number
  y: number
  onClick: () => void
  trend?: number | string | null
}

const HEALTH_CONFIG = {
  good: {
    border: '#10b981',
    glow: 'rgba(16, 185, 129, 0.3)',
    glowHover: 'rgba(16, 185, 129, 0.5)',
    text: 'text-emerald-600',
    bg: 'from-emerald-50 to-white',
  },
  warning: {
    border: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.3)',
    glowHover: 'rgba(245, 158, 11, 0.5)',
    text: 'text-amber-600',
    bg: 'from-amber-50 to-white',
  },
  critical: {
    border: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.3)',
    glowHover: 'rgba(239, 68, 68, 0.5)',
    text: 'text-red-600',
    bg: 'from-red-50 to-white',
  },
}

export function KPIOrb({ label, value, unit, health, x, y, onClick, trend }: KPIOrbProps) {
  const config = HEALTH_CONFIG[health]

  const displayValue = typeof value === 'number'
    ? value >= 1000000 ? `${(value / 1000000).toFixed(1)}M`
    : value >= 1000 ? `${(value / 1000).toFixed(1)}K`
    : value % 1 !== 0 ? value.toFixed(1)
    : String(value)
    : String(value)

  const trendArrow = typeof trend === 'number'
    ? trend > 0 ? '↑' : trend < 0 ? '↓' : ''
    : ''

  return (
    <button
      onClick={onClick}
      className="pointer-events-auto cursor-pointer group flex-shrink-0"
      style={x || y ? {
        position: 'absolute' as const,
        left: x,
        top: y,
        transform: 'translate(-50%, 0)',
        zIndex: 20,
      } : {
        position: 'relative' as const,
      }}
    >
      <div
        className={`
          w-[56px] h-[56px] rounded-full
          bg-gradient-to-b ${config.bg}
          border-[1.5px] flex flex-col items-center justify-center
          transition-all duration-300 ease-out
          group-hover:scale-110
        `}
        style={{
          borderColor: config.border,
          boxShadow: `0 0 16px ${config.glow}, 0 2px 8px rgba(0,0,0,0.06)`,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            `0 0 24px ${config.glowHover}, 0 4px 12px rgba(0,0,0,0.1)`
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            `0 0 16px ${config.glow}, 0 2px 8px rgba(0,0,0,0.06)`
        }}
      >
        <span className={`text-[12px] font-black leading-none ${config.text}`}>
          {displayValue}{unit === '%' ? '%' : ''}
        </span>
        {trendArrow && (
          <span className={`text-[8px] font-bold ${config.text} opacity-70`}>
            {trendArrow}{typeof trend === 'number' ? `${Math.abs(trend).toFixed(1)}%` : ''}
          </span>
        )}
      </div>
      <p className="text-[8px] font-bold text-gray-500 text-center mt-1 leading-tight max-w-[70px] mx-auto truncate">
        {label}
      </p>
    </button>
  )
}
