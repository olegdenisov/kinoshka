import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'

import { HeroSection } from './HeroSection'

/** Читает текущие pathname/search из роутера — способ проверить, что навигация реально произошла (не только что search пуст). */
let lastPathname = '/'
let lastSearch = ''
const LocationProbe = () => {
  const { pathname, search } = useLocation()
  useEffect(() => {
    lastPathname = pathname
    lastSearch = search
  }, [pathname, search])
  return null
}

const renderHero = () => {
  lastPathname = '/'
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

    expect(lastPathname).toBe('/search')
    expect(lastSearch).toBe('?q=dune')
  })

  it('запрос ровно QUERY_MIN_LENGTH (2 символа) + Enter — граница: q попадает в URL', () => {
    renderHero()

    fireEvent.change(getInput(), { target: { value: 'du' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(lastPathname).toBe('/search')
    expect(lastSearch).toBe('?q=du')
  })

  it('чип типа при пустом запросе + клик "Search" → /search?type=movie', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Movies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(lastPathname).toBe('/search')
    expect(lastSearch).toBe('?type=movie')
  })

  it('запрос + чип типа одновременно → /search?type=<type>&q=<query>', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Series' }))
    fireEvent.change(getInput(), { target: { value: 'dune' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(lastPathname).toBe('/search')
    expect(lastSearch).toBe('?type=series&q=dune')
  })

  it('запрос короче QUERY_MIN_LENGTH (1 символ) + Enter → q не попадает в URL, но навигация на /search происходит', () => {
    renderHero()

    fireEvent.change(getInput(), { target: { value: 'd' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(lastPathname).toBe('/search')
    expect(lastSearch).toBe('')
  })

  it('дефолт (Everything, пустой запрос) + клик "Search" → /search без query-строки, но навигация происходит', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(lastPathname).toBe('/search')
    expect(lastSearch).toBe('')
  })

  it('клик по чипу подсвечивает его (chipActive) и снимает подсветку с остальных', () => {
    renderHero()

    const everythingChip = screen.getByRole('button', { name: 'Everything' })
    const moviesChip = screen.getByRole('button', { name: 'Movies' })

    expect(everythingChip.className).toMatch(/chipActive/)
    expect(moviesChip.className).not.toMatch(/chipActive/)

    fireEvent.click(moviesChip)

    expect(moviesChip.className).toMatch(/chipActive/)
    expect(everythingChip.className).not.toMatch(/chipActive/)
  })

  it('повторный выбор "Everything" после выбора типа сбрасывает type в сабмите', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Movies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Everything' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(lastPathname).toBe('/search')
    expect(lastSearch).toBe('')
  })
})
