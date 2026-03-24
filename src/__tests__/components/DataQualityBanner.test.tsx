import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DataQualityReport } from '@/lib/dataQuality'

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

import { DataQualityBanner } from '@/components/DataQualityBanner'

const goodReport: DataQualityReport = {
  level: 'good',
  score: 95,
  warnings: [],
  summary: 'All columns look clean',
  canProceed: true,
}

const amberReport: DataQualityReport = {
  level: 'amber',
  score: 62,
  warnings: [
    {
      column: 'email',
      issue: 'format_inconsistency',
      severity: 'amber',
      detail: 'Inconsistent email formats detected',
      affectedRows: 120,
    },
  ],
  summary: 'Some issues found',
  canProceed: true,
}

const redReport: DataQualityReport = {
  level: 'red',
  score: 30,
  warnings: [
    {
      column: 'revenue',
      issue: 'missing_values',
      severity: 'red',
      detail: '75% of values are missing',
      affectedRows: 750,
    },
    {
      column: 'category',
      issue: 'mixed_types',
      severity: 'amber',
      detail: 'Numbers and strings mixed',
    },
  ],
  summary: 'Major issues found',
  canProceed: true,
}

describe('DataQualityBanner', () => {
  it('renders green banner for good quality', () => {
    const { container } = render(<DataQualityBanner report={goodReport} />)
    expect(screen.getByText('Data quality: Good')).toBeInTheDocument()
    expect(screen.getByText(/Score: 95\/100/)).toBeInTheDocument()
    // Green background
    expect(container.firstElementChild).toHaveClass('bg-green-50')
  })

  it('renders amber banner with correct color coding', () => {
    const { container } = render(<DataQualityBanner report={amberReport} />)
    expect(screen.getByText('Data quality issues detected')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('bg-orange-50')
    expect(screen.getByText(/Score: 62\/100/)).toBeInTheDocument()
  })

  it('renders red banner with correct color coding', () => {
    const { container } = render(<DataQualityBanner report={redReport} />)
    expect(screen.getByText('Significant data quality issues')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('bg-red-50')
    expect(screen.getByText(/Score: 30\/100/)).toBeInTheDocument()
  })

  it('shows warning count text', () => {
    render(<DataQualityBanner report={amberReport} />)
    expect(screen.getByText(/1 issue/)).toBeInTheDocument()
  })

  it('shows pluralized issue count for multiple warnings', () => {
    render(<DataQualityBanner report={redReport} />)
    expect(screen.getByText(/2 issues/)).toBeInTheDocument()
  })

  it('red level is expanded by default showing warning details', () => {
    render(<DataQualityBanner report={redReport} />)
    // Red level starts expanded, so warning details should be visible
    expect(screen.getByText('revenue')).toBeInTheDocument()
    expect(screen.getByText('category')).toBeInTheDocument()
  })

  it('handles empty warnings array on good report', () => {
    render(<DataQualityBanner report={goodReport} />)
    // Good report has no expandable section at all
    expect(screen.queryByText(/issue/i)).not.toBeInTheDocument()
    expect(screen.getByText('Data quality: Good')).toBeInTheDocument()
  })

  it('shows affected rows when present', () => {
    render(<DataQualityBanner report={redReport} />)
    // Red report starts expanded, so we can see affected rows
    expect(screen.getByText(/750 rows affected/)).toBeInTheDocument()
  })
})
