import { act, fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { server } from '../../../../test/setup'
import { HomeDesktop } from './HomeDesktop'

// Реальный retry (roadmap 1.6): рейл падает → ErrorState с Retry → клик реально бьёт
// в сеть заново (invalidateTopRatedMovies из hooks/index.ts), а не просто перерисовывает
// тот же rejected-промис из cooldown. Только TopAnimeRails (единственный рейл с уникальным
// ключом query — rating.kp + type=anime, никто другой его не делит) мокается падающим,
// чтобы у теста была ровно одна ErrorState-инстанция для клика.
const ENDPOINT = '*/v1.5/movie'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Movie',
  year: 2024,
  rating: { kp: 8.1, imdb: 7.9 },
  type: 'movie',
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  ...overrides,
})

const successResponse = (docs: Record<string, unknown>[]) =>
  HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10 })

const errorResponse = () =>
  HttpResponse.json(
    { statusCode: 500, message: 'boom', error: 'Internal Server Error' },
    { status: 500 },
  )

/** Единственный рейл с уникальным ключом query (rating.kp + type=anime) падает изначально
 * (первый запрос), остальные три рейла всегда успешны. После первого запроса TopAnimeRails
 * тоже начинает отвечать успехом — реальный второй запрос (после invalidate) его получит. */
const mockMovies = () => {
  const requestsByKind = { topAnime: 0, other: 0 }

  server.use(
    http.get(ENDPOINT, ({ request }) => {
      const url = new URL(request.url)
      const hasRatingKp = url.searchParams.has('rating.kp')
      const type = url.searchParams.get('type')

      if (hasRatingKp && type === 'anime') {
        requestsByKind.topAnime += 1
        if (requestsByKind.topAnime === 1) {
          return errorResponse()
        }
        return successResponse([doc({ id: 99, name: 'Anime Recovered' })])
      }

      requestsByKind.other += 1
      return successResponse([doc({ id: 1, name: 'Other Movie' })])
    }),
  )

  return requestsByKind
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  // HomeDesktop renders Header, whose ThemeToggle applies data-theme on
  // document.documentElement — jsdom document общий между тестами файла, сбрасываем, чтобы
  // тема, выставленная одним тестом, не утекала в следующий (см. Header.test.tsx).
  document.documentElement.removeAttribute('data-theme')
})

describe('HomeDesktop — реальный retry для рейлов', () => {
  it('рейл с ошибкой показывает ErrorState с Retry; клик реально бьёт в сеть и рендерит данные', async () => {
    const requestsByKind = mockMovies()

    await act(async () => {
      render(
        <MemoryRouter>
          <HomeDesktop />
        </MemoryRouter>,
      )
    })

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(requestsByKind.topAnime).toBe(1)

    // остальные три рейла успешны и уже отрендерили карточки
    expect(screen.getAllByText('Other Movie').length).toBeGreaterThan(0)
    expect(screen.queryByText('Anime Recovered')).not.toBeInTheDocument()

    const retryButton = screen.getByText('Попробовать снова')

    await act(async () => {
      fireEvent.click(retryButton)
    })

    // новый реальный запрос, не тот же rejected-промис
    expect(requestsByKind.topAnime).toBe(2)
    expect(screen.getByText('Anime Recovered')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('PopularMoviesRail и PersonalRails делят один ключ кэша getMovies (useTopRatedMovies() без параметров) — падают одновременно на ОДНОМ сетевом запросе; retry на одном чинит его без второго запроса; второй рейл остаётся с ошибкой, пока его retry не нажат отдельно — тогда он тоже реально восстанавливается (принятое ограничение: invalidate() безусловный, так что независимый клик на уже-свежую запись всё равно бьёт в сеть заново, см. HomeDesktop.tsx onRetry)', async () => {
    const requestsByKind = { sharedTopRated: 0, other: 0 }

    server.use(
      http.get(ENDPOINT, ({ request }) => {
        const url = new URL(request.url)
        const hasRatingKp = url.searchParams.has('rating.kp')
        const hasType = url.searchParams.has('type')

        // rating.kp без type — общий ключ PopularMoviesRail/PersonalRails
        // (invalidateTopRatedMovies() без параметров у обоих).
        if (hasRatingKp && !hasType) {
          requestsByKind.sharedTopRated += 1
          if (requestsByKind.sharedTopRated === 1) {
            return errorResponse()
          }
          return successResponse([doc({ id: 42, name: 'Shared Recovered' })])
        }

        requestsByKind.other += 1
        return successResponse([doc({ id: 1, name: 'Other Movie' })])
      }),
    )

    await act(async () => {
      render(
        <MemoryRouter>
          <HomeDesktop />
        </MemoryRouter>,
      )
    })

    // Общий кэш-ключ -> ОДИН сетевой запрос обслуживает оба рейла, оба падают
    // одновременно (доминирующий сценарий отказа из плана — общая квота 403/500).
    expect(requestsByKind.sharedTopRated).toBe(1)
    expect(screen.getAllByText('Something went wrong')).toHaveLength(2)

    const retryButtons = screen.getAllByText('Попробовать снова')
    expect(retryButtons).toHaveLength(2)

    // Клик по retry только ОДНОГО из двух рейлов.
    await act(async () => {
      fireEvent.click(retryButtons[0])
    })

    // Реальный новый запрос произошёл ровно один раз.
    expect(requestsByKind.sharedTopRated).toBe(2)
    // Один рейл восстановился; второй — независимый ErrorBoundary — всё ещё
    // показывает ошибку, пока его retry не нажат отдельно.
    expect(screen.getAllByText('Shared Recovered')).toHaveLength(1)
    expect(screen.getAllByText('Something went wrong')).toHaveLength(1)

    // Клик по retry оставшегося рейла — независимый ErrorBoundary, свой
    // onRetry/invalidate вызывается заново. invalidate() безусловно чистит
    // запись кэша (даже уже свежую/успешную — так и задумано, см.
    // createCachedFetcher.test.ts), так что это приводит к ЕЩЁ ОДНОМУ реальному
    // запросу — принятая цена за то, что каждый рейл со своим ErrorBoundary
    // восстанавливается независимо, без межинстансовой координации гварда.
    const remainingRetryButton = screen.getByText('Попробовать снова')

    await act(async () => {
      fireEvent.click(remainingRetryButton)
    })

    expect(requestsByKind.sharedTopRated).toBe(3)
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(screen.getAllByText('Shared Recovered')).toHaveLength(2)
  })

  it('без ошибок все 4 рейла рендерят данные, EmptyState/ErrorState отсутствуют', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        successResponse([doc({ id: 1, name: 'Any Movie' })]),
      ),
    )

    await act(async () => {
      render(
        <MemoryRouter>
          <HomeDesktop />
        </MemoryRouter>,
      )
    })

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(screen.getAllByText('Any Movie').length).toBeGreaterThan(0)
  })
})
