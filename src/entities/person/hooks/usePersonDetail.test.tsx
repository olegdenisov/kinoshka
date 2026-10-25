import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper, makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { usePersonDetail } from './usePersonDetail'

const personDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Person',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

describe('usePersonDetail', () => {
  it('отдаёт data после загрузки', async () => {
    server.use(
      http.get('*/v1.5/person/801', () =>
        HttpResponse.json(personDoc(801, { name: 'Anna Actress' })),
      ),
    )

    const { result } = renderHook(() => usePersonDetail(801), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.data?.name).toBe('Anna Actress'))
  })

  it('404 — isError со status 404 в error', async () => {
    server.use(
      http.get('*/v1.5/person/802', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'nf', error: 'nf' },
          { status: 404 },
        ),
      ),
    )

    const { result } = renderHook(() => usePersonDetail(802), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 404 })
  })

  it('повторный рендер и второй потребитель не делают повторный запрос', async () => {
    let requests = 0
    server.use(
      http.get('*/v1.5/person/803', () => {
        requests += 1
        return HttpResponse.json(personDoc(803))
      }),
    )
    const wrapper = createStoreWrapper(makeStore())

    const first = renderHook(() => usePersonDetail(803), { wrapper })
    await waitFor(() => expect(first.result.current.data).toBeDefined())
    first.rerender()
    const second = renderHook(() => usePersonDetail(803), { wrapper })

    await waitFor(() => expect(second.result.current.data).toBeDefined())
    expect(requests).toBe(1)
  })
})
