import {
  BarChart3, TrendingUp, Microscope, DollarSign, ShoppingBag,
  Megaphone, Settings, Brain, Database, Globe,
  Layers, Target, Lightbulb, Rocket, Shield,
  type LucideIcon,
} from 'lucide-react'

export const PROJECT_ICONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'bar-chart', icon: BarChart3, label: 'Analytics' },
  { id: 'trending-up', icon: TrendingUp, label: 'Growth' },
  { id: 'microscope', icon: Microscope, label: 'Research' },
  { id: 'dollar', icon: DollarSign, label: 'Finance' },
  { id: 'shopping', icon: ShoppingBag, label: 'Commerce' },
  { id: 'megaphone', icon: Megaphone, label: 'Marketing' },
  { id: 'target', icon: Target, label: 'Goals' },
  { id: 'brain', icon: Brain, label: 'AI / ML' },
  { id: 'database', icon: Database, label: 'Data' },
  { id: 'globe', icon: Globe, label: 'Global' },
  { id: 'layers', icon: Layers, label: 'Platform' },
  { id: 'lightbulb', icon: Lightbulb, label: 'Ideas' },
  { id: 'rocket', icon: Rocket, label: 'Product' },
  { id: 'shield', icon: Shield, label: 'Security' },
  { id: 'settings', icon: Settings, label: 'Ops' },
]

/** Resolve a stored icon string to a Lucide component. Handles both new IDs and legacy emojis. */
export function resolveProjectIcon(stored: string): LucideIcon {
  const found = PROJECT_ICONS.find(i => i.id === stored)
  if (found) return found.icon
  // Fallback for legacy emoji values
  return BarChart3
}

/** Render a project icon in a styled container */
export function ProjectIconBadge({
  icon,
  color,
  size = 'md',
}: {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const Icon = resolveProjectIcon(icon)
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  }
  const iconSizes = { sm: 13, md: 16, lg: 20 }

  return (
    <div
      className={`${sizeClasses[size]} rounded-mb-md flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: color + '20' }}
    >
      <Icon size={iconSizes[size]} style={{ color }} />
    </div>
  )
}
