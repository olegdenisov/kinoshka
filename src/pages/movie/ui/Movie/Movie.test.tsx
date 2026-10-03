import type { MovieDetail, MovieImage } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { readPersisted } from '../../../../test/persist'
import { MOVIE, MOVIE_NO_OPTIONALS, IMAGES } from '../../testFixtures'
import { Movie } from './Movie'

// Слияние MovieDesktop.test.tsx/MovieMobile.test.tsx (Task 9 плана
// docs/plans/20260827-mobile-first-adaptive-layout.md): оба набора тестов проверяли один и тот
// же контент (MovieHero + ui/tabs/* + RelatedMovies) — до этой задачи MovieMobile.tsx инлайнил
// собственную копию вёрстки табов вместо переиспользования ui/tabs/*, поэтому тесты дублировались
// почти дословно. Movie больше не рендерит Header/MobileHeader сам (chrome — забота AppLayout,
// см. src/app/layouts/AppLayout.tsx), поэтому здесь не нужен afterEach-сброс data-theme, который
// был в обоих старых наборах тестов из-за безусловно смонтированного ThemeToggle внутри
// Header/MobileHeader.
const renderMovie = (
  movie: MovieDetail = MOVIE,
  images: MovieImage[] = IMAGES,
) =>
  render(
    <MemoryRouter>
      <Movie movie={movie} images={images} />
    </MemoryRouter>,
  )

beforeEach(() => localStorage.clear())

describe('Movie — Overview (дефолтный таб)', () => {
  it('показывает tagline, синопсис-тизер, рейтинги и жанры из movie', () => {
    renderMovie()

    expect(screen.getByText(MOVIE.tagline)).toBeInTheDocument()
    expect(screen.getByText(MOVIE.shortSynopsis!)).toBeInTheDocument()
    expect(screen.getByText('25k votes')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('показывает синопсис, жанры, crew, страны и рейтинги в самом табе', () => {
    renderMovie()

    expect(screen.getByText(MOVIE.synopsis)).toBeInTheDocument()
    expect(screen.getByText('Hanna Vesper')).toBeInTheDocument()
    expect(screen.getByText('director')).toBeInTheDocument()
    expect(screen.getByText('Finland · Portugal')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
  })
})

describe('Movie — Cast', () => {
  it('показывает имя/роль каждого cast-члена', async () => {
    const user = userEvent.setup()
    renderMovie()

    await user.click(screen.getByRole('button', { name: 'Cast' }))

    expect(screen.getByText('Liv Korhonen')).toBeInTheDocument()
    expect(screen.getByText('as Ines Varga')).toBeInTheDocument()
    expect(screen.getByText('Matteo Pereira')).toBeInTheDocument()
  })
})

describe('Movie — Media', () => {
  it('показывает скриншот из images, когда он есть', async () => {
    const user = userEvent.setup()
    const { container } = renderMovie()

    await user.click(screen.getByRole('button', { name: 'Media' }))

    expect(
      container.querySelector(`img[src="${IMAGES[0].previewUrl}"]`),
    ).toBeInTheDocument()
  })
})

describe('Movie — Details', () => {
  it('показывает дату премьеры, страну, возрастной рейтинг и бюджет через formatCurrency', async () => {
    const user = userEvent.setup()
    renderMovie()

    await user.click(screen.getByRole('button', { name: 'Details' }))

    expect(screen.getByText('March 14, 2024')).toBeInTheDocument()
    expect(screen.getByText('16+')).toBeInTheDocument()
    expect(screen.getByText('4,800,000 $')).toBeInTheDocument()
    expect(screen.getByText('12,300,000 $')).toBeInTheDocument()
  })
})

describe('Movie — RelatedMovies', () => {
  it('рендерит похожие фильмы из movie.similarMovies', () => {
    renderMovie()

    expect(screen.getAllByText('The Quiet Archive').length).toBeGreaterThan(0)
  })

  it('скрывает секцию, когда similarMovies пуст', () => {
    renderMovie({ ...MOVIE, similarMovies: [] })

    expect(screen.queryByText('Similar titles')).not.toBeInTheDocument()
  })

  it('клик по сердечку карточки похожего фильма пишет его id в localStorage', async () => {
    localStorage.clear()
    const user = userEvent.setup()
    renderMovie()

    await user.click(
      screen.getAllByRole('button', { name: 'Add to favorites' })[0],
    )

    expect(readPersisted('kinoshka:favorites')).toEqual([
      MOVIE.similarMovies[0].id,
    ])
  })
})

describe('Movie — Watched', () => {
  const watchedButton = () => screen.getByRole('button', { name: 'Watched' })

  it('по умолчанию не нажата', () => {
    renderMovie()

    expect(watchedButton()).toHaveAttribute('aria-pressed', 'false')
  })

  it('предустановленный id в storage → нажата с первого рендера', () => {
    localStorage.setItem('kinoshka:watched', JSON.stringify([MOVIE.id]))
    renderMovie()

    expect(watchedButton()).toHaveAttribute('aria-pressed', 'true')
  })

  it('клик добавляет id в kinoshka:watched, повторный клик убирает', async () => {
    const user = userEvent.setup()
    renderMovie()

    await user.click(watchedButton())

    expect(watchedButton()).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('kinoshka:watched')).toBe(`[${MOVIE.id}]`)

    await user.click(watchedButton())

    expect(watchedButton()).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('kinoshka:watched')).toBe('[]')
  })

  it('состояние переживает перемонтирование страницы', async () => {
    const user = userEvent.setup()
    const { unmount } = renderMovie()

    await user.click(watchedButton())
    unmount()
    renderMovie()

    expect(watchedButton()).toHaveAttribute('aria-pressed', 'true')
  })

  it('остальные кнопки работают независимо от Watched', async () => {
    const user = userEvent.setup()
    renderMovie()

    await user.click(screen.getByRole('button', { name: 'Favorite' }))
    await user.click(screen.getByRole('button', { name: 'Watchlist' }))

    expect(screen.getByRole('button', { name: 'Favorite' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Watchlist' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(watchedButton()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Share' })).not.toHaveAttribute(
      'aria-pressed',
    )
  })
})

describe('Movie — Watchlist', () => {
  const watchlistButton = () =>
    screen.getByRole('button', { name: 'Watchlist' })
  const watchedButton = () => screen.getByRole('button', { name: 'Watched' })

  it('по умолчанию не нажата', () => {
    renderMovie()

    expect(watchlistButton()).toHaveAttribute('aria-pressed', 'false')
  })

  it('клик добавляет id в kinoshka:watchlist, повторный клик убирает', async () => {
    const user = userEvent.setup()
    renderMovie()

    await user.click(watchlistButton())

    expect(watchlistButton()).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('kinoshka:watchlist')).toBe(`[${MOVIE.id}]`)

    await user.click(watchlistButton())

    expect(watchlistButton()).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('kinoshka:watchlist')).toBe('[]')
  })

  it('состояние переживает перемонтирование страницы', async () => {
    const user = userEvent.setup()
    const { unmount } = renderMovie()

    await user.click(watchlistButton())
    unmount()
    renderMovie()

    expect(watchlistButton()).toHaveAttribute('aria-pressed', 'true')
  })

  it('Watched не меняет watchlist и наоборот', async () => {
    const user = userEvent.setup()
    renderMovie()

    await user.click(watchedButton())

    expect(watchlistButton()).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('kinoshka:watchlist')).toBeNull()

    await user.click(watchlistButton())
    await user.click(watchedButton())

    expect(watchedButton()).toHaveAttribute('aria-pressed', 'false')
    expect(watchlistButton()).toHaveAttribute('aria-pressed', 'true')
  })

  it('просмотренный тайтл можно добавить в watchlist', async () => {
    localStorage.setItem('kinoshka:watched', JSON.stringify([MOVIE.id]))
    const user = userEvent.setup()
    renderMovie()

    await user.click(watchlistButton())

    expect(watchedButton()).toHaveAttribute('aria-pressed', 'true')
    expect(watchlistButton()).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('kinoshka:watched')).toBe(`[${MOVIE.id}]`)
  })
})

