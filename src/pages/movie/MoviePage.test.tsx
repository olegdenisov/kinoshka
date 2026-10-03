import { urlAtom } from '@reatom/core'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { Providers } from '../../app/providers'
import { renderWithRouter } from '../../test/router'
import { server } from '../../test/setup'

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

// Страница рендерится через роут (loader создаёт роут, а не страница). Первый заход грузит
// lazy-чанк страницы — отсюда увеличенные таймауты findBy*.
const renderMoviePage = async (initialEntry: string) => {
  let result: ReturnType<typeof renderWithRouter> | undefined

  await act(async () => {
    result = renderWithRouter(<Providers />, { url: initialEntry })
  })

  return result!
}

const FIRST_LOAD = { timeout: 5000 }

describe('MoviePage — /movie/1, пока запрос не завершён', () => {
  it('показывает MovieDetailSkeleton, а не реальные данные', async () => {
    // Хендлер, который никогда не резолвится — фиксируем состояние "запрос ушёл, ответа нет".
    server.use(http.get('*/v1.5/movie/1', () => new Promise(() => {})))
    mockImages([])

    const { container } = await renderMoviePage('/movie/1')

    await waitFor(
      () =>
        expect(
          container.querySelector('[class*="skeleton"]'),
        ).toBeInTheDocument(),
      FIRST_LOAD,
    )
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

    expect(
      (await screen.findAllByText('Orbit of Silence', {}, FIRST_LOAD)).length,
    ).toBeGreaterThan(0)
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

  it('отказ запроса картинок не ломает страницу', async () => {
    mockMovie(1)
    server.use(
      http.get('*/v1.5/image', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'boom', error: 'error' },
          { status: 500 },
        ),
      ),
    )

    await renderMoviePage('/movie/1')

    expect(
      (await screen.findAllByText('Orbit of Silence', {}, FIRST_LOAD)).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})

describe('MoviePage — /movie/666 не найден (404)', () => {
  it('рендерит ErrorState с not-found текстом и рабочей кнопкой retry', async () => {
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

    expect(
      await screen.findByText('Movie not found', {}, FIRST_LOAD),
    ).toBeInTheDocument()
    expect(
      screen.getByText("This movie doesn't exist or was removed."),
    ).toBeInTheDocument()
    expect(requestCount).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    })

    expect(await screen.findByText('Movie not found')).toBeInTheDocument()
    expect(requestCount).toBe(2)
  })
})

describe('MoviePage — /movie/888 общая ошибка → Retry', () => {
  it('клик Retry делает реальный повторный запрос, рендерит данные', async () => {
    let requestCount = 0
    server.use(
      http.get('*/v1.5/movie/888', () => {
        requestCount++
        return HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'error' },
          { status: 500 },
        )
      }),
    )
    mockImages([])

    await renderMoviePage('/movie/888')

    expect(
      await screen.findByText('Something went wrong', {}, FIRST_LOAD),
    ).toBeInTheDocument()
    expect(requestCount).toBe(1)

    server.use(
      http.get('*/v1.5/movie/888', () => {
        requestCount++
        return HttpResponse.json(movieDoc(888, { name: 'Recovered Movie' }))
      }),
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    })

    expect(
      (await screen.findAllByText('Recovered Movie')).length,
    ).toBeGreaterThan(0)
    expect(requestCount).toBe(2)
  })

  it('повторный заход на упавший роут шлёт ровно один запрос', async () => {
    let requestCount = 0
    server.use(
      http.get('*/v1.5/movie/889', () => {
        requestCount++
        return HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'error' },
          { status: 500 },
        )
      }),
    )
    mockImages([])

    await renderMoviePage('/movie/889')
    await screen.findByText('Something went wrong', {}, FIRST_LOAD)
    expect(requestCount).toBe(1)

    await act(async () => urlAtom.go('/popular'))
    await act(async () => urlAtom.go('/movie/889'))

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(requestCount).toBe(2)
  })
})

describe('MoviePage — невалидный id', () => {
  it.each(['abc', '-1', '1.5', '0'])(
    '/movie/%s рендерит not-found без сетевого запроса',
    async raw => {
      // Ни один MSW-хендлер не зарегистрирован — onUnhandledRequest: 'error' завалит тест.
      await renderMoviePage(`/movie/${raw}`)

      expect(
        await screen.findByText('Movie not found', {}, FIRST_LOAD),
      ).toBeInTheDocument()
      expect(
        screen.getByText("This movie doesn't exist or was removed."),
      ).toBeInTheDocument()
    },
  )
})

describe('MoviePage — переходы между фильмами', () => {
  it('/movie/1 → /movie/2 показывает скелетон, а не фильм 1', async () => {
    mockMovie(1)
    server.use(http.get('*/v1.5/movie/2', () => new Promise(() => {})))
    mockImages([])

    const { container } = await renderMoviePage('/movie/1')
    expect(
      (await screen.findAllByText('Orbit of Silence', {}, FIRST_LOAD)).length,
    ).toBeGreaterThan(0)

    await act(async () => urlAtom.go('/movie/2'))

    await waitFor(() =>
      expect(
        container.querySelector('[class*="skeleton"]'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('Orbit of Silence')).not.toBeInTheDocument()
  })

  it('возврат на уже открытый фильм не шлёт запрос', async () => {
    let movie1Requests = 0
    server.use(
      http.get('*/v1.5/movie/1', () => {
        movie1Requests++
        return HttpResponse.json(movieDoc(1))
      }),
    )
    mockMovie(2, { name: 'Second Movie' })
    mockImages([])

    await renderMoviePage('/movie/1')
    await screen.findAllByText('Orbit of Silence', {}, FIRST_LOAD)

    await act(async () => urlAtom.go('/movie/2'))
    expect((await screen.findAllByText('Second Movie')).length).toBeGreaterThan(
      0,
    )
    await act(async () => urlAtom.go('/movie/1'))

    expect(
      (await screen.findAllByText('Orbit of Silence')).length,
    ).toBeGreaterThan(0)
    expect(movie1Requests).toBe(1)
  })

  it('ссылка из Similar titles ведёт на страницу другого фильма', async () => {
    mockMovie(1, {
      similarMovies: [
        { id: 2, name: 'Second Movie', year: 2023, type: 'movie' },
      ],
    })
    mockMovie(2, { name: 'Second Movie' })
    mockImages([])

    const user = userEvent.setup()
    await renderMoviePage('/movie/1')
    await screen.findAllByText('Orbit of Silence', {}, FIRST_LOAD)

    await user.click(screen.getByRole('button', { name: 'Cast' }))

    expect(screen.getByRole('link', { name: 'Second Movie' })).toHaveAttribute(
      'href',
      '/movie/2',
    )
  })
})
