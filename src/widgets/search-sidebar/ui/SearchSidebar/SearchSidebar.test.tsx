import type { FilterState } from '@features/catalog-filter'
import { EMPTY_FILTERS } from '@features/catalog-filter'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithStore } from '../../../../test/renderWithStore'
import { SearchSidebar } from './SearchSidebar'

const baseFilters: FilterState = { ...EMPTY_FILTERS }

describe('SearchSidebar', () => {
  it('рендерит YearRangeSlider, связанный с filters.yearFrom/yearTo', () => {
    const filters: FilterState = {
      ...baseFilters,
      yearFrom: 1990,
      yearTo: 2010,
    }

    renderWithStore(
      <SearchSidebar
        filters={filters}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(screen.getByRole('slider', { name: 'Year from' })).toHaveValue(
      '1990',
    )
    expect(screen.getByRole('slider', { name: 'Year to' })).toHaveValue('2010')
  })

  it('коммит drag на слайдере вызывает onFiltersChange с обновлённым FilterState, остальные поля сохранены', () => {
    const filters: FilterState = {
      ...baseFilters,
      type: 'movie',
      genres: ['драма'],
      rating: 7,
      yearFrom: 1990,
      yearTo: 2010,
    }
    const onFiltersChange = vi.fn()

    renderWithStore(
      <SearchSidebar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    )

    const fromInput = screen.getByRole('slider', { name: 'Year from' })
    fireEvent.change(fromInput, { target: { value: '1995' } })
    fireEvent.mouseUp(fromInput)

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...filters,
      yearFrom: 1995,
      yearTo: filters.yearTo,
    })
  })

  it('проп disabled пробрасывается в слайдер', () => {
    renderWithStore(
      <SearchSidebar
        filters={baseFilters}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
        disabled
      />,
    )

    expect(screen.getByRole('slider', { name: 'Year from' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Year to' })).toBeDisabled()
  })

  it('группа Type открыта, ниже — группы FilterPanel и кнопка Reset', () => {
    renderWithStore(
      <SearchSidebar
        filters={baseFilters}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    const typeGroup = screen.getByText('Type').closest('details')!
    expect(typeGroup.open).toBe(true)
    expect(screen.getByRole('button', { name: /^Movies/ })).toBeInTheDocument()

    for (const title of ['Genre', 'Year', 'Rating']) {
      expect(screen.getByText(title).closest('details')!.open).toBe(true)
    }
    for (const title of ['Country', 'Duration', 'Streaming', 'Collection']) {
      expect(screen.getByText(title).closest('details')!.open).toBe(false)
    }
    expect(
      screen.getByRole('button', { name: 'Reset filters' }),
    ).toBeInTheDocument()
  })

  it('клик по типу вызывает onFiltersChange с новым type, остальные поля сохранены', () => {
    const filters: FilterState = { ...baseFilters, rating: 7 }
    const onFiltersChange = vi.fn()

    renderWithStore(
      <SearchSidebar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Series/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, type: 'series' })
  })

  it('кнопка рейтинга из FilterPanel не продублирована сайдбаром', () => {
    renderWithStore(
      <SearchSidebar
        filters={baseFilters}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button', { name: '7+' })).toHaveLength(1)
  })
})
