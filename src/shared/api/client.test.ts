import { apiClient } from "./client"
import { http, HttpResponse } from 'msw'
import { server } from '../../test/setup'


const ENDPOINT = '*/v1.5/movie/1'
const NOT_FOUND = {
  status: 404, 
  message: 'Not found movie with id 1', 
  error: 'Not found'
}
const FORBIDDEN = {
  status: 403, 
  message: 'Forbidden', 
  error: 'Forbidden'
}

describe('apiClient', () => {
  it('api status 404 выставляется корректно', async () => {
    server.use(
      http.get(ENDPOINT, () => {
        return HttpResponse.json(NOT_FOUND, { status: 404 })
      }),
    )

    await expect(apiClient.getV15MovieById({ path: { id: 1 }}))
      .rejects
      .toMatchObject({ status: NOT_FOUND.status, message: NOT_FOUND.message })
  })

  it('api status 403 выставляется корректно', async () => {
    server.use(
      http.get(ENDPOINT, () => {
        return HttpResponse.json(FORBIDDEN, { status: 403 })
      }),
    )

    await expect(apiClient.getV15MovieById({ path: { id: 1 }}))
      .rejects
      .toMatchObject({ status: FORBIDDEN.status, message: FORBIDDEN.message })
  })
})