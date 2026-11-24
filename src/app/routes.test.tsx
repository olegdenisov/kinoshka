import { urlAtom } from '@reatom/core'
import { matchRoutePattern, paths, ROUTE_PATTERNS } from '@shared/config'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { renderWithRouter, setTestUrl } from '../test/router'
import { server } from '../test/setup'
import { Providers } from './providers'
import { layoutRoute } from './routes'

// Страницы — заглушки: тест про сопоставление URL → страница и навигацию, а не про данные.
// Исключение — /movie/:id: реальная страница нужна для проверки сброса таба по key={id}.
vi.mock('../pages/home', () => ({
  HomePage: () => (
    <main>
      <p>Home page</p>
      <a href='/popular'>To popular</a>
    </main>
  ),
}))
vi.mock('../pages/favorites', () => ({
  FavoritesPage: () => <p>Favorites page</p>,
}))
vi.mock('../pages/watched', () => ({ WatchedPage: () => <p>Watched page</p> }))
vi.mock('../pages/watchlist', () => ({
  WatchlistPage: () => <p>Watchlist page</p>,
}))
vi.mock('../pages/popular', () => ({ PopularPage: () => <p>Popular page</p> }))
vi.mock('../pages/recommendations', () => ({
  RecommendationsPage: () => <p>Recommendations page</p>,
}))
vi.mock('../pages/search', () => ({ SearchPage: () => <p>Search page</p> }))
vi.mock('../pages/profile', () => ({ ProfilePage: () => <p>Profile page</p> }))
vi.mock('../pages/person', () => ({
  PersonPage: () => <p>Person page</p>,
}))

const movieDoc = (id: number, name: string, extra = {}) => ({
  id,
  name,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  persons: [
    { id: 10, name: 'Liv Korhonen', enProfession: 'actor', profession: '' },
  ],
  ...extra,
})

const EMPTY_IMAGES = { docs: [], limit: 8, next: null, hasNext: false }

// Рендер в await act: страница с use() приостанавливается при рендере, а синхронный act
// возобновление не дождётся (тот же приём, что в MoviePage.test.tsx).
const renderApp = async (url: string) => {
  let result: ReturnType<typeof renderWithRouter> | undefined
  await act(async () => {
    result = renderWithRouter(<Providers />, { url })
  })
  return result!
}

const childRoutes = () => Object.values(layoutRoute.routes)

afterEach(() => {
  // ThemeToggle в Header выставляет data-theme на общий document.
  document.documentElement.removeAttribute('data-theme')
  vi.restoreAllMocks()
})

