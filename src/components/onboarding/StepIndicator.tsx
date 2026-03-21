'use client'

import React from 'react'

type Props = { current: 1 | 2 | 3; labels: string[] }

export default function StepIndicator({ current, labels }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {[1, 2, 3].map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex items-center gap-2">
            <div
              className={`
                w-6 h-6 rounded-full flex items-center justify-center
                text-mb-xs font-black
                ${step <= current ? 'bg-mb-brand text-white' : 'bg-mb-bg-medium text-mb-text-light'}
              `}
            >
              {step < current ? '✓' : step}
            </div>
            <span
              className={`text-mb-sm font-bold ${step === current ? 'text-mb-text-dark' : 'text-mb-text-light'}`}
            >
              {labels[i]}
            </span>
          </div>
          {i < 2 && (
            <div className={`h-px w-12 mx-3 ${step < current ? 'bg-mb-brand' : 'bg-mb-border-dark'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
