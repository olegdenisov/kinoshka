import { render } from '@testing-library/react'

import type { Movie } from '../../model/types'
import { Poster } from './Poster'

const MOVIE: Movie = {
  id: 1,
  title: 'Orbit of Silence',
  year: 2024,
  rating: 8.4,
  type: 'movie',
  genre: ['Drama'],
  runtime: '2h 18m',
  hue: 18,
  poster: 'https://example.com/poster.jpg',
}

describe('Poster', () => {
  it('рендерит img с loading=lazy, чтобы постеры за пределами первого экрана не грузились сразу', () => {
    const { container } = render(<Poster movie={MOVIE} />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('не рендерит img, когда у фильма нет постера', () => {
    const { container } = render(
      <Poster movie={{ ...MOVIE, poster: undefined }} />,
    )

    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
