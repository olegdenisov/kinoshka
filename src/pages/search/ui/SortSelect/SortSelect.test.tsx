import { fireEvent, render, screen } from '@testing-library/react'
import { SORT_LABELS } from '@features/catalog-filter'
import { SortSelect } from './SortSelect'

describe('SortSelect', () => {
  it('рендерит триггер с текущим значением, меню закрыто', () => {
    render(<SortSelect value='Newest' onChange={vi.fn()} />)

    expect(screen.getByText('Newest')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('без value триггер показывает "Default"', () => {
    render(<SortSelect value='' onChange={vi.fn()} />)

    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('клик по триггеру открывает список всех опций сортировки', () => {
    render(<SortSelect value='' onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Sort/ }))

    const listbox = screen.getByRole('listbox')
    SORT_LABELS.forEach(label => {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
    })
    expect(listbox).toBeInTheDocument()
  })

  it('выбор опции вызывает onChange с лейблом и закрывает меню', () => {
    const onChange = vi.fn()
    render(<SortSelect value='' onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /Sort/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Highest rated' }))

    expect(onChange).toHaveBeenCalledWith('Highest rated')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('текущее значение из URL подсвечивает активную опцию (aria-selected)', () => {
    render(<SortSelect value='A to Z' onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Sort/ }))

    expect(screen.getByRole('option', { name: 'A to Z' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Popular' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('disabled: триггер задизейблен, клик не открывает меню', () => {
    const onChange = vi.fn()
    render(<SortSelect value='Popular' onChange={onChange} disabled />)

    const trigger = screen.getByRole('button', { name: /Sort/ })
    expect(trigger).toBeDisabled()

    fireEvent.click(trigger)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
