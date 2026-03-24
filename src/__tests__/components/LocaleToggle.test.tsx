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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({}),
}))

import { LocaleToggle } from '@/components/LocaleToggle'

describe('LocaleToggle', () => {
  it('renders DE and EN buttons', () => {
    render(<LocaleToggle />)
    expect(screen.getByText('DE')).toBeInTheDocument()
    expect(screen.getByText('EN')).toBeInTheDocument()
  })

  it('has active styling on EN button when locale is en', () => {
    render(<LocaleToggle />)
    const enButton = screen.getByText('EN')
    const deButton = screen.getByText('DE')

    // EN is the active locale (mocked as 'en')
    expect(enButton).toHaveClass('bg-white')
    expect(enButton).toHaveClass('text-dl-text-dark')
    expect(enButton).toHaveClass('shadow-sm')

    // DE is inactive
    expect(deButton).toHaveClass('text-dl-text-light')
    expect(deButton).not.toHaveClass('bg-white')
  })

  it('renders both buttons as clickable elements', () => {
    render(<LocaleToggle />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
  })
})