describe('Movie — фон героя', () => {
  it('фон героя — только градиент, без фото-бэкдропа (оно мешало читать текст)', () => {
    const { container } = renderMovie()

    expect(
      container.querySelector('[class*="backdropGradient"]'),
    ).not.toBeNull()
    expect(container.querySelector('[class*="backdropImage"]')).toBeNull()
    expect(container.querySelector('[style*="url("]')).toBeNull()
  })
})

describe('Movie — fallback-ветки при отсутствующих опциональных полях', () => {
  it('Hero: votesKp/criticScore отсутствуют — рейтинги "—", кнопка трейлера скрыта', () => {
    renderMovie(MOVIE_NO_OPTIONALS, [])

    expect(screen.getByText('— votes')).toBeInTheDocument()
    expect(screen.getByText('— reviews')).toBeInTheDocument()
    // Critics-блок (criticScore undefined) добавляет второе "—" рядом с всегда-"—" Your rating.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.queryByRole('link', { name: /trailer/i }),
    ).not.toBeInTheDocument()
  })

  it('Overview: countries/ratingKp/ratingImdb/ratingMpaa отсутствуют — рендерит "—" вместо значений', async () => {
    const user = userEvent.setup()
    renderMovie(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Overview' }))

    // Countries + Kinopoisk + IMDb + MPAA — 4 отдельных "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('Details: premiereWorld/countries/ratingMpaa/ageRating/budget/feesWorld отсутствуют — все "—"', async () => {
    const user = userEvent.setup()
    renderMovie(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Details' }))

    // Release date, Country, MPAA rating, Age rating, Budget, Box office — 6 отдельных "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6)
  })

  it('Media: images пуст и trailerUrl отсутствует — секции Trailer и Screenshots скрыты целиком', async () => {
    const user = userEvent.setup()
    const { container } = renderMovie(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Media' }))

    expect(screen.queryByText('Trailer')).not.toBeInTheDocument()
    expect(screen.queryByText('Screenshots')).not.toBeInTheDocument()
    expect(container.querySelectorAll('img').length).toBe(0)
  })
})
