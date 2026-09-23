import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'

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
  let lastPathname = ''
  const PathnameProbe = () => {
    const { pathname } = useLocation()
    useEffect(() => {
      lastPathname = pathname
    }, [pathname])
    return null
  }

  render(
    <MemoryRouter initialEntries={['/']}>
      <BottomNav active={active} />
      <PathnameProbe />
    </MemoryRouter>,
  )

  return {
    getPathname: () => lastPathname,
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

describe('BottomNav — повторный тап по пункту текущей страницы', () => {
  const BackButton = () => {
    const navigate = useNavigate()
    return (
      <button type='button' onClick={() => navigate(-1)}>
        back
      </button>
    )
  }

  it('не кладёт дубль в историю: одно «Назад» уводит на предыдущую страницу', () => {
    const PathnameOutput = () => <output>{useLocation().pathname}</output>
    render(
      <MemoryRouter initialEntries={['/popular', '/profile']} initialIndex={1}>
        <BottomNav active='profile' />
        <BackButton />
        <PathnameOutput />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Profile/ }))
    fireEvent.click(screen.getByRole('button', { name: 'back' }))

    expect(screen.getByRole('status')).toHaveTextContent('/popular')
  })

  it('переход на другую страницу — обычный push: «Назад» возвращает на исходную', () => {
    const PathnameOutput = () => <output>{useLocation().pathname}</output>
    render(
      <MemoryRouter initialEntries={['/movie/1']}>
        <BottomNav active='search' />
        <BackButton />
        <PathnameOutput />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Catalog/ }))
    expect(screen.getByRole('status')).toHaveTextContent('/search')
    fireEvent.click(screen.getByRole('button', { name: 'back' }))

    expect(screen.getByRole('status')).toHaveTextContent('/movie/1')
  })

  it('тап по «Catalog» на /search?q=… с фильтрами в URL — push, а не replace: «Назад» восстанавливает URL с фильтрами', () => {
    const PathnameOutput = () => {
      const { pathname, search } = useLocation()
      return <output>{`${pathname}${search}`}</output>
    }
    render(
      <MemoryRouter initialEntries={['/search?q=matrix&genres=драма&page=3']}>
        <BottomNav active='search' />
        <BackButton />
        <PathnameOutput />
      </MemoryRouter>,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      '/search?q=matrix&genres=драма&page=3',
    )

    fireEvent.click(screen.getByRole('button', { name: /Catalog/ }))
    expect(screen.getByRole('status')).toHaveTextContent('/search')

    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '/search?q=matrix&genres=драма&page=3',
    )
  })

  it('тап по «Catalog» на голом /search (без query) — replace: «Назад» уводит на предыдущую страницу', () => {
    const PathnameOutput = () => <output>{useLocation().pathname}</output>
    render(
      <MemoryRouter initialEntries={['/popular', '/search']} initialIndex={1}>
        <BottomNav active='search' />
        <BackButton />
        <PathnameOutput />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Catalog/ }))
    fireEvent.click(screen.getByRole('button', { name: 'back' }))

    expect(screen.getByRole('status')).toHaveTextContent('/popular')
  })

  it('тап по пункту страницы, открытой с #hash, — push, а не replace: «Назад» возвращает на URL с hash', () => {
    const LocationOutput = () => {
      const { pathname, hash } = useLocation()
      return <output>{`${pathname}${hash}`}</output>
    }
    render(
      <MemoryRouter
        initialEntries={['/popular', '/profile#top']}
        initialIndex={1}
      >
        <BottomNav active='profile' />
        <BackButton />
        <LocationOutput />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Profile/ }))
    expect(screen.getByRole('status')).toHaveTextContent(/^\/profile$/)
    fireEvent.click(screen.getByRole('button', { name: 'back' }))

    expect(screen.getByRole('status')).toHaveTextContent('/profile#top')
  })
})