describe('routes — каждый путь рендерит свою страницу', () => {
  it.each([
    [paths.home(), 'Home page'],
    [paths.favorites(), 'Favorites page'],
    [paths.watched(), 'Watched page'],
    [paths.watchlist(), 'Watchlist page'],
    [paths.popular(), 'Popular page'],
    [paths.recommendations(), 'Recommendations page'],
    [paths.search({ q: 'dune' }), 'Search page'],
    [paths.profile(), 'Profile page'],
    [paths.person(7), 'Person page'],
  ])('%s → %s', async (url, text) => {
    // Loader /person/:id уходит в сеть, даже когда страница замокана.
    server.use(
      http.get('*/v1.5/person/7', () =>
        HttpResponse.json({ id: 7, name: 'Seventh Person' }),
      ),
    )
    await renderApp(url)

    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('/movie/:id грузит фильм loader-ом роута', async () => {
    server.use(
      http.get('*/v1.5/movie/5', () =>
        HttpResponse.json(movieDoc(5, 'Fifth Movie')),
      ),
      http.get('*/v1.5/image', () => HttpResponse.json(EMPTY_IMAGES)),
    )
    await renderApp(paths.movie(5))

    // Первый заход грузит настоящий чанк страницы фильма — дольше дефолтной секунды.
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Fifth Movie' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })

  it('неизвестный путь → NotFound со ссылкой на главную, chrome на месте', async () => {
    await renderApp('/no-such-page')

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('/movie/1/extra (лишний сегмент) — тоже NotFound', async () => {
    await renderApp('/movie/1/extra')

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})

describe('routes — шаблоны совпадают с @shared/config', () => {
  it('шаблоны роутов — ровно ROUTE_PATTERNS', () => {
    expect(
      childRoutes()
        .map(route => route.pattern)
        .sort(),
    ).toEqual([...ROUTE_PATTERNS].sort())
  })

  it.each([
    [paths.home(), '/'],
    [paths.movie(1), '/movie/:id'],
    [paths.person(2), '/person/:id'],
    [paths.favorites(), '/favorites'],
    [paths.watched(), '/watched'],
    [paths.watchlist(), '/watchlist'],
    [paths.popular(), '/popular'],
    [paths.recommendations(), '/recommendations'],
    [paths.search({ q: 'x' }), '/search'],
    [paths.profile(), '/profile'],
  ])('%s точно матчит роут %s и matchRoutePattern', (url, pattern) => {
    setTestUrl(url)

    const exact = childRoutes().filter(route => route.exact())
    expect(exact.map(route => route.pattern)).toEqual([pattern])
    expect(matchRoutePattern(new URL(url, location.origin).pathname)).toBe(
      pattern,
    )
  })
})

describe('routes — навигация', () => {
  it('клик по <a> меняет страницу без перезагрузки; дерево из Providers перерисовывается', async () => {
    await renderApp('/')
    await screen.findByText('Home page')
    const push = vi.spyOn(window.history, 'pushState')

    const link = screen.getByRole('link', { name: 'To popular' })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    await act(async () => link.dispatchEvent(click))

    // preventDefault — признак перехвата: без него браузер ушёл бы на полную загрузку.
    expect(click.defaultPrevented).toBe(true)
    expect(push).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Popular page')).toBeInTheDocument()
    expect(screen.queryByText('Home page')).not.toBeInTheDocument()
  })

  it('urlAtom.go перерисовывает страницу', async () => {
    await renderApp('/')
    await screen.findByText('Home page')

    await act(async () => urlAtom.go(paths.profile()))

    expect(await screen.findByText('Profile page')).toBeInTheDocument()
  })

  it('history.back() возвращает предыдущую страницу', async () => {
    await renderApp('/')
    await screen.findByText('Home page')

    await act(async () =>
      fireEvent.click(screen.getByRole('link', { name: 'To popular' })),
    )
    expect(await screen.findByText('Popular page')).toBeInTheDocument()

    await act(async () => window.history.back())

    expect(await screen.findByText('Home page')).toBeInTheDocument()
    expect(urlAtom().pathname).toBe('/')
  })
})

describe('routes — /movie/:id → /movie/:id', () => {
  it('переход по ссылке из Similar titles открывает другой фильм и сбрасывает таб (key={id})', async () => {
    server.use(
      http.get('*/v1.5/movie/1', () =>
        HttpResponse.json(
          movieDoc(1, 'Orbit of Silence', {
            similarMovies: [
              { id: 2, name: 'Second Movie', year: 2023, type: 'movie' },
            ],
          }),
        ),
      ),
      http.get('*/v1.5/movie/2', () =>
        HttpResponse.json(movieDoc(2, 'Second Movie')),
      ),
      http.get('*/v1.5/image', () => HttpResponse.json(EMPTY_IMAGES)),
    )
    const user = userEvent.setup()
    const { container } = await renderApp(paths.movie(1))

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Orbit of Silence' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cast' }))
    expect(
      container.querySelector('[class*="tabBtnActive"]'),
    ).toHaveTextContent('Cast')

    await user.click(screen.getByRole('link', { name: 'Second Movie' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Second Movie' }),
    ).toBeInTheDocument()
    expect(urlAtom().pathname).toBe('/movie/2')
    expect(
      container.querySelector('[class*="tabBtnActive"]'),
    ).toHaveTextContent('Overview')
  })
})
