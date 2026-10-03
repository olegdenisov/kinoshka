import { urlAtom } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { act, screen } from '@testing-library/react'

import { renderWithRouter } from './router'

const Pathname = reatomComponent(
  () => <output>{urlAtom().pathname}</output>,
  'TestPathname',
)

describe('renderWithRouter', () => {
  it('getUrl возвращает начальный pathname + search', () => {
    const { getUrl } = renderWithRouter(<div />, { url: '/search?q=dune' })

    expect(getUrl()).toBe('/search?q=dune')
  })

  it('по умолчанию стартует с /', () => {
    expect(renderWithRouter(<div />).getUrl()).toBe('/')
  })

  it('getUrl отражает навигацию через urlAtom.go', async () => {
    const { getUrl } = renderWithRouter(<div />)

    await act(async () => urlAtom.go('/popular?x=1'))

    expect(getUrl()).toBe('/popular?x=1')
  })

  it('компонент видит URL, выставленный хелпером', () => {
    renderWithRouter(<Pathname />, { url: '/movie/42' })

    expect(screen.getByRole('status')).toHaveTextContent('/movie/42')
  })

  it('повторный вызов в том же тесте перевыставляет URL уже инициализированного urlAtom', () => {
    const first = renderWithRouter(<div />, { url: '/profile' })
    first.unmount()

    expect(renderWithRouter(<div />, { url: '/favorites' }).getUrl()).toBe(
      '/favorites',
    )
  })
})
