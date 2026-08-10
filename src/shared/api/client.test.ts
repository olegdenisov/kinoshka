import { http, HttpResponse } from 'msw'
import { server } from '../../test/setup'
import { apiClient } from './client'

const ENDPOINT = '*/v1.5/movie/1'
const NOT_FOUND = {
  status: 404,
  message: 'Not found movie with id 1',
  error: 'Not found',
}
const FORBIDDEN = {
  status: 403,
  message: 'Forbidden',
  error: 'Forbidden',
}

describe('apiClient', () => {
  it('api status 404 выставляется корректно', async () => {
    server.use(
      http.get(ENDPOINT, () => {
        return HttpResponse.json(NOT_FOUND, { status: 404 })
      }),
    )

    await expect(
      apiClient.getV15MovieById({ path: { id: 1 } }),
    ).rejects.toMatchObject({
      status: NOT_FOUND.status,
      message: NOT_FOUND.message,
    })
  })

  it('api status 403 выставляется корректно', async () => {
    server.use(
      http.get(ENDPOINT, () => {
        return HttpResponse.json(FORBIDDEN, { status: 403 })
      }),
    )

    await expect(
      apiClient.getV15MovieById({ path: { id: 1 } }),
    ).rejects.toMatchObject({
      status: FORBIDDEN.status,
      message: FORBIDDEN.message,
    })
  })

  it('тело ответа без строкового message — падает обратно на error.message (не бросает и не теряет status)', async () => {
    server.use(
      http.get(ENDPOINT, () => {
        // Тело без поля `message` (или с нестроковым message) — интерцептор не может
        // прочитать data.message и обязан упасть обратно на error.message.
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 },
        )
      }),
    )

    await expect(
      apiClient.getV15MovieById({ path: { id: 1 } }),
    ).rejects.toMatchObject({
      status: 500,
      message: expect.any(String),
    })
  })
})
