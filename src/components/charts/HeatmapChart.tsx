'use client'
import { useState } from 'react'

type Props = {
  matrix: Record<string, Record<string, number>>
  columns: string[]
  title?: string
}

const DIVERGING = [
  '#2166AC', '#4393C3', '#92C5DE', '#D1E5F0', '#F7F7F7',
  '#FDDBC7', '#F4A582', '#D6604D', '#B2182B',
]

function getColor(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '#F7F7F7'
  // Map -1..1 to 0..8
  const idx = Math.round((value + 1) / 2 * 8)
  return DIVERGING[Math.max(0, Math.min(8, idx))]
}

export function HeatmapChart({ matrix, columns, title }: Props) {
  const [hover, setHover] = useState<{ row: string; col: string; val: number } | null>(null)

  if (!columns || columns.length === 0) {
    return <div className="text-dl-text-light text-dl-sm py-4 text-center">No data</div>
  }

  const cellSize = Math.min(40, Math.max(24, 280 / columns.length))
  const labelWidth = 80
  const totalWidth = labelWidth + columns.length * cellSize
  const totalHeight = 24 + columns.length * cellSize + 60 // header + grid + legend

  return (
    <div className="overflow-x-auto">
      <svg width={totalWidth} height={totalHeight} className="mx-auto">
        {/* Column headers */}
        {columns.map((col, j) => (
          <text key={`h-${j}`} x={labelWidth + j * cellSize + cellSize / 2} y={16}
            textAnchor="middle" fontSize={9} fill="#74838F" fontFamily="Lato">
            {col.length > 8 ? col.slice(0, 7) + '..' : col}
          </text>
        ))}

        {/* Grid */}
        {columns.map((row, i) => (
          <g key={`r-${i}`}>
            {/* Row label */}
            <text x={labelWidth - 4} y={24 + i * cellSize + cellSize / 2 + 4}
              textAnchor="end" fontSize={9} fill="#74838F" fontFamily="Lato">
              {row.length > 10 ? row.slice(0, 9) + '..' : row}
            </text>
            {/* Cells */}
            {columns.map((col, j) => {
              const val = matrix?.[row]?.[col] ?? 0
              return (
                <g key={`c-${i}-${j}`}
                  onMouseEnter={() => setHover({ row, col, val })}
                  onMouseLeave={() => setHover(null)}>
                  <rect
                    x={labelWidth + j * cellSize} y={24 + i * cellSize}
                    width={cellSize - 1} height={cellSize - 1}
                    fill={getColor(val)} rx={2}
                    stroke={hover?.row === row && hover?.col === col ? '#2E353B' : 'none'}
                    strokeWidth={1.5}
                  />
                  {cellSize >= 28 && (
                    <text x={labelWidth + j * cellSize + cellSize / 2} y={24 + i * cellSize + cellSize / 2 + 3}
                      textAnchor="middle" fontSize={8} fill={Math.abs(val) > 0.5 ? '#fff' : '#2E353B'}
                      fontFamily="Lato" fontWeight="bold">
                      {val === 1 ? '1' : val.toFixed(2)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        ))}

        {/* Legend */}
        {DIVERGING.map((c, i) => (
          <rect key={`lg-${i}`} x={labelWidth + i * 24} y={24 + columns.length * cellSize + 12}
            width={22} height={10} fill={c} rx={1} />
        ))}
        <text x={labelWidth} y={24 + columns.length * cellSize + 36} fontSize={8} fill="#74838F">-1</text>
        <text x={labelWidth + 4 * 24} y={24 + columns.length * cellSize + 36} fontSize={8} fill="#74838F" textAnchor="middle">0</text>
        <text x={labelWidth + 8 * 24} y={24 + columns.length * cellSize + 36} fontSize={8} fill="#74838F" textAnchor="end">+1</text>
      </svg>

      {/* Tooltip */}
      {hover && (
        <div className="text-center text-[11px] text-dl-text-medium mt-1">
          <span className="font-bold">{hover.row}</span> × <span className="font-bold">{hover.col}</span>: r = {hover.val.toFixed(4)}
        </div>
      )}
    </div>
  )
}
