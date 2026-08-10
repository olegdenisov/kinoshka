import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'
import { getMovieImages } from './getMovieImages'

const ENDPOINT = '*/v1.5/image'

const image = (overrides: Record<string, unknown> = {}) => ({
  movieId: 1,
  type: 'frame',
  url: 'https://example.com/frame.jpg',
  previewUrl: 'https://example.com/frame-preview.jpg',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const mockSuccess = (docs: Record<string, unknown>[]) => {
  let request: Request | undefined

  server.use(
    http.get(ENDPOINT, ({ request: req }) => {
      request = req
      return HttpResponse.json({
        docs,
        limit: 8,
        next: null,
        prev: null,
        hasNext: false,
        hasPrev: false,
      })
    }),
  )

  return () => request
}

const mockForbidden = () => {
  server.use(
    http.get(ENDPOINT, () =>
      HttpResponse.json(
        { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
        { status: 403 },
      ),
    ),
  )
}

describe('getMovieImages — запрос', () => {
  it('уходит на /v1.5/image с movieId, type:[frame,screenshot], limit:8, selectFields', async () => {
    const getRequest = mockSuccess([image()])

    await getMovieImages(1)

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.getAll('movieId')).toEqual(['1'])
    expect(url.searchParams.getAll('type')).toEqual(['frame', 'screenshot'])
    expect(url.searchParams.get('limit')).toBe('8')
    expect(url.searchParams.getAll('selectFields')).toEqual(['url', 'previewUrl'])
  })

  it('403 — промис реджектится (isError-cooldown в фабрике)', async () => {
    mockForbidden()

    await expect(getMovieImages(2)).rejects.toThrow()
  })

  it('стабильный промис на один и тот же id', async () => {
    mockSuccess([image()])

    const first = getMovieImages(3)
    const second = getMovieImages(3)

    expect(first).toBe(second)
    await first
  })
})

describe('getMovieImages — форма результата MovieImage[]', () => {
  it('docs маппятся в { url, previewUrl }', async () => {
    mockSuccess([
      image({
        url: 'https://example.com/a.jpg',
        previewUrl: 'https://example.com/a-preview.jpg',
      }),
    ])

    const images = await getMovieImages(4)

    expect(images).toEqual([
      {
        url: 'https://example.com/a.jpg',
        previewUrl: 'https://example.com/a-preview.jpg',
      },
    ])
  })

  it('previewUrl отсутствует — previewUrl undefined', async () => {
    mockSuccess([image({ previewUrl: undefined })])

    const [result] = await getMovieImages(5)

    expect(result.previewUrl).toBeUndefined()
  })

  it('запись с пустым url отфильтровывается', async () => {
    mockSuccess([image({ url: undefined }), image({ url: 'https://example.com/b.jpg' })])

    const images = await getMovieImages(6)

    expect(images).toEqual([
      {
        url: 'https://example.com/b.jpg',
        previewUrl: 'https://example.com/frame-preview.jpg',
      },
    ])
  })

  it('пустой docs — пустой массив', async () => {
    mockSuccess([])

    const images = await getMovieImages(7)

    expect(images).toEqual([])
  })
})
