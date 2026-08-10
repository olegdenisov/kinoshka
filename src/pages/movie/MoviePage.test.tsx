import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/setup'
import { MoviePage } from './MoviePage'

const movieDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Orbit of Silence',
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [
    {
      id: 10,
      name: 'Liv Korhonen',
      description: 'Ines Varga',
      enProfession: 'actor',
      profession: 'actor',
    },
    {
      id: 20,
      name: 'Hanna Vesper',
      enProfession: 'director',
      profession: 'director',
    },
  ],
  countries: [{ name: 'Finland' }],
  slogan: "Some stories don't resolve.",
  description: 'Full synopsis text about the observatory.',
  ...overrides,
})

const mockMovie = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(movieDoc(id, overrides)),
    ),
  )
}

const mockMovieError = (id: number, status: number, message = 'error') => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(
        { statusCode: status, message, error: 'error' },
        { status },
      ),
    ),
  )
}

const mockImages = (docs: Record<string, unknown>[] = []) => {
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

const renderMoviePage = async (initialEntry: string) => {
  let result: ReturnType<typeof render> | undefined

  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path='/movie/:id' element={<MoviePage />} />
        </Routes>
      </MemoryRouter>,
    )
  })

  return result!
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('MoviePage — /movie/1, пока запрос не завершён', () => {
  it('показывает MovieDetailSkeleton, а не реальные данные', () => {
    // Хендлер, который никогда не резолвится — фиксируем состояние "запрос ушёл, ответа нет".
    server.use(http.get('*/v1.5/movie/1', () => new Promise(() => {})))
    mockImages([])

    const { container } = render(
      <MemoryRouter initialEntries={['/movie/1']}>
        <Routes>
          <Route path='/movie/:id' element={<MoviePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(container.querySelector('[class*="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByText('Orbit of Silence')).not.toBeInTheDocument()
  })
})

describe('MoviePage — /movie/1 happy path', () => {
  it('показывает реальные данные после резолва MSW, табы переключаются', async () => {
    mockMovie(1)
    mockImages([
      {
        url: 'https://example.com/frame.jpg',
        previewUrl: 'https://example.com/frame-preview.jpg',
      },
    ])

    const user = userEvent.setup()
    const result = await renderMoviePage('/movie/1')

    expect(screen.getAllByText('Orbit of Silence').length).toBeGreaterThan(0)
    expect(
      result.container.querySelector('[class*="skeleton"]'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cast' }))
    expect(screen.getByText('Liv Korhonen')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Media' }))
    expect(
      result.container.querySelector(
        'img[src="https://example.com/frame-preview.jpg"]',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText('Finland')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Overview' }))
    expect(
      screen.getAllByText('Full synopsis text about the observatory.').length,
    ).toBeGreaterThan(0)
  })
})

describe('MoviePage — /movie/666 не найден (404)', () => {
  it('рендерит ErrorState с not-found текстом и рабочей кнопкой retry (клик после cooldown повторяет запрос)', async () => {
    let requestCount = 0
    server.use(
      http.get('*/v1.5/movie/666', () => {
        requestCount++
        return HttpResponse.json(
          {
            statusCode: 404,
            message: 'Not found movie with id 666',
            error: 'Not Found',
          },
          { status: 404 },
        )
      }),
    )
    mockImages([])

    await renderMoviePage('/movie/666')

    expect(await screen.findByText('Movie not found')).toBeInTheDocument()
    expect(
      screen.getByText("This movie doesn't exist or was removed."),
    ).toBeInTheDocument()
    expect(requestCount).toBe(1)

    const retryButton = screen.getByRole('button', {
      name: 'Попробовать снова',
    })

    vi.useFakeTimers()
    try {
      // Обходим error-cooldown (20с) в createCachedFetcher, чтобы клик реально ушёл в сеть.
      await act(async () => {
        vi.advanceTimersByTime(21_000)
      })

      await act(async () => {
        fireEvent.click(retryButton)
      })
    } finally {
      vi.useRealTimers()
    }

    expect(await screen.findByText('Movie not found')).toBeInTheDocument()
    expect(requestCount).toBe(2)
  })
})

describe('MoviePage — /movie/abc (нечисловой id)', () => {
  it('рендерит not-found без единого сетевого запроса', async () => {
    // Ни один MSW-хендлер не зарегистрирован — onUnhandledRequest: 'error' завалит тест,
    // если компонент всё же попытается сделать запрос.
    await renderMoviePage('/movie/abc')

    expect(await screen.findByText('Movie not found')).toBeInTheDocument()
    expect(
      screen.getByText("This movie doesn't exist or was removed."),
    ).toBeInTheDocument()
  })
})

describe('MoviePage — /movie/-1 и /movie/1.5 (отрицательный/дробный id)', () => {
  it('отрицательный id — рендерит not-found без сетевого запроса', async () => {
    await renderMoviePage('/movie/-1')

    expect(await screen.findByText('Movie not found')).toBeInTheDocument()
  })

  it('дробный id — рендерит not-found без сетевого запроса', async () => {
    await renderMoviePage('/movie/1.5')

    expect(await screen.findByText('Movie not found')).toBeInTheDocument()
  })
})

describe('MoviePage — общая ошибка (500)', () => {
  it('рендерит общий ErrorState, текстово отличимый от not-found-варианта', async () => {
    mockMovieError(777, 500, 'Internal Server Error')
    mockImages([])

    await renderMoviePage('/movie/777')

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByText('Movie not found')).not.toBeInTheDocument()
  })
})
