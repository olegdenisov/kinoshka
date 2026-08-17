import type { FilterState } from '@features/catalog-filter'
import { EMPTY_FILTERS } from '@features/catalog-filter'
import { fireEvent, render, screen } from '@testing-library/react'

import { SearchSidebar } from './SearchSidebar'

const baseFilters: FilterState = { ...EMPTY_FILTERS }

describe('SearchSidebar', () => {
  it('рендерит YearRangeSlider, связанный с filters.yearFrom/yearTo', () => {
    const filters: FilterState = {
      ...baseFilters,
      yearFrom: 1990,
      yearTo: 2010,
    }

    render(
      <SearchSidebar
        filters={filters}
        onFiltersChange={vi.fn()}
        onToggleGenre={vi.fn()}
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

    render(
      <SearchSidebar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onToggleGenre={vi.fn()}
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
    render(
      <SearchSidebar
        filters={baseFilters}
        onFiltersChange={vi.fn()}
        onToggleGenre={vi.fn()}
        onReset={vi.fn()}
        disabled
      />,
    )

    expect(screen.getByRole('slider', { name: 'Year from' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Year to' })).toBeDisabled()
  })
})
