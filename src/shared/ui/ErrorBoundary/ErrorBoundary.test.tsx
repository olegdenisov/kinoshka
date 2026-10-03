import { fireEvent, render, screen } from '@testing-library/react'
import type { ErrorInfo } from 'react'

import { ErrorBoundary } from './ErrorBoundary'

// module-level флаг (не self-flipping внутри рендера) — React после ошибки в рендере
// синхронно повторяет попытку рендера ещё раз ДО того, как решит считать её настоящей
// ошибкой (стандартное поведение React); self-flipping флаг привёл бы к тому,
// что этот внутренний повтор рендера уже не бросает, и boundary вообще не перехватывает
// ошибку.
let shouldThrow = true
const Bomb = () => {
  if (shouldThrow) throw new Error('boom')
  return <div>recovered</div>
}

afterEach(() => {
  shouldThrow = true
})

describe('ErrorBoundary', () => {
  it('без ошибки в детях — рендерит children, onError не вызван', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary
        fallback={({ error }) => <div>Error: {error?.message}</div>}
        onError={onError}
      >
        <div>all good</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText('all good')).toBeInTheDocument()
    expect(onError).not.toHaveBeenCalled()
  })

  it('ошибка в детях, onError передан — вызывается один раз с (error, errorInfo), рендерится fallback', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary
        fallback={({ error }) => <div>Error: {error?.message}</div>}
        onError={onError}
      >
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Error: boom')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)

    const [error, errorInfo] = onError.mock.calls[0] as [Error, ErrorInfo]
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('boom')
    expect(errorInfo).toHaveProperty('componentStack')
  })

  it('ошибка в детях, onError НЕ передан — не падает (проп опционален), fallback всё равно рендерится', () => {
    render(
      <ErrorBoundary
        fallback={({ error }) => <div>Error: {error?.message}</div>}
      >
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Error: boom')).toBeInTheDocument()
  })

  it('reset() из fallback-параметров возвращает к рендеру children после того, как причина ошибки устранена', () => {
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <div>
            <div>Error: {error?.message}</div>
            <button type='button' onClick={reset}>
              Retry
            </button>
          </div>
        )}
      >
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Error: boom')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByText('Retry'))

    expect(screen.getByText('recovered')).toBeInTheDocument()
    expect(screen.queryByText('Error: boom')).not.toBeInTheDocument()
  })
})
