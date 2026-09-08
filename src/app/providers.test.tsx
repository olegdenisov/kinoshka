import { render, screen, within } from '@testing-library/react'

// Лёгкие фейки вместо реального router-объекта/GlobalErrorBoundary — этот тест проверяет только
// композицию Providers (initSentry() вызван при импорте модуля, RouterProvider обёрнут в
// GlobalErrorBoundary), не бизнес-логику router.tsx/GlobalErrorBoundary.tsx (у них свои тесты).
vi.mock('./router', () => ({ router: {} }))
vi.mock('./sentry', () => ({ initSentry: vi.fn() }))
vi.mock('./GlobalErrorBoundary', () => ({
  GlobalErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='global-error-boundary'>{children}</div>
  ),
}))
vi.mock('react-router/dom', () => ({
  RouterProvider: () => <div>router content</div>,
}))

const { initSentry } = await import('./sentry')
const { Providers } = await import('./providers')

describe('Providers', () => {
  it('вызывает initSentry один раз при импорте модуля', () => {
    expect(initSentry).toHaveBeenCalledTimes(1)
  })

  it('оборачивает RouterProvider в GlobalErrorBoundary', () => {
    render(<Providers />)

    const boundary = screen.getByTestId('global-error-boundary')
    expect(within(boundary).getByText('router content')).toBeInTheDocument()
  })
})
