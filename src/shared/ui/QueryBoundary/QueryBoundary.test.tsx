import { fireEvent, render, screen } from '@testing-library/react'

import { QueryBoundary } from '.'

const RETRY = 'Попробовать снова'

type Q = Parameters<typeof QueryBoundary<string>>[0]['query']

const makeQuery = (patch: Partial<Q> = {}): Q => ({
  data: undefined,
  isLoading: false,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
  ...patch,
})

const renderBoundary = (query: Q, extra = {}) =>
  render(
    <QueryBoundary query={query} {...extra}>
      {data => <div>data:{data}</div>}
    </QueryBoundary>,
  )

describe('QueryBoundary', () => {
  it('isLoading — показывает fallback', () => {
    renderBoundary(makeQuery({ isLoading: true }), {
      fallback: <div>loading</div>,
    })
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('данные — вызывает children', () => {
    renderBoundary(makeQuery({ data: 'x' }))
    expect(screen.getByText('data:x')).toBeInTheDocument()
  })

  it('ошибка — ErrorState, Retry вызывает refetch', () => {
    const query = makeQuery({ isError: true, error: new Error('boom') })
    renderBoundary(query)
    expect(screen.getByText('boom')).toBeInTheDocument()
    fireEvent.click(screen.getByText(RETRY))
    expect(query.refetch).toHaveBeenCalledTimes(1)
  })

  it('кастомный errorFallback получает error и reset', () => {
    const error = new Error('custom')
    const query = makeQuery({ isError: true, error })
    renderBoundary(query, {
      errorFallback: ({
        error: e,
        reset,
      }: {
        error: unknown
        reset: () => void
      }) => (
        <button type='button' onClick={reset}>
          {(e as Error).message}-retry
        </button>
      ),
    })
    fireEvent.click(screen.getByText('custom-retry'))
    expect(query.refetch).toHaveBeenCalledTimes(1)
  })

  it('пропущенный запрос (data undefined, не loading) — fallback', () => {
    renderBoundary(makeQuery(), { fallback: <div>skipped</div> })
    expect(screen.getByText('skipped')).toBeInTheDocument()
  })

  it('ошибка перезапроса при старых данных — ошибка, не данные', () => {
    renderBoundary(
      makeQuery({ data: 'old', isError: true, error: new Error('again') }),
    )
    expect(screen.getByText('again')).toBeInTheDocument()
    expect(screen.queryByText('data:old')).not.toBeInTheDocument()
  })
})
