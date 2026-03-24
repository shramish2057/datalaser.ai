import { Zap } from 'lucide-react'
import Link from 'next/link'

export function Logo({ size = 'md', href }: { size?: 'sm' | 'md' | 'lg'; href?: string }) {
  const sizes = {
    sm: { box: 'w-6 h-6 rounded-md', icon: 12, text: 'text-sm' },
    md: { box: 'w-8 h-8 rounded-lg', icon: 16, text: 'text-lg' },
    lg: { box: 'w-9 h-9 rounded-xl', icon: 18, text: 'text-xl' },
  }
  const s = sizes[size]

  const content = (
    <span className="flex items-center gap-2">
      <span className={`${s.box} bg-gray-900 flex items-center justify-center shadow-lg shadow-gray-900/15`}>
        <Zap size={s.icon} className="text-white" />
      </span>
      <span className={`${s.text} font-bold tracking-tight text-gray-900`}>DataLaser</span>
    </span>
  )

  if (href) {
    return <Link href={href} className="flex items-center gap-2">{content}</Link>
  }
  return content
}
