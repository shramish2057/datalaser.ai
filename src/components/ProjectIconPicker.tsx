'use client'

import { PROJECT_ICONS } from './ProjectIcon'

export function ProjectIconPicker({
  value,
  color,
  onChange,
}: {
  value: string
  color: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-2 mt-1">
      {PROJECT_ICONS.map(({ id, icon: Icon, label }) => {
        const active = value === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`
              flex flex-col items-center gap-1 p-2.5 rounded-mb-md
              border transition-all
              ${active
                ? 'border-mb-brand bg-mb-brand-hover'
                : 'border-mb-border hover:border-mb-brand hover:bg-mb-bg-light'}
            `}
            title={label}
          >
            <div
              className="w-8 h-8 rounded-mb-md flex items-center justify-center"
              style={{ backgroundColor: active ? color + '20' : undefined }}
            >
              <Icon
                size={18}
                style={{ color: active ? color : undefined }}
                className={active ? '' : 'text-mb-text-light'}
              />
            </div>
            <span className={`text-[10px] font-bold ${active ? 'text-mb-brand' : 'text-mb-text-light'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
