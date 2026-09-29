import { render, screen } from '@testing-library/react'
import { Component, Suspense } from 'react'
import type { ReactNode } from 'react'

import { lazyNamed } from './lazyNamed'

const Greeting = ({ name }: { name: string }) => <div>Hello, {name}</div>

describe('lazyNamed', () => {
  it('резолвит компонент из именованного экспорта модуля', async () => {
    const LazyGreeting = lazyNamed(
      () => Promise.resolve({ Greeting }),
      'Greeting',
    )

    render(
      <Suspense fallback={<div>loading</div>}>
        <LazyGreeting name='World' />
      </Suspense>,
    )

    expect(await screen.findByText('Hello, World')).toBeInTheDocument()
  })

  it('пробрасывает реджект factory наружу (ловится ErrorBoundary, не глушится)', async () => {
    const error = new Error('chunk load failed')
    const LazyBroken = lazyNamed(() => Promise.reject(error), 'Broken')

    let caught: unknown
    render(
      <ErrorBoundaryProbe onError={e => (caught = e)}>
        <Suspense fallback={<div>loading</div>}>
          <LazyBroken />
        </Suspense>
      </ErrorBoundaryProbe>,
    )

    await screen.findByText('caught')
    expect(caught).toBe(error)
  })

  it('модуль undefined (заглушённый vite:preloadError перед reload) — держит Suspense, не бросает', async () => {
    const onError = vi.fn()
    const LazyPrevented = lazyNamed(
      () =>
        Promise.resolve(undefined) as unknown as Promise<
          Record<string, typeof Greeting>
        >,
      'Greeting',
    )

    render(
      <ErrorBoundaryProbe onError={onError}>
        <Suspense fallback={<div>loading</div>}>
          <LazyPrevented name='World' />
        </Suspense>
      </ErrorBoundaryProbe>,
    )

    expect(await screen.findByText('loading')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(onError).not.toHaveBeenCalled()
  })
})

// Минимальный class-boundary только для этого теста — проверяет, что lazyNamed не глушит
// реджект тихо, а не переиспользует прикладной `ErrorBoundary` (у него своя логика fallback,
// не имеющая отношения к тому, что здесь проверяется).
class ErrorBoundaryProbe extends Component<
  { onError: (error: unknown) => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error)
  }

  render() {
    if (this.state.hasError) return <div>caught</div>
    return this.props.children
  }
}
