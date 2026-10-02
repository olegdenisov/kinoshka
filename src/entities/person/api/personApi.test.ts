import { http, HttpResponse } from 'msw'

import { makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { personApi } from './personApi'

const doc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Person',
  enName: 'Test Person EN',
  photo: 'https://avatars.mds.yandex.net/photo.jpg',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const getPerson = (id: number) =>
  makeStore().dispatch(personApi.endpoints.getPersonDetail.initiate(id))

describe('getPersonDetail', () => {
  it('ответ маппится в PersonDetail', async () => {
    server.use(
      http.get('*/v1.5/person/701', () =>
        HttpResponse.json(doc(701, { name: 'Anna Actress' })),
      ),
    )

    const result = await getPerson(701)

    expect(result.data).toMatchObject({
      id: 701,
      name: 'Anna Actress',
      enName: 'Test Person EN',
      photo: 'https://avatars.mds.yandex.net/photo.jpg',
    })
  })

  it('404 — QueryError со status', async () => {
    server.use(
      http.get('*/v1.5/person/702', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Not found', error: 'Not Found' },
          { status: 404 },
        ),
      ),
    )

    const result = await getPerson(702)

    expect(result.error).toMatchObject({ status: 404 })
  })

  it('error-DTO в теле 200 — QueryError со status из тела', async () => {
    server.use(
      http.get('*/v1.5/person/703', () =>
        HttpResponse.json({ statusCode: 403, message: 'Quota', error: 'x' }),
      ),
    )

    const result = await getPerson(703)

    expect(result.error).toEqual({ status: 403, message: 'Quota' })
  })
})
