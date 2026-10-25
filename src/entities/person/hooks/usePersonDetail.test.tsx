import type { ApiError } from '@shared/api'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { usePersonDetail } from './usePersonDetail'

const personDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Person',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const mockPerson = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/person/${id}`, () =>
      HttpResponse.json(personDoc(id, overrides)),
    ),
  )
}

const mockPersonError = (id: number, status: number) => {
  server.use(
    http.get(`*/v1.5/person/${id}`, () =>
      HttpResponse.json(
        { statusCode: status, message: 'error', error: 'error' },
        { status },
      ),
    ),
  )
}

describe('usePersonDetail — успешная загрузка', () => {
  it('после резолва data содержит имя персоны', async () => {
    mockPerson(801, { name: 'Anna Actress' })

    const { result } = renderHook(() => usePersonDetail(801))

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.data?.name).toBe('Anna Actress'))
  })
})

describe('usePersonDetail — ошибочный путь', () => {
  it('404 попадает в error со status === 404', async () => {
    mockPersonError(802, 404)

    const { result } = renderHook(() => usePersonDetail(802))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect((result.current.error as ApiError).status).toBe(404)
    expect(result.current.data).toBeUndefined()
  })
})

describe('usePersonDetail — кеш и Retry', () => {
  it('повторный рендер и второй хук не дают повторного запроса', async () => {
    let requests = 0
    server.use(
      http.get('*/v1.5/person/803', () => {
        requests += 1

        return HttpResponse.json(personDoc(803))
      }),
    )

    const first = renderHook(() => usePersonDetail(803))
    await waitFor(() => expect(first.result.current.data).toBeDefined())
    first.rerender()
    const second = renderHook(() => usePersonDetail(803))

    expect(second.result.current.data?.name).toBe('Test Person')
    expect(requests).toBe(1)
  })

  it('refetch после ошибки сразу уходит в сеть', async () => {
    mockPersonError(804, 500)

    const { result } = renderHook(() => usePersonDetail(804))
    await waitFor(() => expect(result.current.isError).toBe(true))

    mockPerson(804, { name: 'After' })
    result.current.refetch()

    await waitFor(() => expect(result.current.data?.name).toBe('After'))
  })
})

describe('usePersonDetail — смена id', () => {
  it('новый id: данные прежнего не показываются', async () => {
    mockPerson(805, { name: 'First' })
    mockPerson(806, { name: 'Second' })

    const { result, rerender } = renderHook(({ id }) => usePersonDetail(id), {
      initialProps: { id: 805 },
    })
    await waitFor(() => expect(result.current.data?.name).toBe('First'))

    rerender({ id: 806 })

    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.data?.name).toBe('Second'))
  })
})
