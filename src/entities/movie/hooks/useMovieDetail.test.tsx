import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'
import { AsyncBoundary } from '@shared/ui'
import { getMovieDetailBundle, useMovieDetail } from './useMovieDetail'

const movieDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Movie',
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  slogan: 'Some tagline',
  description: 'Full synopsis.',
  ...overrides,
})

const mockMovie = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(http.get(`*/v1.5/movie/${id}`, () => HttpResponse.json(movieDoc(id, overrides))))
}

const mockMovieError = (id: number, status: number) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json({ statusCode: status, message: 'error', error: 'error' }, { status }),
    ),
  )
}

const mockImages = (docs: Record<string, unknown>[]) => {
  server.use(
    http.get('*/v1.5/image', () =>
      HttpResponse.json({
        docs,
        limit: 8,
        next: null,
        prev: null,
        hasNext: false,
        hasPrev: false,
      }),
    ),
  )
}

const mockImagesError = (status: number) => {
  server.use(
    http.get('*/v1.5/image', () =>
      HttpResponse.json({ statusCode: status, message: 'error', error: 'error' }, { status }),
    ),
  )
}

const Probe = ({ id }: { id: number }) => {
  const { detail, images } = useMovieDetail(id)
  return (
    <div>
      <span data-testid='title'>{detail.title}</span>
      <span data-testid='images-count'>{images.length}</span>
    </div>
  )
}

const renderProbe = async (id: number) => {
  await act(async () => {
    render(
      <AsyncBoundary>
        <Probe id={id} />
      </AsyncBoundary>,
    )
  })
}

describe('useMovieDetail — оба запроса успешны', () => {
  it('отдаёт detail и images', async () => {
    mockMovie(1, { name: 'Orbit of Silence' })
    mockImages([{ movieId: 1, type: 'frame', url: 'https://example.com/frame.jpg' }])

    await renderProbe(1)

    expect(screen.getByTestId('title')).toHaveTextContent('Orbit of Silence')
    expect(screen.getByTestId('images-count')).toHaveTextContent('1')
  })
})

describe('useMovieDetail — фильм успешен, картинки падают', () => {
  it('images: [] без throw', async () => {
    mockMovie(2, { name: 'Quiet Archive' })
    mockImagesError(500)

    await renderProbe(2)

    expect(screen.getByTestId('title')).toHaveTextContent('Quiet Archive')
    expect(screen.getByTestId('images-count')).toHaveTextContent('0')
  })
})

describe('useMovieDetail — фильм падает (404)', () => {
  it('промис реджектится, AsyncBoundary показывает ErrorState', async () => {
    mockMovieError(666, 404)
    mockImages([])

    await renderProbe(666)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByTestId('title')).not.toBeInTheDocument()
  })
})

// Регрессия на баг из истории Task 4 (см. докблок useMovieDetail.ts): 3 более ранние
// реализации кэша связки (без кэша / useMemo / ручной TTL-Map) ловили бесконечный
// ре-саспенс, потому что getMovieDetailBundle(id) отдавал новый Promise на каждый вызов.
// Этот тест — быстрая, читаемая проверка инварианта стабильности ссылки вместо того,
// чтобы полагаться на то, что регрессия проявится как зависший/таймаутящийся RTL-тест.
describe('getMovieDetailBundle — стабильность ссылки на промис связки', () => {
  it('повторный вызов с тем же id возвращает тот же Promise-объект (не пересобирает bundle)', async () => {
    mockMovie(3, { name: 'Stable Reference' })
    mockImages([])

    const first = getMovieDetailBundle(3)
    const second = getMovieDetailBundle(3)

    expect(first).toBe(second)
    await first
  })
})
