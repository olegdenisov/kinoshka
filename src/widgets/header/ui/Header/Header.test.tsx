import { act, useEffect } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { Header } from './Header'

/** Читает текущую строку query из роутера — способ проверить, что запись в URL реально произошла. */
let lastSearch = ''
const LocationProbe = () => {
  const { search } = useLocation()
  useEffect(() => {
    lastSearch = search
  }, [search])
  return null
}

const renderHeader = (initialEntries: string[]) => {
  lastSearch = ''
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Header variant="search" activeNav="search" />
      <LocationProbe />
    </MemoryRouter>,
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Header (variant="search")', () => {
  it('role="search" на контейнере поиска', () => {
    renderHeader(['/search'])
    expect(screen.getByRole('search')).toBeInTheDocument()
  })

  it('ввод → через 250ms пишет ?q (replace: true, без лишней записи в историю)', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'dune' } })
    expect(lastSearch).toBe('')

    act(() => vi.advanceTimersByTime(250))
    expect(lastSearch).toBe('?q=dune')
  })

  it('min-length < 2 — ?q не пишется', () => {
    renderHeader(['/search'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'd' } })
    act(() => vi.advanceTimersByTime(250))

    expect(lastSearch).toBe('')
  })

  it('min-length < 2 после непустого — ?q чистится', () => {
    renderHeader(['/search?q=dune'])
    const input = screen.getByPlaceholderText('Search movies, series, anime…')

    fireEvent.change(input, { target: { value: 'd' } })
    act(() => vi.advanceTimersByTime(250))

    expect(lastSearch).toBe('')
  })

  it('кнопка × при непустом q сбрасывает ?q немедленно (без ожидания дебаунса)', () => {
    renderHeader(['/search?q=dune'])

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(lastSearch).toBe('')
    expect(screen.getByPlaceholderText('Search movies, series, anime…')).toHaveValue('')
  })

  it('инициализация инпута из URL', () => {
    renderHeader(['/search?q=dune'])
    expect(screen.getByPlaceholderText('Search movies, series, anime…')).toHaveValue('dune')
  })
})
