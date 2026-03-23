'use client'

import React from 'react'

type Props = { current: number; labels: string[] }

export default function StepIndicator({ current, labels }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {labels.map((label, i) => {
        const step = i + 1
        return (
          <React.Fragment key={step}>
            <div className="flex items-center gap-2">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  text-dl-xs font-black
                  ${step <= current ? 'bg-dl-brand text-white' : 'bg-dl-bg-medium text-dl-text-light'}
                `}
              >
                {step < current ? '✓' : step}
              </div>
              <span
                className={`text-dl-sm font-bold ${step === current ? 'text-dl-text-dark' : 'text-dl-text-light'}`}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={`h-px w-12 mx-3 ${step < current ? 'bg-dl-brand' : 'bg-dl-border-dark'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
