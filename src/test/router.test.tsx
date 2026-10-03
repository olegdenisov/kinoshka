import { act, screen } from '@testing-library/react'
import { useNavigate, useParams } from 'react-router'

import { renderWithRouter } from './router'

const Params = () => <output>{useParams().id}</output>

const GoTo = ({ to }: { to: string }) => {
  const navigate = useNavigate()
  return (
    <button type='button' onClick={() => navigate(to)}>
      go
    </button>
  )
}

describe('renderWithRouter', () => {
  it('getUrl возвращает начальный pathname + search', () => {
    const { getUrl } = renderWithRouter(<div />, { url: '/search?q=dune' })

    expect(getUrl()).toBe('/search?q=dune')
  })

  it('по умолчанию стартует с /', () => {
    expect(renderWithRouter(<div />).getUrl()).toBe('/')
  })

  it('getUrl отражает навигацию', async () => {
    const { getUrl } = renderWithRouter(<GoTo to='/popular?x=1' />)

    await act(async () => screen.getByRole('button').click())

    expect(getUrl()).toBe('/popular?x=1')
  })

  it('path даёт компоненту параметры пути', () => {
    renderWithRouter(<Params />, { url: '/movie/42', path: '/movie/:id' })

    expect(screen.getByRole('status')).toHaveTextContent('42')
  })
})
