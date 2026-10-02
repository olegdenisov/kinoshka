import { ApiError } from '@shared/api'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { fetchPersonDetail, personDetailStore } from './getPersonDetail'

const doc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Person',
  enName: 'Test Person EN',
  photo: 'https://avatars.mds.yandex.net/photo.jpg',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const mockSuccess = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/person/${id}`, () =>
      HttpResponse.json(doc(id, overrides)),
    ),
  )
}

const mockError = (
  id: number,
  status: number,
  body: Record<string, unknown>,
) => {
  server.use(
    http.get(`*/v1.5/person/${id}`, () => HttpResponse.json(body, { status })),
  )
}

describe('getPersonDetail — success', () => {
  it('запрос уходит на /v1.5/person/:id, ответ маппится в PersonDetail', async () => {
    mockSuccess(701, { name: 'Anna Actress' })

    const detail = await fetchPersonDetail(701)

    expect(detail.id).toBe(701)
    expect(detail.name).toBe('Anna Actress')
    expect(detail.enName).toBe('Test Person EN')
    expect(detail.photo).toBe('https://avatars.mds.yandex.net/photo.jpg')
  })

  it('personDetailStore.fetch: параллельные вызовы — один сетевой запрос', async () => {
    let callCount = 0
    server.use(
      http.get('*/v1.5/person/702', () => {
        callCount += 1

        return HttpResponse.json(doc(702))
      }),
    )

    await Promise.all([
      personDetailStore.fetch(702),
      personDetailStore.fetch(702),
    ])

    expect(callCount).toBe(1)
  })
})

describe('getPersonDetail — 404', () => {
  it('персона не найдена — реджект с ApiError.status === 404', async () => {
    mockError(666, 404, {
      statusCode: 404,
      message: 'Not found person with id 666',
      error: 'Not Found',
    })

    const error = await personDetailStore.fetch(666).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })
})

describe('getPersonDetail — 403', () => {
  it('403 — промис реджектится', async () => {
    mockError(555, 403, {
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden',
    })

    await expect(personDetailStore.fetch(555)).rejects.toThrow()
  })
})

describe('getPersonDetail — invalidate', () => {
  it('после invalidate следующий вызов снова ходит в сеть', async () => {
    let callCount = 0
    server.use(
      http.get('*/v1.5/person/703', () => {
        callCount += 1

        return HttpResponse.json(doc(703))
      }),
    )

    await personDetailStore.fetch(703)
    expect(callCount).toBe(1)

    personDetailStore.invalidate(703)
    await personDetailStore.fetch(703)

    expect(callCount).toBe(2)
  })
})
