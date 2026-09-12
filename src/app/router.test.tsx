import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider } from 'react-router/dom'

import { server } from '../test/setup'
import { router } from './router'

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
