import { act, fireEvent, render, screen } from '@testing-library/react'

import { AsyncContent } from '.'

const RETRY_BUTTON_TEXT = 'Попробовать снова'

describe('AsyncContent', () => {
  it('pending — показывает fallback, не контент', () => {
    render(
      <AsyncContent pending fallback={<div>loading</div>}>
        <div>content</div>
      </AsyncContent>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('pending важнее ошибки — во время повтора виден fallback', () => {
    render(
      <AsyncContent
        pending
        error={new Error('boom')}
        fallback={<div>loading</div>}
      >
        <div>content</div>
      </AsyncContent>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })

  it('без pending и ошибки — контент', () => {
    render(
      <AsyncContent pending={false}>
        <div>content</div>
      </AsyncContent>,
    )

    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('ошибка — дефолтный ErrorState, retry вызывает onRetry', () => {
    const onRetry = vi.fn()

    render(
      <AsyncContent pending={false} error={new Error('boom')} onRetry={onRetry}>
        <div>content</div>
      </AsyncContent>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('ошибка без onRetry — без кнопки retry', () => {
    render(
      <AsyncContent pending={false} error={new Error('boom')}>
        <div>content</div>
      </AsyncContent>,
    )

    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.queryByText(RETRY_BUTTON_TEXT)).not.toBeInTheDocument()
  })

  it('пользовательский errorFallback получает ошибку и retry', () => {
    const onRetry = vi.fn()

    render(
      <AsyncContent
        pending={false}
        error={new Error('boom')}
        onRetry={onRetry}
        errorFallback={({ error, retry }) => (
          <button type='button' onClick={retry}>
            custom {error.message}
          </button>
        )}
      >
        <div>content</div>
      </AsyncContent>,
    )

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('custom boom'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('два клика в одном синхронном тике вызывают onRetry один раз', () => {
    const onRetry = vi.fn()

    render(
      <AsyncContent pending={false} error={new Error('boom')} onRetry={onRetry}>
        <div>content</div>
      </AsyncContent>,
    )

    const retryButton = screen.getByText(RETRY_BUTTON_TEXT)
    act(() => {
      fireEvent.click(retryButton)
      fireEvent.click(retryButton)
    })

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('повтор, упавший с той же ошибкой, не блокирует следующий retry', async () => {
    const onRetry = vi.fn()
    const sameError = new Error('boom')

    render(
      <AsyncContent pending={false} error={sameError} onRetry={onRetry}>
        <div>content</div>
      </AsyncContent>,
    )

    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    await act(async () => {})
    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))

    expect(onRetry).toHaveBeenCalledTimes(2)
  })
})
