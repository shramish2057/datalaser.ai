import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({}),
}))

import { ProjectIconBadge, resolveProjectIcon, PROJECT_ICONS } from '@/components/ProjectIcon'

describe('ProjectIconBadge', () => {
  it('renders an SVG icon', () => {
    const { container } = render(
      <ProjectIconBadge icon="bar-chart" color="#3b82f6" />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders at sm size with correct container classes', () => {
    const { container } = render(
      <ProjectIconBadge icon="bar-chart" color="#3b82f6" size="sm" />
    )
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveClass('w-6', 'h-6')
  })

  it('renders at md size (default) with correct container classes', () => {
    const { container } = render(
      <ProjectIconBadge icon="bar-chart" color="#3b82f6" />
    )
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveClass('w-8', 'h-8')
  })

  it('renders at lg size with correct container classes', () => {
    const { container } = render(
      <ProjectIconBadge icon="bar-chart" color="#3b82f6" size="lg" />
    )
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveClass('w-10', 'h-10')
  })

  it('applies background color with transparency', () => {
    const { container } = render(
      <ProjectIconBadge icon="bar-chart" color="#3b82f6" />
    )
    const wrapper = container.firstElementChild as HTMLElement
    // jsdom converts hex to rgb; #3b82f620 (with alpha) becomes rgba
    expect(wrapper.style.backgroundColor).toMatch(/rgba?\(59,\s*130,\s*246/)
  })

  it('applies icon color via inline style', () => {
    const { container } = render(
      <ProjectIconBadge icon="bar-chart" color="#3b82f6" />
    )
    const svg = container.querySelector('svg') as SVGElement
    // jsdom converts hex to rgb
    expect(svg.style.color).toBe('rgb(59, 130, 246)')
  })
})

describe('resolveProjectIcon', () => {
  it('resolves a known icon id', () => {
    const Icon = resolveProjectIcon('trending-up')
    expect(Icon).toBeDefined()
    // Should match the TrendingUp entry
    const found = PROJECT_ICONS.find(i => i.id === 'trending-up')
    expect(Icon).toBe(found!.icon)
  })

  it('falls back to BarChart3 for unknown/legacy values', () => {
    const Icon = resolveProjectIcon('some-emoji')
    const fallback = PROJECT_ICONS.find(i => i.id === 'bar-chart')
    expect(Icon).toBe(fallback!.icon)
  })
})
