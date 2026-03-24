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

import StepIndicator from '@/components/onboarding/StepIndicator'

const labels = ['Connect', 'Configure', 'Finish']

describe('StepIndicator', () => {
  it('renders correct number of steps', () => {
    render(<StepIndicator current={1} labels={labels} />)
    expect(screen.getByText('Connect')).toBeInTheDocument()
    expect(screen.getByText('Configure')).toBeInTheDocument()
    expect(screen.getByText('Finish')).toBeInTheDocument()
  })

  it('highlights the current step label with dark text', () => {
    render(<StepIndicator current={2} labels={labels} />)
    const configureLabel = screen.getByText('Configure')
    expect(configureLabel).toHaveClass('text-dl-text-dark')
  })

  it('shows non-current steps with light text', () => {
    render(<StepIndicator current={2} labels={labels} />)
    const connectLabel = screen.getByText('Connect')
    const finishLabel = screen.getByText('Finish')
    expect(connectLabel).toHaveClass('text-dl-text-light')
    expect(finishLabel).toHaveClass('text-dl-text-light')
  })

  it('shows checkmark for completed steps', () => {
    const { container } = render(<StepIndicator current={3} labels={labels} />)
    // Steps 1 and 2 are completed (step < current), should show checkmarks
    const circles = container.querySelectorAll('.rounded-full')
    // Step 1 and 2 should have checkmarks
    expect(circles[0].textContent).toBe('✓')
    expect(circles[1].textContent).toBe('✓')
    // Step 3 is current, shows number
    expect(circles[2].textContent).toBe('3')
  })

  it('applies active brand color to completed and current steps', () => {
    const { container } = render(<StepIndicator current={2} labels={labels} />)
    const circles = container.querySelectorAll('.rounded-full')
    // Steps 1 and 2 (step <= current) should have brand color
    expect(circles[0]).toHaveClass('bg-dl-brand')
    expect(circles[1]).toHaveClass('bg-dl-brand')
    // Step 3 is future
    expect(circles[2]).toHaveClass('bg-dl-bg-medium')
  })

  it('renders separator lines between steps', () => {
    const { container } = render(<StepIndicator current={1} labels={labels} />)
    // 3 steps = 2 separator lines
    const separators = container.querySelectorAll('.w-12')
    expect(separators).toHaveLength(2)
  })

  it('colors separator line with brand when step is completed', () => {
    const { container } = render(<StepIndicator current={3} labels={labels} />)
    const separators = container.querySelectorAll('.w-12')
    // Both separators should be brand-colored (steps 1 and 2 are completed)
    expect(separators[0]).toHaveClass('bg-dl-brand')
    expect(separators[1]).toHaveClass('bg-dl-brand')
  })
})
