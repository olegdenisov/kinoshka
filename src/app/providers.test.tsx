import type * as SharedLib from '@shared/lib'
import { render, screen, within } from '@testing-library/react'

// Лёгкие фейки вместо реальных роутов/GlobalErrorBoundary — этот тест проверяет только
// композицию Providers (initAnalytics() и registerChunkPreloadRecovery() вызваны при импорте
// модуля, outlet роутов обёрнут в GlobalErrorBoundary), не бизнес-логику
// routes.tsx/GlobalErrorBoundary.tsx/analytics/chunkPreloadRecovery (у них свои тесты; навигация
// через настоящий Providers — в routes.test.tsx).
vi.mock('./routes', () => ({
  layoutRoute: { render: () => <div>router content</div> },
}))
vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, initAnalytics: vi.fn() }
})
vi.mock('./chunkPreloadRecovery', () => ({
  registerChunkPreloadRecovery: vi.fn(),
}))
vi.mock('./GlobalErrorBoundary', () => ({
  GlobalErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='global-error-boundary'>{children}</div>
  ),
}))

const { initAnalytics } = await import('@shared/lib')
const { registerChunkPreloadRecovery } = await import('./chunkPreloadRecovery')
const { Providers } = await import('./providers')

describe('Providers', () => {
  it('вызывает initAnalytics по одному разу при импорте модуля', () => {
    expect(initAnalytics).toHaveBeenCalledTimes(1)
  })

  it('вызывает registerChunkPreloadRecovery по одному разу при импорте модуля', () => {
    expect(registerChunkPreloadRecovery).toHaveBeenCalledTimes(1)
  })

  it('оборачивает outlet роутов в GlobalErrorBoundary', () => {
    render(<Providers />)

    const boundary = screen.getByTestId('global-error-boundary')
    expect(within(boundary).getByText('router content')).toBeInTheDocument()
  })
})
