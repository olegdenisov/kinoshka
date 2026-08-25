import { render, screen } from '@testing-library/react'

import { PopularBadge } from './index'

describe('PopularBadge', () => {
  it('рендерит #{position}', () => {
    render(<PopularBadge position={3} />)

    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('с positionDiff > 0 рендерит знаковое число со знаком +', () => {
    render(<PopularBadge position={3} positionDiff={2} />)

    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('с positionDiff < 0 рендерит знаковое число со знаком −', () => {
    render(<PopularBadge position={5} positionDiff={-4} />)

    expect(screen.getByText('−4')).toBeInTheDocument()
  })

  it('без positionDiff знаковое число не рендерится', () => {
    render(<PopularBadge position={3} />)

    expect(screen.queryByText(/^[+−]/)).not.toBeInTheDocument()
  })

  it('с positionDiff = 0 знаковое число не рендерится', () => {
    render(<PopularBadge position={3} positionDiff={0} />)

    expect(screen.queryByText(/^[+−]/)).not.toBeInTheDocument()
  })

  it('с positionDiff = null знаковое число не рендерится', () => {
    render(<PopularBadge position={3} positionDiff={null} />)

    expect(screen.queryByText(/^[+−]/)).not.toBeInTheDocument()
  })

  it('aria-label присутствует и корректен без positionDiff', () => {
    render(<PopularBadge position={3} />)

    expect(screen.getByLabelText('Position 3')).toBeInTheDocument()
  })

  it('aria-label присутствует и корректен с positionDiff', () => {
    render(<PopularBadge position={3} positionDiff={2} />)

    expect(screen.getByLabelText('Position 3, change +2')).toBeInTheDocument()
  })
})
