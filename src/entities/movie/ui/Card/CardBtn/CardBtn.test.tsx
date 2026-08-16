import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

import { CardBtn } from './index'

describe('CardBtn', () => {
  it('active=true применяет активный класс, active=false/undefined — нет', () => {
    const { rerender } = render(<CardBtn icon={<span />} active />)
    expect(screen.getByRole('button').className).toMatch(/btnActive/)

    rerender(<CardBtn icon={<span />} />)
    expect(screen.getByRole('button').className).not.toMatch(/btnActive/)
  })

  it('ariaLabel рендерится на кнопке', () => {
    render(<CardBtn icon={<span />} ariaLabel='Add to favorites' />)
    expect(
      screen.getByRole('button', { name: 'Add to favorites' }),
    ).toBeInTheDocument()
  })

  it('onClick вызывается по клику', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<CardBtn icon={<span />} ariaLabel='Rate' onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Rate' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('клик внутри Link не триггерит переход (preventDefault/stopPropagation)', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path='/'
            element={
              <a href='/movie/1'>
                <CardBtn icon={<span />} ariaLabel='Rate' onClick={onClick} />
              </a>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Rate' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).not.toBe('/movie/1')
  })
})
