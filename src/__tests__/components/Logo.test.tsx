import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

import { Logo } from '@/components/Logo'

describe('Logo', () => {
  it('renders "DataLaser" text', () => {
    render(<Logo />)
    expect(screen.getByText('DataLaser')).toBeInTheDocument()
  })

  it('renders Zap icon (svg element)', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders at sm size with correct classes', () => {
    const { container } = render(<Logo size="sm" />)
    const box = container.querySelector('.w-6.h-6')
    expect(box).toBeInTheDocument()
    expect(screen.getByText('DataLaser')).toHaveClass('text-sm')
  })

  it('renders at md size (default) with correct classes', () => {
    const { container } = render(<Logo />)
    const box = container.querySelector('.w-8.h-8')
    expect(box).toBeInTheDocument()
    expect(screen.getByText('DataLaser')).toHaveClass('text-lg')
  })

  it('renders at lg size with correct classes', () => {
    const { container } = render(<Logo size="lg" />)
    const box = container.querySelector('.w-9.h-9')
    expect(box).toBeInTheDocument()
    expect(screen.getByText('DataLaser')).toHaveClass('text-xl')
  })

  it('renders as a Link (anchor) when href is provided', () => {
    render(<Logo href="/dashboard" />)
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  it('renders as a span (no link) when no href is provided', () => {
    render(<Logo />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    // The outer element is a span
    expect(screen.getByText('DataLaser').closest('span')).toBeInTheDocument()
  })
})
