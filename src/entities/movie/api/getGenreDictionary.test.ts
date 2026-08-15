import { ApiError } from '@shared/api'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { getGenreDictionary } from './getGenreDictionary'

const ENDPOINT = '*/v1.5/dictionary/genres'

const dictionaryItem = (
  name: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: 1,
  name,
  slug: null,
  enName: null,
  ...overrides,
})

const mockSuccess = (items: Record<string, unknown>[]) => {
  let request: Request | undefined

  server.use(
    http.get(ENDPOINT, ({ request: req }) => {
      request = req
      return HttpResponse.json({ type: 'genres', total: items.length, items })
    }),
  )

  return () => request
}

const mockError = (status: number, body: Record<string, unknown>) => {
  server.use(http.get(ENDPOINT, () => HttpResponse.json(body, { status })))
}

describe('getGenreDictionary — success', () => {
  it('запрос уходит на /v1.5/dictionary/genres', async () => {
    const getRequest = mockSuccess([dictionaryItem('драма')])

    await getGenreDictionary()

    const url = new URL(getRequest()!.url)
    expect(url.pathname).toBe('/v1.5/dictionary/genres')
  })

  it('DictionaryItemDto[] маппится в Genre[] (только name)', async () => {
    mockSuccess([
      dictionaryItem('драма', { id: 5, slug: 'drama', enName: null }),
      dictionaryItem('боевик'),
    ])

    const genres = await getGenreDictionary()

    expect(genres).toEqual([{ name: 'драма' }, { name: 'боевик' }])
  })

  it('пустой справочник — пустой массив', async () => {
    mockSuccess([])

    const genres = await getGenreDictionary()

    expect(genres).toEqual([])
  })
})

describe('getGenreDictionary — ошибка', () => {
  it('403 — реджектится ApiError, не проглатывается', async () => {
    mockError(403, {
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden',
    })

    const error = await getGenreDictionary().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(403)
  })

  it('500 — реджектится', async () => {
    mockError(500, {
      statusCode: 500,
      message: 'Internal Server Error',
      error: 'Internal Server Error',
    })

    await expect(getGenreDictionary()).rejects.toThrow()
  })
})
