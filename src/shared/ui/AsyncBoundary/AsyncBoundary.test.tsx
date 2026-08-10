import { render, screen } from '@testing-library/react'
import { AsyncBoundary } from './AsyncBoundary'

const Bomb = () => {
  throw new Error('boom')
}

describe('AsyncBoundary — errorFallback', () => {
  it('без errorFallback показывает дефолтный ErrorState', () => {
    render(
      <AsyncBoundary>
        <Bomb />
      </AsyncBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('с errorFallback показывает кастомный фолбэк вместо дефолтного ErrorState', () => {
    render(
      <AsyncBoundary
        errorFallback={({ error, reset }) => (
          <div>
            <span data-testid="custom-error">{error?.message}</span>
            <button type="button" onClick={reset}>
              Custom retry
            </button>
          </div>
        )}
      >
        <Bomb />
      </AsyncBoundary>,
    )

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(screen.getByTestId('custom-error')).toHaveTextContent('boom')
    expect(screen.getByText('Custom retry')).toBeInTheDocument()
  })
})
