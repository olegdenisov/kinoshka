import type * as SharedLib from '@shared/lib'
import { render, screen, within } from '@testing-library/react'

// Лёгкие фейки вместо реального router-объекта/GlobalErrorBoundary — этот тест проверяет только
// композицию Providers (initAnalytics() и registerChunkPreloadRecovery() вызваны при импорте
// модуля, RouterProvider обёрнут в GlobalErrorBoundary), не бизнес-логику
// router.tsx/GlobalErrorBoundary.tsx/analytics/chunkPreloadRecovery (у них свои тесты). initSentry()
// больше не импортируется из providers.tsx (переехал в sentry-bootstrap.ts, см.
// sentry-bootstrap.test.ts/main.test.ts). reportWebVitals() удалён вместе с пайплайном Web
// Vitals→Plausible (2.5.7, заменён Sentry Performance) — providers.tsx больше не вызывает и не
// импортирует его. Redux Provider (store из ./store) — настоящий: проверяем, что он стоит над
// RouterProvider.
vi.mock('./router', () => ({ router: {} }))
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
// Фейковый RouterProvider читает стор через useStore — так тест видит, что Provider стоит выше
// роутера (без него useStore бросает).
vi.mock('react-router/dom', async () => {
  const { useStore } = await import('react-redux')
  const RouterProvider = () => {
    const hasApiSlice = 'api' in (useStore().getState() as object)
    return <div>router content{hasApiSlice ? ' with store' : ''}</div>
  }
  return { RouterProvider }
})

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

  it('оборачивает RouterProvider в GlobalErrorBoundary', () => {
    render(<Providers />)

    const boundary = screen.getByTestId('global-error-boundary')
    expect(within(boundary).getByText(/router content/)).toBeInTheDocument()
  })

  it('отдаёт роутеру Redux-стор через Provider', () => {
    render(<Providers />)

    expect(screen.getByText('router content with store')).toBeInTheDocument()
  })
})
