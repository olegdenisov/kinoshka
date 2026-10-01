import { fireEvent, render, screen } from '@testing-library/react'

import { QueryBoundary, type QueryBoundaryQuery } from './QueryBoundary'

const makeQuery = (
  patch: Partial<QueryBoundaryQuery<string>> = {},
): QueryBoundaryQuery<string> => ({
  data: undefined,
  isLoading: false,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
  ...patch,
})

const renderBoundary = (
  query: QueryBoundaryQuery<string>,
  props: Partial<Parameters<typeof QueryBoundary<string>>[0]> = {},
) =>
  render(
    <QueryBoundary query={query} {...props}>
      {data => <div data-testid='content'>{data}</div>}
    </QueryBoundary>,
  )

describe('QueryBoundary', () => {
  it('isLoading -> fallback по умолчанию (Spinner)', () => {
    const { container } = renderBoundary(makeQuery({ isLoading: true }))

    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
    expect(container.querySelector('span')).toBeInTheDocument()
  })

  it('кастомный fallback при isLoading', () => {
    renderBoundary(makeQuery({ isLoading: true }), {
      fallback: <div data-testid='skeleton' />,
    })

    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })

  it('data есть -> children(data)', () => {
    renderBoundary(makeQuery({ data: 'hello' }))

    expect(screen.getByTestId('content')).toHaveTextContent('hello')
  })

  it('ошибка -> ErrorState с message, Retry вызывает refetch', () => {
    const refetch = vi.fn()
    renderBoundary(
      makeQuery({ isError: true, error: { message: 'boom' }, refetch }),
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('ошибка без message -> дефолтный текст', () => {
    renderBoundary(makeQuery({ isError: true, error: undefined }))

    expect(screen.getByText('Please try again later')).toBeInTheDocument()
  })

  it('кастомный errorFallback получает error и reset', () => {
    const refetch = vi.fn()
    renderBoundary(
      makeQuery({ isError: true, error: { message: 'x' }, refetch }),
      {
        errorFallback: ({ error, reset }) => (
          <button type='button' onClick={reset}>
            custom {(error as { message: string }).message}
          </button>
        ),
      },
    )

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'custom x' }))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('пропущенный запрос (data undefined, не loading) -> fallback, не children', () => {
    renderBoundary(makeQuery(), { fallback: <div data-testid='skeleton' /> })

    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })

  it('ошибка перезапроса при старых данных -> ошибка, а не контент', () => {
    renderBoundary(
      makeQuery({ data: 'stale', isError: true, error: { message: 'fail' } }),
    )

    expect(screen.getByText('fail')).toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })
})
