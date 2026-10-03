import { fireEvent, screen } from '@testing-library/react'

import { renderWithRouter } from '../../../../test/router'
import { HeroSection } from './HeroSection'

let getUrl = () => ''

const renderHero = () => {
  getUrl = renderWithRouter(<HeroSection />, { url: '/' }).getUrl
}

const getInput = () =>
  screen.getByPlaceholderText('Try "films from 2024 rated 8+" or a title…')

describe('HeroSection', () => {
  it('запрос ≥ QUERY_MIN_LENGTH + Enter → /search?q=<query> (с trim)', () => {
    renderHero()

    fireEvent.change(getInput(), { target: { value: '  dune  ' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(getUrl()).toBe('/search?q=dune')
  })

  it('запрос ровно QUERY_MIN_LENGTH (2 символа) + Enter — граница: q попадает в URL', () => {
    renderHero()

    fireEvent.change(getInput(), { target: { value: 'du' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(getUrl()).toBe('/search?q=du')
  })

  it('чип типа при пустом запросе + клик "Search" → /search?type=movie', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Movies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(getUrl()).toBe('/search?type=movie')
  })

  it('запрос + чип типа одновременно → /search?type=<type>&q=<query>', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Series' }))
    fireEvent.change(getInput(), { target: { value: 'dune' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(getUrl()).toBe('/search?type=series&q=dune')
  })

  it('запрос короче QUERY_MIN_LENGTH (1 символ) + Enter → q не попадает в URL, но навигация на /search происходит', () => {
    renderHero()

    fireEvent.change(getInput(), { target: { value: 'd' } })
    fireEvent.keyDown(getInput(), { key: 'Enter' })

    expect(getUrl()).toBe('/search')
  })

  it('дефолт (Everything, пустой запрос) + клик "Search" → /search без query-строки, но навигация происходит', () => {
    renderHero()

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(getUrl()).toBe('/search')
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

    expect(getUrl()).toBe('/search')
  })
})
