import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { MovieDetail, MovieImage } from '@entities/movie'
import { MOVIE, MOVIE_NO_OPTIONALS, IMAGES } from '../../testFixtures'
import { MovieDesktop } from './MovieDesktop'

const renderMovieDesktop = (
  movie: MovieDetail = MOVIE,
  images: MovieImage[] = IMAGES,
) =>
  render(
    <MemoryRouter>
      <MovieDesktop movie={movie} images={images} />
    </MemoryRouter>,
  )

describe('MovieDesktop — Overview (дефолтный таб)', () => {
  it('показывает tagline, синопсис-тизер, рейтинги и жанры из movie', () => {
    renderMovieDesktop()

    expect(screen.getByText(MOVIE.tagline)).toBeInTheDocument()
    expect(screen.getByText(MOVIE.shortSynopsis!)).toBeInTheDocument()
    expect(screen.getByText('25k votes')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('показывает синопсис, жанры, crew, страны и рейтинги в самом табе', () => {
    renderMovieDesktop()

    expect(screen.getByText(MOVIE.synopsis)).toBeInTheDocument()
    expect(screen.getByText('Hanna Vesper')).toBeInTheDocument()
    expect(screen.getByText('director')).toBeInTheDocument()
    expect(screen.getByText('Finland · Portugal')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
  })
})

describe('MovieDesktop — Cast', () => {
  it('показывает имя/роль каждого cast-члена', async () => {
    const user = userEvent.setup()
    renderMovieDesktop()

    await user.click(screen.getByRole('button', { name: 'Cast' }))

    expect(screen.getByText('Liv Korhonen')).toBeInTheDocument()
    expect(screen.getByText('as Ines Varga')).toBeInTheDocument()
    expect(screen.getByText('Matteo Pereira')).toBeInTheDocument()
  })
})

describe('MovieDesktop — Media', () => {
  it('показывает скриншот из images, когда он есть', async () => {
    const user = userEvent.setup()
    const { container } = renderMovieDesktop()

    await user.click(screen.getByRole('button', { name: 'Media' }))

    expect(
      container.querySelector(`img[src="${IMAGES[0].previewUrl}"]`),
    ).toBeInTheDocument()
  })
})

describe('MovieDesktop — Details', () => {
  it('показывает дату премьеры, страну, возрастной рейтинг и бюджет через formatCurrency', async () => {
    const user = userEvent.setup()
    renderMovieDesktop()

    await user.click(screen.getByRole('button', { name: 'Details' }))

    expect(screen.getByText('2024-03-14')).toBeInTheDocument()
    expect(screen.getByText('16+')).toBeInTheDocument()
    expect(screen.getByText('4,800,000 $')).toBeInTheDocument()
    expect(screen.getByText('12,300,000 $')).toBeInTheDocument()
  })
})

describe('MovieDesktop — RelatedMovies', () => {
  it('рендерит похожие фильмы из movie.similarMovies', () => {
    renderMovieDesktop()

    expect(screen.getAllByText('The Quiet Archive').length).toBeGreaterThan(0)
  })

  it('скрывает секцию, когда similarMovies пуст', () => {
    renderMovieDesktop({ ...MOVIE, similarMovies: [] })

    expect(screen.queryByText('Similar titles')).not.toBeInTheDocument()
  })
})

describe('MovieDesktop — fallback-ветки при отсутствующих опциональных полях', () => {
  it('Hero: votesKp/criticScore отсутствуют — рейтинги "—", кнопка трейлера скрыта', () => {
    renderMovieDesktop(MOVIE_NO_OPTIONALS, [])

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
    renderMovieDesktop(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Overview' }))

    // Countries + Kinopoisk + IMDb + MPAA — 4 отдельных "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('Details: premiereWorld/countries/ratingMpaa/ageRating/budget/feesWorld отсутствуют — все "—"', async () => {
    const user = userEvent.setup()
    renderMovieDesktop(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Details' }))

    // Release date, Country, MPAA rating, Age rating, Budget, Box office — 6 отдельных "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6)
  })

  it('Media: images пуст — рендерит градиентный fallback вместо <img>, кнопка трейлера задизейблена', async () => {
    const user = userEvent.setup()
    const { container } = renderMovieDesktop(MOVIE_NO_OPTIONALS, [])

    await user.click(screen.getByRole('button', { name: 'Media' }))

    expect(container.querySelectorAll('img').length).toBe(0)
    expect(container.querySelector('button:disabled')).toBeInTheDocument()
  })
})
