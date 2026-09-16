import type * as SharedLib from '@shared/lib'
import { render, screen, within } from '@testing-library/react'

// Лёгкие фейки вместо реального router-объекта/GlobalErrorBoundary — этот тест проверяет только
// композицию Providers (initAnalytics() вызван при импорте модуля, RouterProvider обёрнут в
// GlobalErrorBoundary), не бизнес-логику router.tsx/GlobalErrorBoundary.tsx/analytics (у них свои
// тесты). initSentry() больше не импортируется из providers.tsx (переехал в sentry-bootstrap.ts,
// см. sentry-bootstrap.test.ts/main.test.ts). reportWebVitals() удалён вместе с пайплайном Web
// Vitals→Plausible (2.5.7, заменён Sentry Performance) — providers.tsx больше не вызывает и не
// импортирует его.
vi.mock('./router', () => ({ router: {} }))
vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, initAnalytics: vi.fn() }
})
vi.mock('./GlobalErrorBoundary', () => ({
  GlobalErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='global-error-boundary'>{children}</div>
  ),
}))
vi.mock('react-router/dom', () => ({
  RouterProvider: () => <div>router content</div>,
}))

const { initAnalytics } = await import('@shared/lib')
const { Providers } = await import('./providers')

describe('Providers', () => {
  it('вызывает initAnalytics по одному разу при импорте модуля', () => {
    expect(initAnalytics).toHaveBeenCalledTimes(1)
  })

  it('оборачивает RouterProvider в GlobalErrorBoundary', () => {
    render(<Providers />)

    const boundary = screen.getByTestId('global-error-boundary')
    expect(within(boundary).getByText('router content')).toBeInTheDocument()
  })
})
