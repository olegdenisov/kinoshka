import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { MovieDetail, MovieImage } from '@entities/movie'
import { MovieDesktop } from './MovieDesktop'

const MOVIE: MovieDetail = {
  id: 1,
  title: 'Orbit of Silence',
  year: 2024,
  rating: 8.4,
  type: 'movie',
  genre: ['Sci-Fi', 'Drama'],
  runtime: '2h 18m',
  hue: 18,
  poster: 'https://example.com/poster.jpg',
  tagline: "Some stories don't resolve.",
  synopsis: 'Full synopsis text about the observatory.',
  shortSynopsis: 'Short teaser synopsis.',
  trailerUrl: 'https://example.com/trailer',
  cast: [
    { id: 10, name: 'Liv Korhonen', role: 'Ines Varga', photo: 'https://example.com/liv.jpg' },
    { id: 11, name: 'Matteo Pereira', role: 'Arto Lind' },
  ],
  crew: [
    { id: 20, name: 'Hanna Vesper', profession: 'director' },
    { id: 21, name: 'Kasper Lind', profession: 'composer' },
  ],
  countries: ['Finland', 'Portugal'],
  ratingKp: 8.1,
  ratingImdb: 7.9,
  votesKp: '25k',
  criticScore: 85,
  criticReviewCount: 38,
  ageRating: 16,
  ratingMpaa: 'R',
  budget: { value: 4800000, currency: '$' },
  feesWorld: { value: 12300000, currency: '$' },
  premiereWorld: '2024-03-14',
  similarMovies: [
    { id: 2, title: 'The Quiet Archive', year: 2023, rating: 7.9, type: 'movie', genre: ['Drama'], runtime: '1h 52m', hue: 210 },
  ],
}

const IMAGES: MovieImage[] = [
  { url: 'https://example.com/frame.jpg', previewUrl: 'https://example.com/frame-preview.jpg' },
]

const renderMovieDesktop = (movie: MovieDetail = MOVIE, images: MovieImage[] = IMAGES) => (
  render(
    <MemoryRouter>
      <MovieDesktop movie={movie} images={images} />
    </MemoryRouter>,
  )
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

    expect(container.querySelector(`img[src="${IMAGES[0].previewUrl}"]`)).toBeInTheDocument()
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
