'use client'

type Props = {
  value: number
  min?: number
  max?: number
  label: string
  unit?: string
  zones?: { threshold: number; color: string }[]
}

const DEFAULT_ZONES = [
  { threshold: 33, color: '#ED6E6E' },
  { threshold: 66, color: '#F9CF48' },
  { threshold: 100, color: '#84BB4C' },
]

export function GaugeChart({ value, min = 0, max = 100, label, unit = '', zones = DEFAULT_ZONES }: Props) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const angle = -90 + (pct / 100) * 180
  const r = 80
  const cx = 100
  const cy = 90

  // Arc path helper
  const arc = (startAngle: number, endAngle: number, radius: number) => {
    const s = (startAngle * Math.PI) / 180
    const e = (endAngle * Math.PI) / 180
    const x1 = cx + radius * Math.cos(s)
    const y1 = cy + radius * Math.sin(s)
    const x2 = cx + radius * Math.cos(e)
    const y2 = cy + radius * Math.sin(e)
    const large = endAngle - startAngle > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`
  }

  // Determine value color
  let valueColor = zones[zones.length - 1]?.color || '#84BB4C'
  for (const z of zones) {
    if (pct <= z.threshold) {
      valueColor = z.color
      break
    }
  }

  // Needle endpoint
  const needleAngle = (-90 + (pct / 100) * 180) * Math.PI / 180
  const nx = cx + (r - 10) * Math.cos(needleAngle)
  const ny = cy + (r - 10) * Math.sin(needleAngle)

  return (
    <div className="flex flex-col items-center">
      <svg width={200} height={120} viewBox="0 0 200 120">
        {/* Background arc */}
        <path d={arc(-180, 0, r)} fill="none" stroke="#E8ECEE" strokeWidth={14} strokeLinecap="round" />

        {/* Zone arcs */}
        {zones.map((z, i) => {
          const prev = i === 0 ? 0 : zones[i - 1].threshold
          const startAngle = -180 + (prev / 100) * 180
          const endAngle = -180 + (z.threshold / 100) * 180
          return (
            <path key={i} d={arc(startAngle, endAngle, r)} fill="none"
              stroke={z.color} strokeWidth={14} strokeLinecap="round" opacity={0.25} />
          )
        })}

        {/* Value arc */}
        <path d={arc(-180, -180 + (pct / 100) * 180, r)} fill="none"
          stroke={valueColor} strokeWidth={14} strokeLinecap="round" />

        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#2E353B" strokeWidth={2} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4} fill="#2E353B" />

        {/* Value text */}
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize={22} fontWeight="bold" fill="#2E353B" fontFamily="Lato">
          {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="#74838F" fontFamily="Lato">{unit}</text>

        {/* Min / Max labels */}
        <text x={cx - r + 5} y={cy + 14} fontSize={9} fill="#949AAB" fontFamily="Lato">{min}</text>
        <text x={cx + r - 5} y={cy + 14} fontSize={9} fill="#949AAB" fontFamily="Lato" textAnchor="end">{max}</text>
      </svg>
      <span className="text-[11px] font-medium text-mb-text-medium -mt-1">{label}</span>
    </div>
  )
}
