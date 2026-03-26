'use client'

import { useTranslations } from 'next-intl'

interface Props {
  categories?: { id: string; color: string; label_en?: string; label_de?: string }[]
  locale?: string
}

export function GraphLegend({ categories, locale = 'en' }: Props) {
  const t = useTranslations()
  const de = locale === 'de'

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-gray-50/90 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 space-y-2.5 text-xs">
      <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">
        {de ? 'Legende' : 'Legend'}
      </p>

      {/* Ring structure */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-800 border-2 border-gray-600" />
          <span className="text-gray-500">{t('graph.ring0')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-gray-500">{t('graph.ring1')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-purple-400" />
          <span className="text-gray-500">{t('graph.ring2')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          <span className="text-gray-500">{t('graph.ring3')}</span>
        </div>
      </div>

      {/* Business categories (dynamic) */}
      {categories && categories.length > 0 && (
        <div className="border-t border-gray-200 pt-2 space-y-1.5">
          {categories.filter(c => c.id !== 'entity').map(cat => (
            <div key={cat.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="text-gray-400">{de ? cat.label_de : cat.label_en || cat.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trend indicators */}
      <div className="border-t border-gray-200 pt-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500 font-bold text-[11px]">↑</span>
          <span className="text-gray-400">{t('graph.trendUp')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-500 font-bold text-[11px]">↓</span>
          <span className="text-gray-400">{t('graph.trendDown')}</span>
        </div>
      </div>

      <p className="text-gray-400 text-[10px] pt-1">
        {de ? 'Klicken Sie auf einen Knoten für Details' : 'Click any node for details'}
      </p>
    </div>
  )
}
