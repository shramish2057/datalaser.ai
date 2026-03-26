'use client'

import { useTranslations } from 'next-intl'

interface FlowLegendProps {
  categories?: { id: string; color: string; label_en?: string; label_de?: string }[]
  locale?: string
}

export function FlowLegend({ categories, locale = 'en' }: FlowLegendProps) {
  const t = useTranslations()

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-gray-50/90 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 space-y-2.5 text-xs">
      <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-1">
        {t('flow.legend')}
      </p>

      {/* Table roles */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#71717a]" />
          <span className="text-gray-500">{t('flow.entityTables')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#3b82f6]" />
          <span className="text-gray-500">{t('flow.transactionTables')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#ef4444]" />
          <span className="text-gray-500">{t('flow.outcomeTables')}</span>
        </div>
      </div>

      {/* KPI health */}
      <div className="border-t border-gray-200 pt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-emerald-500" />
          <span className="text-gray-400">{t('flow.kpis')} — {locale === 'de' ? 'Gesund' : 'Healthy'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-amber-500" />
          <span className="text-gray-400">{locale === 'de' ? 'Warnung' : 'Warning'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-red-500" />
          <span className="text-gray-400">{locale === 'de' ? 'Kritisch' : 'Critical'}</span>
        </div>
      </div>

      <p className="text-gray-400 text-[10px] pt-1">{t('flow.clickNode')}</p>
    </div>
  )
}
