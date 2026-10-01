import { ApiError } from '@shared/api'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { getCountryDictionary } from './getCountryDictionary'

const ENDPOINT = '*/v1.5/dictionary/countries'

describe('getCountryDictionary — success', () => {
  it('запрос уходит на /v1.5/dictionary/countries и отдаёт имена', async () => {
    let request: Request | undefined
    server.use(
      http.get(ENDPOINT, ({ request: req }) => {
        request = req
        return HttpResponse.json({
          type: 'countries',
          total: 2,
          items: [
            { id: 1, name: 'США', slug: null, enName: null },
            { id: 2, name: 'Франция', slug: null, enName: null },
          ],
        })
      }),
    )

    const countries = await getCountryDictionary()

    expect(new URL(request!.url).pathname).toBe('/v1.5/dictionary/countries')
    expect(countries).toEqual(['США', 'Франция'])
  })
})

describe('getCountryDictionary — ошибка', () => {
  it('ответ с statusCode — реджектится ApiError', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )

    const error = await getCountryDictionary().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(403)
  })
})
