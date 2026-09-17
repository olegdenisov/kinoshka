import * as Sentry from '@sentry/react'
import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { server } from '../test/setup'
import { router } from './router'

// [review phase 1] router.tsx оборачивает createBrowserRouter через Sentry.wrapCreateBrowserRouter
// — до этого фикса ни один тест не мокал '@sentry/react', так что удаление/поломка самой обёртки
// прошла бы все тесты этого файла незамеченной (реальный wrapCreateBrowserRouter в тестовой среде
// и так возвращает функцию-аргумент без изменений, поскольку Sentry.init() здесь не вызывается —
// PROD=false — так что поведение теста было бы идентично что с оберткой, что без неё). Мокаем
// wrapCreateBrowserRouter как spy-обёртку над реальной реализацией (importOriginal) — сохраняем
// точно то же поведение (pass-through в тестовой среде), но получаем возможность проверить сам
// факт вызова и его аргумент.
vi.mock('@sentry/react', async importOriginal => {
  const actual = await importOriginal<typeof Sentry>()
  return {
    ...actual,
    wrapCreateBrowserRouter: vi.fn(actual.wrapCreateBrowserRouter),
  }
})

describe('router.tsx — Sentry.wrapCreateBrowserRouter (regression)', () => {
  it('createBrowserRouter обёрнут через Sentry.wrapCreateBrowserRouter ровно один раз', () => {
    expect(Sentry.wrapCreateBrowserRouter).toHaveBeenCalledTimes(1)
    expect(Sentry.wrapCreateBrowserRouter).toHaveBeenCalledWith(
      createBrowserRouter,
    )
  })
})

// Route-based code splitting (роадмап 2.5.3, Task 2, docs/plans/
// 20260912-performance-budgets-bundle-visualization.md): смоук-тест доказывает, что
// lazyNamed()+React.lazy() реально резолвится через настоящий `router` (createBrowserRouter),
// не только в изоляции (изоляция уже покрыта lazyNamed.test.tsx). Рендерим настоящий router
// (импорт из './router', не мок, в отличие от providers.test.tsx) в <RouterProvider> на "/" —
// это грузит JS-чанк `../pages/home` асинхронно, поэтому HomePage-контент проверяем через
// `findBy`, не `getBy`.
//
// HomePage (через Home → TopAnimeRails/PersonalRails/PopularMoviesRail) реально бьёт в
// */v1.5/movie (useTopRatedMovies/useNewMovies) и */v1.5/list/:slug (usePopularMovies) — по
// образцу Home.test.tsx. src/test/setup.ts запускает MSW с `onUnhandledRequest: 'error'`, так
// что без этих хендлеров тест упал бы по сетевой ошибке, а не по причине, связанной с code
// splitting.
const MOVIE_ENDPOINT = '*/v1.5/movie'
const LIST_ENDPOINT = '*/v1.5/list/:slug'

const successResponse = () =>
  HttpResponse.json({ docs: [], total: 0, page: 1, pages: 1, limit: 10 })

const popularListSuccessResponse = () =>
  HttpResponse.json({
    name: 'Popular',
    slug: 'popular',
    movies: {
      docs: [],
      limit: 10,
      next: null,
      prev: null,
      hasNext: false,
      hasPrev: false,
    },
  })

describe('router — реальный createBrowserRouter резолвит lazy+именованный экспорт страницы', () => {
  it('рендерит контент HomePage на "/" после асинхронной загрузки чанка', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () => successResponse()),
      http.get(LIST_ENDPOINT, () => popularListSuccessResponse()),
    )

    render(<RouterProvider router={router} />)

    // Footer рендерится безусловно в дереве Home (см. Home.test.tsx) — надёжный маркер того,
    // что настоящая HomePage (не Spinner-фоллбэк) реально смонтировалась через lazyNamed.
    expect(await screen.findByText('© 2026 Kinoshka')).toBeInTheDocument()
  })
})

// [review phase 1] Покрытие остальных 5 lazyNamed()-вызовов через настоящий router (не только
// HomePage). Найдено ревью: exportName — голый string (см. lazyNamed.ts докблок про принятый
// гэп), а тест на реальный router был только для '/'. Опечатка/переименование в любом из
// остальных 5 lazyNamed()-вызовов (router.tsx) не ловится ни `tsc`, ни существующим тестом —
// только рантайм-ошибкой "Element type is invalid" у реального пользователя. Ниже — по одному
// смоук-тесту на каждый оставшийся роут, доказывающему, что exportName реально резолвится через
// настоящий `router`, а не через изолированный мок (тот же принцип, что и '/'-тест выше).
//
// Навигация — через `router.navigate(path)` (программный API реального data-роутера), а не
// через remount с новым initialEntries (MemoryRouter) — этот файл специально тестирует именно
// `router.tsx`'s экземпляр, не его копию.
describe('router — оставшиеся 5 роутов резолвят свой lazyNamed()-экспорт', () => {
  it('/movie/:id → MoviePage', async () => {
    server.use(
      http.get('*/v1.5/movie/1', () =>
        HttpResponse.json({
          id: 1,
          name: 'Router Smoke Movie',
          year: 2024,
          type: 'movie',
          rating: { kp: 8.1, imdb: 7.9 },
          genres: [{ name: 'drama' }],
          movieLength: 120,
          poster: { previewUrl: 'https://example.com/poster.jpg' },
          persons: [],
          countries: [],
        }),
      ),
      http.get('*/v1.5/image', () =>
        HttpResponse.json({
          docs: [],
          limit: 8,
          next: null,
          prev: null,
          hasNext: false,
          hasPrev: false,
        }),
      ),
    )

    await act(async () => {
      await router.navigate('/movie/1')
    })
    render(<RouterProvider router={router} />)

    expect(
      (await screen.findAllByText('Router Smoke Movie')).length,
    ).toBeGreaterThan(0)
  })

  it('/favorites → FavoritesPage', async () => {
    // localStorage пуст (глобально чистится в afterEach, src/test/setup.ts) → EmptyState без
    // единого сетевого запроса.
    await act(async () => {
      await router.navigate('/favorites')
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('No favorites yet')).toBeInTheDocument()
  })

  it('/popular → PopularPage', async () => {
    server.use(
      http.get(LIST_ENDPOINT, () =>
        HttpResponse.json({
          name: 'Popular',
          slug: 'popular',
          movies: {
            docs: [],
            limit: 10,
            next: null,
            prev: null,
            hasNext: false,
            hasPrev: false,
          },
        }),
      ),
    )

    await act(async () => {
      await router.navigate('/popular')
    })
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByText('No popular movies right now'),
    ).toBeInTheDocument()
  })

  it('/recommendations → RecommendationsPage', async () => {
    // Пустое избранное → EmptyState с описанием, отличающим этот роут от /favorites'а
    // одноимённого заголовка ("No favorites yet") — описание уникально для Recommendations.
    await act(async () => {
      await router.navigate('/recommendations')
    })
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByText('Add movies you like to get recommendations'),
    ).toBeInTheDocument()
  })

  it('/search → SearchPage', async () => {
    // Пустой ?q → SearchResults идёт через getMoviesPage() (@entities/movie), тот же
    // MOVIE_ENDPOINT, что и рейлы Home — заголовок 'Browse catalog' рендерится безусловно,
    // независимо от результата каталога.
    server.use(http.get(MOVIE_ENDPOINT, () => successResponse()))

    await act(async () => {
      await router.navigate('/search')
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Browse catalog')).toBeInTheDocument()
  })
})
