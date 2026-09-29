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
  it('рендерит img с loading=lazy и decoding=async для отложенной загрузки и декодирования постеров', () => {
    const { container } = render(<Poster movie={MOVIE} />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('decoding', 'async')
  })

  it('eager: img без loading=lazy и decoding=async — above-the-fold постер не откладывается', () => {
    const { container } = render(<Poster movie={MOVIE} eager />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('loading', 'eager')
    expect(img).not.toHaveAttribute('decoding')
  })

  it('не рендерит img, когда у фильма нет постера', () => {
    const { container } = render(
      <Poster movie={{ ...MOVIE, poster: undefined }} />,
    )

    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
