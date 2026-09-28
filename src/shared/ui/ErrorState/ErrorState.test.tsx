import { fireEvent, render, screen } from '@testing-library/react'

import { ErrorState } from './ErrorState'

describe('ErrorState', () => {
  it('без onRetry/secondaryAction — ни кнопки, ни доп. узла нет', () => {
    render(
      <ErrorState
        title='Something went wrong'
        description='Please try again later'
      />,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Please try again later')).toBeInTheDocument()
    expect(screen.queryByText('Попробовать снова')).not.toBeInTheDocument()
  })

  it('secondaryAction={<span>custom</span>} без onRetry — рендерится только переданный узел', () => {
    render(
      <ErrorState
        title='Something went wrong'
        description='Please try again later'
        secondaryAction={<span>custom action</span>}
      />,
    )

    expect(screen.getByText('custom action')).toBeInTheDocument()
    expect(screen.queryByText('Попробовать снова')).not.toBeInTheDocument()
  })

  it('onRetry + secondaryAction одновременно — оба присутствуют, кнопка retry кликабельна и вызывает onRetry', () => {
    const onRetry = vi.fn()

    render(
      <ErrorState
        title='Something went wrong'
        description='Please try again later'
        onRetry={onRetry}
        secondaryAction={<span>go home</span>}
      />,
    )

    expect(screen.getByText('Попробовать снова')).toBeInTheDocument()
    expect(screen.getByText('go home')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Попробовать снова'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('существующее поведение (onRetry без secondaryAction) не регрессировало — только кнопка retry', () => {
    const onRetry = vi.fn()

    render(
      <ErrorState
        title='Something went wrong'
        description='Please try again later'
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Попробовать снова')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Попробовать снова'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
