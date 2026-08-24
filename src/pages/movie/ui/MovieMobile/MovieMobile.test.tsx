import type { MovieDetail, MovieImage } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { MOVIE, MOVIE_NO_OPTIONALS, IMAGES } from '../../testFixtures'
import { MovieMobile } from './MovieMobile'

const renderMovieMobile = (
  movie: MovieDetail = MOVIE,
  images: MovieImage[] = IMAGES,
) =>
  render(
    <MemoryRouter>
      <MovieMobile movie={movie} images={images} />
    </MemoryRouter>,
  )

// MovieMobile безусловно монтирует MobileHeader → ThemeToggle, который выставляет data-theme на
// document.documentElement — сбрасываем, чтобы значение не утекало в следующий тест (см.
// useTheme.test.tsx).
afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('MovieMobile — hero', () => {
  it('показывает tagline и рейтинги из movie', () => {
    renderMovieMobile()

    expect(screen.getByText(MOVIE.tagline)).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })
})

describe('MovieMobile — Overview (дефолтный таб)', () => {
  it('показывает синопсис, crew, страны и рейтинги', () => {
    renderMovieMobile()

    expect(screen.getByText(MOVIE.synopsis)).toBeInTheDocument()
    expect(screen.getByText('Hanna Vesper')).toBeInTheDocument()
    expect(screen.getByText('director')).toBeInTheDocument()
    expect(screen.getByText('Finland · Portugal')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
  })
})

describe('MovieMobile — Cast', () => {
  it('показывает имя/роль каждого cast-члена', async () => {
    const user = userEvent.setup()
    renderMovieMobile()

    await user.click(screen.getByRole('button', { name: 'Cast' }))

    expect(screen.getByText('Liv Korhonen')).toBeInTheDocument()
    expect(screen.getByText('as Ines Varga')).toBeInTheDocument()
    expect(screen.getByText('Matteo Pereira')).toBeInTheDocument()
  })
})

describe('MovieMobile — Media', () => {
  it('показывает скриншот из images, когда он есть', async () => {
    const user = userEvent.setup()
    const { container } = renderMovieMobile()

    await user.click(screen.getByRole('button', { name: 'Media' }))

    expect(
      container.querySelector(`img[src="${IMAGES[0].previewUrl}"]`),
    ).toBeInTheDocument()
  })
})

describe('MovieMobile — Details', () => {
  it('показывает дату премьеры, возрастной рейтинг и бюджет через formatCurrency', async () => {
    const user = userEvent.setup()
    renderMovieMobile()

    await user.click(screen.getByRole('button', { name: 'Details' }))

    expect(screen.getByText('March 14, 2024')).toBeInTheDocument()
    expect(screen.getByText('16+')).toBeInTheDocument()
    expect(screen.getByText('4,800,000 $')).toBeInTheDocument()
    expect(screen.getByText('12,300,000 $')).toBeInTheDocument()
  })
})

describe('MovieMobile — Similar titles', () => {
  it('рендерит похожие фильмы из movie.similarMovies', () => {
    renderMovieMobile()

    expect(screen.getAllByText('The Quiet Archive').length).toBeGreaterThan(0)
  })

  it('скрывает секцию, когда similarMovies пуст', () => {
    renderMovieMobile({ ...MOVIE, similarMovies: [] })

    expect(screen.queryByText('Similar titles')).not.toBeInTheDocument()
  })
})

describe('MovieMobile — избранное в related-секции', () => {
  beforeEach(() => localStorage.clear())

  it('клик по сердечку карточки похожего фильма пишет его id в localStorage', async () => {
    const user = userEvent.setup()
    renderMovieMobile()

    await user.click(
      screen.getAllByRole('button', { name: 'Add to favorites' })[0],
    )

    expect(localStorage.getItem('kinoshka:favorites')).toBe(
      `[${MOVIE.similarMovies[0].id}]`,
    )
  })
})

describe('MovieMobile — fallback-ветки при отсутствующих опциональных полях', () => {
  it('hero: criticScore отсутствует — рейтинг "—"', () => {
    renderMovieMobile(MOVIE_NO_OPTIONALS, [])

    // Critics-блок (criticScore undefined) добавляет второе "—" рядом с всегда-"—" Yours.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('Overview: countries/ratingKp/ratingImdb/ratingMpaa отсутствуют — рендерит "—" вместо значений', async () => {
    const user = userEvent.setup()
    renderMovieMobile(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Overview' }))

    // Countries + Kinopoisk + IMDb + MPAA — 4 отдельных "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('Details: premiereWorld/countries/ratingMpaa/ageRating/budget/feesWorld отсутствуют — все "—"', async () => {
    const user = userEvent.setup()
    renderMovieMobile(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Details' }))

    // Release date, Country, MPAA rating, Age rating, Budget, Box office — 6 отдельных "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6)
  })

  it('Media: images пуст — рендерит градиентный fallback вместо <img>, кнопка трейлера задизейблена', async () => {
    const user = userEvent.setup()
    const { container } = renderMovieMobile(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Media' }))

    expect(container.querySelectorAll('img').length).toBe(0)
    expect(container.querySelector('button:disabled')).toBeInTheDocument()
  })
})
