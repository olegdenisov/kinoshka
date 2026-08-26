import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'

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

  it('пункт "Profile" (path: null) остаётся задизейбленным — клик не навигирует', () => {
    const { getPathname } = renderWithProbe('home')

    const profileBtn = screen.getByRole('button', { name: /Profile/ })
    expect(profileBtn.className).toMatch(/navItemDisabled/)

    fireEvent.click(profileBtn)

    expect(getPathname()).toBe('/')
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

  it('6 колонок — существующие пункты (в т.ч. задизейбленный "Profile") не задеты', () => {
    renderWithProbe('home')

    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Profile/ }).className).toMatch(
      /navItemDisabled/,
    )
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
