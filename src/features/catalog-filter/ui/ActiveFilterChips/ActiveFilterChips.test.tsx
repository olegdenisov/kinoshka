import { fireEvent, render, screen } from '@testing-library/react'

import type { ActiveChip } from '../../model/useFilterState'
import { ActiveFilterChips } from './ActiveFilterChips'

const makeChip = (label: string, onRemove = vi.fn()): ActiveChip => ({
  label,
  onRemove,
})

describe('ActiveFilterChips — обычный вариант (compact не задан, desktop SearchControls)', () => {
  it('пустой список чипов — ничего не рендерит, включая "Clear all"', () => {
    render(<ActiveFilterChips chips={[]} onClearAll={vi.fn()} />)

    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('рендерит чип на каждый активный фильтр и позволяет снять конкретный клик по его крестику', () => {
    const onRemove = vi.fn()
    render(
      <ActiveFilterChips
        chips={[makeChip('Movies', onRemove), makeChip('Drama')]}
      />,
    )

    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()

    const movieChip = screen.getByText('Movies').closest('span')!
    fireEvent.click(movieChip.querySelector('button')!)

    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('"Clear all" рендерится только когда есть чипы и передан onClearAll, клик вызывает его', () => {
    const onClearAll = vi.fn()
    const { rerender } = render(
      <ActiveFilterChips chips={[makeChip('Movies')]} />,
    )
    // onClearAll не передан — кнопки нет, даже если чипы есть.
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()

    rerender(
      <ActiveFilterChips
        chips={[makeChip('Movies')]}
        onClearAll={onClearAll}
      />,
    )
    fireEvent.click(screen.getByText('Clear all'))

    expect(onClearAll).toHaveBeenCalledTimes(1)
  })
})

describe('ActiveFilterChips — компактный вариант (compact, мобильный sticky filter-bar)', () => {
  it('рендерит компактные чипы без "Clear all", даже если onClearAll передан', () => {
    render(
      <ActiveFilterChips
        chips={[makeChip('Movies'), makeChip('Drama')]}
        onClearAll={vi.fn()}
        compact
      />,
    )

    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('обрезает список до 6 чипов', () => {
    const chips = Array.from({ length: 8 }, (_, i) => makeChip(`Chip ${i}`))
    render(<ActiveFilterChips chips={chips} compact />)

    expect(screen.getByText('Chip 0')).toBeInTheDocument()
    expect(screen.getByText('Chip 5')).toBeInTheDocument()
    expect(screen.queryByText('Chip 6')).not.toBeInTheDocument()
    expect(screen.queryByText('Chip 7')).not.toBeInTheDocument()
  })

  it('клик по крестику компактного чипа вызывает его onRemove (ветка chipCompactRemove)', () => {
    const onRemove = vi.fn()
    render(<ActiveFilterChips chips={[makeChip('Movies', onRemove)]} compact />)

    const chip = screen.getByText('Movies').closest('span')!
    fireEvent.click(chip.querySelector('button')!)

    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
