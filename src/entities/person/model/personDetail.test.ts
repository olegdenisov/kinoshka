import { ApiError } from '@shared/api'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { fetchPersonDetail } from './personDetail'

const mockPerson = (id: number) => {
  const requests = vi.fn()
  server.use(
    http.get(`*/v1.5/person/${id}`, () => {
      requests()
      return HttpResponse.json({
        id,
        name: `Person ${id}`,
        enName: `Person ${id} EN`,
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      })
    }),
  )
  return requests
}

describe('fetchPersonDetail', () => {
  it('ответ маппится в PersonDetail', async () => {
    mockPerson(11)

    const person = await fetchPersonDetail(11)

    expect(person.id).toBe(11)
    expect(person.name).toBe('Person 11')
  })

  it('повторный вызов с тем же id не шлёт запрос', async () => {
    const requests = mockPerson(12)

    await fetchPersonDetail(12)
    await fetchPersonDetail(12)

    expect(requests).toHaveBeenCalledTimes(1)
  })

  it('404 — ApiError со статусом 404', async () => {
    server.use(
      http.get('*/v1.5/person/13', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Not found', error: 'Not Found' },
          { status: 404 },
        ),
      ),
    )

    const error = await fetchPersonDetail(13).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })
})
