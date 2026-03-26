'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

// Lazy load both views to avoid loading Sigma.js + d3-sankey together
const HealthView = dynamic(() => import('../graph/page'), { ssr: false })
const FlowView = dynamic(() => import('../flow/page'), { ssr: false })

type Tab = 'health' | 'flow'

export default function DataMapPage() {
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState<Tab>('flow')

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="h-11 flex items-center px-6 bg-white border-b border-gray-200 flex-shrink-0 gap-1">
        <button
          onClick={() => setActiveTab('flow')}
          className={`px-4 py-2 text-xs font-bold rounded-md transition-all
            ${activeTab === 'flow'
              ? 'bg-gray-900 text-white'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          {t('map.flow')}
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2 text-xs font-bold rounded-md transition-all
            ${activeTab === 'health'
              ? 'bg-gray-900 text-white'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          {t('map.health')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'health' && <HealthView />}
        {activeTab === 'flow' && <FlowView />}
      </div>
    </div>
  )
}
