import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'

import { HeroSection } from './HeroSection'

/** Читает текущую строку query из роутера — способ проверить, что навигация реально произошла. */
let lastSearch = ''
const LocationProbe = () => {
  const { search } = useLocation()
  useEffect(() => {
    lastSearch = search
  }, [search])
  return null
}

const renderHero = () => {
  lastSearch = ''
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HeroSection />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const getInput = () =>
  screen.getByPlaceholderText('Try "films from 2024 rated 8+" or a title…')

describe('HeroSection', () => {
  it('запрос ≥ QUERY_MIN_LENGTH + Enter → /search?q=<query> (с trim)', () => {
    renderHero()

    fireEvent.change(getInput(), { target: { value: '  dune  ' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(lastSearch).toBe('?q=dune')
  })

  it('чип типа при пустом запросе + клик "Search" → /search?type=movie', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Movies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(lastSearch).toBe('?type=movie')
  })

  it('запрос + чип типа одновременно → /search?type=<type>&q=<query>', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Series' }))
    fireEvent.change(getInput(), { target: { value: 'dune' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(lastSearch).toBe('?type=series&q=dune')
  })

  it('запрос короче QUERY_MIN_LENGTH (1 символ) + Enter → q не попадает в URL', () => {
    renderHero()

    fireEvent.change(getInput(), { target: { value: 'd' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(lastSearch).toBe('')
  })

  it('дефолт (Everything, пустой запрос) + клик "Search" → /search без query-строки', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(lastSearch).toBe('')
  })
})
