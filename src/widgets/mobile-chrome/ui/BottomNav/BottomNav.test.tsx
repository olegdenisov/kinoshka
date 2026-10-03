import { fireEvent, screen } from '@testing-library/react'

import { renderWithRouter } from '../../../../test/router'
import { BottomNav } from './BottomNav'

const renderWithProbe = (
  active:
    | 'home'
    | 'search'
    | 'lists'
    | 'popular'
    | 'recommendations'
    | 'profile',
) => {
  const { getUrl } = renderWithRouter(<BottomNav active={active} />, {
    url: '/',
  })

  return {
    getPathname: () => getUrl(),
  }
}

describe('BottomNav — навигация к /favorites (пункт "Lists")', () => {
  it('клик по "Lists" ведёт на /favorites', () => {
    const { getPathname } = renderWithProbe('home')

    fireEvent.click(screen.getByRole('button', { name: /Lists/ }))

    expect(getPathname()).toBe('/favorites')
  })

  it('пункт "Lists" подсвечивается активным на /favorites', () => {
    renderWithProbe('lists')

    expect(screen.getByRole('button', { name: /Lists/ }).className).toMatch(
      /navItemActive/,
    )
  })
})

describe('BottomNav — навигация к /profile (пункт "Profile")', () => {
  it('клик по "Profile" ведёт на /profile', () => {
    const { getPathname } = renderWithProbe('home')

    fireEvent.click(screen.getByRole('button', { name: /Profile/ }))

    expect(getPathname()).toBe('/profile')
  })

  it('пункт "Profile" подсвечивается активным на /profile', () => {
    renderWithProbe('profile')

    expect(screen.getByRole('button', { name: /Profile/ }).className).toMatch(
      /navItemActive/,
    )
  })
})

describe('BottomNav — навигация к /popular (пункт "Popular")', () => {
  it('клик по "Popular" ведёт на /popular', () => {
    const { getPathname } = renderWithProbe('home')

    fireEvent.click(screen.getByRole('button', { name: /Popular/ }))

    expect(getPathname()).toBe('/popular')
  })

  it('пункт "Popular" подсвечивается активным на /popular', () => {
    renderWithProbe('popular')

    expect(screen.getByRole('button', { name: /Popular/ }).className).toMatch(
      /navItemActive/,
    )
  })

  it('6 колонок — количество пунктов не изменилось', () => {
    renderWithProbe('home')

    expect(screen.getAllByRole('button')).toHaveLength(6)
  })
})

describe('BottomNav — навигация к /recommendations (пункт "Picks")', () => {
  it('клик по "Picks" ведёт на /recommendations', () => {
    const { getPathname } = renderWithProbe('home')

    fireEvent.click(screen.getByRole('button', { name: /Picks/ }))

    expect(getPathname()).toBe('/recommendations')
  })

  it('пункт "Picks" подсвечивается активным на /recommendations', () => {
    renderWithProbe('recommendations')

    expect(screen.getByRole('button', { name: /Picks/ }).className).toMatch(
      /navItemActive/,
    )
  })
})

// urlAtom пишет в history отложенно (setTimeout(0)) — проверяем, что ушло в history: повторный
// тап не кладёт дубль (urlAtom на тот же URL не пишет вовсе, replace — страховка), и первое
// «Назад» уводит на предыдущую страницу.
describe('BottomNav — повторный тап по пункту текущей страницы', () => {
  const flushHistory = () => new Promise(resolve => setTimeout(resolve, 0))

  const tap = async (
    url: string,
    active: 'profile' | 'search',
    name: RegExp,
  ) => {
    const { getUrl } = renderWithRouter(<BottomNav active={active} />, { url })
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')

    fireEvent.click(screen.getByRole('button', { name }))
    await flushHistory()

    return { getUrl, push, replace }
  }

  afterEach(() => vi.restoreAllMocks())

  it('тап по пункту уже открытой страницы — дубля в истории нет', async () => {
    const { push } = await tap('/profile', 'profile', /Profile/)

    expect(push).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/profile')
  })

  it('переход на другую страницу — обычный push', async () => {
    const { getUrl, push, replace } = await tap('/movie/1', 'search', /Catalog/)

    expect(getUrl()).toBe('/search')
    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).not.toHaveBeenCalled()
  })

  it('тап по «Catalog» на /search?q=… с фильтрами в URL — push, а не replace: URL с фильтрами остаётся в истории', async () => {
    const { getUrl, push, replace } = await tap(
      '/search?q=matrix&genres=драма&page=3',
      'search',
      /Catalog/,
    )

    expect(getUrl()).toBe('/search')
    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).not.toHaveBeenCalled()
  })

  it('тап по «Catalog» на голом /search (без query) — дубля в истории нет', async () => {
    const { push } = await tap('/search', 'search', /Catalog/)

    expect(push).not.toHaveBeenCalled()
  })

  it('тап по пункту страницы, открытой с #hash, — push, а не replace: URL с hash остаётся в истории', async () => {
    const { getUrl, push, replace } = await tap(
      '/profile#top',
      'profile',
      /Profile/,
    )

    expect(getUrl()).toBe('/profile')
    expect(window.location.hash).toBe('')
    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).not.toHaveBeenCalled()
  })
})
