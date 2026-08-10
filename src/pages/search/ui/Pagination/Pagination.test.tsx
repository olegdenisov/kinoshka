import { render, screen } from '@testing-library/react'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('рендерит номера страниц вокруг текущей с эллипсисами по краям', () => {
    render(<Pagination page={5} totalPages={10} onChange={vi.fn()} />)

    ;['1', '4', '5', '6', '10'].forEach(label => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })
    expect(screen.getAllByText('…')).toHaveLength(2)
  })

  it('клик по номеру страницы вызывает onChange с этим номером', () => {
    const onChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onChange={onChange} />)

    screen.getByRole('button', { name: '4' }).click()

    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('на первой странице кнопка "назад" задизейблена, клик не вызывает onChange', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} totalPages={10} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    const prevBtn = buttons[0]
    expect(prevBtn).toBeDisabled()

    prevBtn.click()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('на последней странице кнопка "вперёд" задизейблена, клик не вызывает onChange', () => {
    const onChange = vi.fn()
    render(<Pagination page={10} totalPages={10} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    const nextBtn = buttons[buttons.length - 1]
    expect(nextBtn).toBeDisabled()

    nextBtn.click()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('клик "назад"/"вперёд" сдвигает страницу на 1', () => {
    const onChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    buttons[0].click()
    expect(onChange).toHaveBeenLastCalledWith(4)

    buttons[buttons.length - 1].click()
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  it('totalPages=1: единственная кнопка "1", обе стрелки задизейблены', () => {
    render(<Pagination page={1} totalPages={1} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()
    expect(buttons[buttons.length - 1]).toBeDisabled()
  })

  it('edge: page > totalPages клэмпится для рендера — не крашит, подсвечивает последнюю страницу', () => {
    render(<Pagination page={999} totalPages={5} onChange={vi.fn()} />)

    const activeBtn = screen.getByRole('button', { name: '5' })
    expect(activeBtn.className).toMatch(/btnActive/)

    const buttons = screen.getAllByRole('button')
    // "вперёд" клэмпится к последней валидной странице и задизейблен
    expect(buttons[buttons.length - 1]).toBeDisabled()
  })
})
