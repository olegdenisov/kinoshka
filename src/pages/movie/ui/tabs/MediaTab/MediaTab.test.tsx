import type { MovieDetail, MovieImage } from '@entities/movie'
import { render, screen } from '@testing-library/react'

import { MOVIE } from '../../../testFixtures'
import { MediaTab } from './MediaTab'

// Общая фикстура MovieDetail — тот же контракт, что в остальных тестах страницы movie.
const MOVIE_DETAIL: MovieDetail = MOVIE

const makeImage = (overrides: Partial<MovieImage> = {}): MovieImage => ({
  url: 'https://example.com/screenshot.jpg',
  previewUrl: 'https://example.com/preview.jpg',
  ...overrides,
})

describe('MediaTab', () => {
  it('рендерит блок Trailer, когда есть trailerUrl', () => {
    render(<MediaTab m={MOVIE_DETAIL} images={[]} />)

    expect(screen.getByText('Trailer')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      MOVIE_DETAIL.trailerUrl,
    )
  })

  it('не рендерит блок Trailer, когда нет trailerUrl', () => {
    const { container } = render(
      <MediaTab
        m={{ ...MOVIE_DETAIL, trailerUrl: undefined }}
        images={[makeImage()]}
      />,
    )

    expect(screen.queryByText('Trailer')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    // Остальной контент при этом рендерится — тест не проходит на пустом компоненте.
    expect(screen.getByText('Screenshots')).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('рендерит скриншоты с loading=lazy и decoding=async, когда images не пусто', () => {
    const images = [
      makeImage({ url: 'url1.jpg', previewUrl: 'preview1.jpg' }),
      makeImage({ url: 'url2.jpg', previewUrl: 'preview2.jpg' }),
    ]
    const { container } = render(<MediaTab m={MOVIE_DETAIL} images={images} />)

    const screenshotImgs = container.querySelectorAll('img')
    expect(screenshotImgs).toHaveLength(2)

    screenshotImgs.forEach(img => {
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('decoding', 'async')
    })
  })

  it('использует previewUrl, когда он есть; иначе используется url', () => {
    const images = [
      makeImage({ url: 'full.jpg', previewUrl: 'preview.jpg' }),
      makeImage({ url: 'only-full.jpg', previewUrl: undefined }),
    ]
    const { container } = render(<MediaTab m={MOVIE_DETAIL} images={images} />)

    const screenshotImgs = container.querySelectorAll('img')
    expect(screenshotImgs[0]).toHaveAttribute('src', 'preview.jpg')
    expect(screenshotImgs[1]).toHaveAttribute('src', 'only-full.jpg')
  })

  it('не рендерит блок Screenshots, когда images пусто', () => {
    const { container } = render(<MediaTab m={MOVIE_DETAIL} images={[]} />)

    expect(screen.queryByText('Screenshots')).not.toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })
})
