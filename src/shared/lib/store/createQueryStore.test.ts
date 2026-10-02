import { act, renderHook, waitFor } from '@testing-library/react'

import { createQueryStore, type QueryResult } from './createQueryStore'
import { resetAllStores } from './registry'

const TTL_MS = 5 * 60_000
const COOLDOWN_MS = 20_000

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

// Фейковый fetcher: считает вызовы по параметрам, ответ — по умолчанию `data:<id>`
const createFetcher = (
  impl: (id: number) => Promise<string> = async id => `data:${id}`,
) => {
  const calls: number[] = []
  const fetcher = vi.fn((id: number) => {
    calls.push(id)
    return impl(id)
  })

  return { fetcher, calls }
}

let nameCounter = 0
const nextName = () => {
  nameCounter += 1
  return `test-${nameCounter}`
}

const advance = (ms: number) => vi.setSystemTime(Date.now() + ms)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000_000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createQueryStore — fetch()', () => {
  it('резолвится значением fetcher', async () => {
    const { fetcher } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    await expect(store.fetch(1)).resolves.toBe('data:1')
  })

  it('параллельные вызовы с одним ключом дают один запрос', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    const [a, b] = await Promise.all([store.fetch(1), store.fetch(1)])

    expect(calls).toEqual([1])
    expect(a).toBe(b)
  })

  it('разные ключи не делят кеш', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    await store.fetch(1)
    await store.fetch(2)

    expect(calls).toEqual([1, 2])
  })

  it('свежая запись не перезапрашивается, протухшая — перезапрашивается', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    await store.fetch(1)
    advance(TTL_MS - 1)
    await store.fetch(1)
    expect(calls).toHaveLength(1)

    advance(2)
    await store.fetch(1)
    expect(calls).toHaveLength(2)
  })

  it('кастомный ttlMs', async () => {
    const { fetcher, calls } = createFetcher()
    const day = 24 * 60 * 60_000
    const store = createQueryStore({ name: nextName(), fetcher, ttlMs: day })

    await store.fetch(1)
    advance(day - 1)
    await store.fetch(1)
    expect(calls).toHaveLength(1)

    advance(2)
    await store.fetch(1)
    expect(calls).toHaveLength(2)
  })

  it('синхронный throw fetcher превращается в отклонённый промис', async () => {
    const store = createQueryStore<number, string>({
      name: nextName(),
      fetcher: () => {
        throw new Error('sync')
      },
    })

    await expect(store.fetch(1)).rejects.toThrow('sync')
  })

  it('закешированную ошибку не реплеит, а перезапрашивает даже в кулдаун', async () => {
    let fail = true
    const { fetcher, calls } = createFetcher(async id => {
      if (fail) throw new Error('boom')
      return `data:${id}`
    })
    const store = createQueryStore({ name: nextName(), fetcher })

    await expect(store.fetch(1)).rejects.toThrow('boom')
    fail = false

    await expect(store.fetch(1)).resolves.toBe('data:1')
    expect(calls).toHaveLength(2)
  })

  it('ошибка сохраняется как есть (со своими полями)', async () => {
    const error = Object.assign(new Error('not found'), { status: 404 })
    const store = createQueryStore<number, string>({
      name: nextName(),
      fetcher: async () => {
        throw error
      },
    })

    const { result } = renderHook(() => store.useQuery(1))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(error)
  })
})

describe('createQueryStore — useQuery', () => {
  it('первый рендер — loading, затем данные; запуск из эффекта', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    const { result } = renderHook(() => store.useQuery(1))

    expect(result.current).toMatchObject({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
    })

    await waitFor(() => expect(result.current.data).toBe('data:1'))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetching).toBe(false)
    expect(calls).toEqual([1])
  })

  it('два хука с одним ключом дают один запрос', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    const a = renderHook(() => store.useQuery(1))
    const b = renderHook(() => store.useQuery(1))

    await waitFor(() => expect(a.result.current.data).toBe('data:1'))
    expect(b.result.current.data).toBe('data:1')
    expect(calls).toEqual([1])
  })

  it('fetch() делит кеш с useQuery: данные уже в первом рендере, запроса нет', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    await store.fetch(1)
    const { result } = renderHook(() => store.useQuery(1))

    expect(result.current).toMatchObject({
      data: 'data:1',
      isLoading: false,
      isFetching: false,
    })
    expect(calls).toHaveLength(1)
  })

  it('протухшая запись отдаётся как данные и обновляется в фоне', async () => {
    let version = 1
    const { fetcher, calls } = createFetcher(async id => `v${version}:${id}`)
    const store = createQueryStore({ name: nextName(), fetcher })

    await store.fetch(1)
    advance(TTL_MS + 1)
    version = 2

    const { result } = renderHook(() => store.useQuery(1))

    expect(result.current).toMatchObject({
      data: 'v1:1',
      isLoading: false,
      isFetching: true,
    })
    await waitFor(() => expect(result.current.data).toBe('v2:1'))
    expect(result.current.isFetching).toBe(false)
    expect(calls).toHaveLength(2)
  })

  it('skip: запроса нет, data undefined, не loading', () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    const { result } = renderHook(() => store.useQuery(1, { skip: true }))

    expect(result.current).toMatchObject({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
    })
    act(() => result.current.refetch())
    expect(calls).toHaveLength(0)
  })

  it('без keepPreviousData смена ключа даёт loading без старых данных', async () => {
    const { fetcher } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    const { result, rerender } = renderHook(({ id }) => store.useQuery(id), {
      initialProps: { id: 1 },
    })
    await waitFor(() => expect(result.current.data).toBe('data:1'))

    rerender({ id: 2 })

    expect(result.current).toMatchObject({ data: undefined, isLoading: true })
    await waitFor(() => expect(result.current.data).toBe('data:2'))
  })

  it('keepPreviousData: в первом же рендере нового ключа старые данные и isFetching', async () => {
    const { fetcher } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })
    const renders: QueryResult<string>[] = []

    const { result, rerender } = renderHook(
      ({ id }) => {
        const query = store.useQuery(id, { keepPreviousData: true })
        renders.push(query)
        return query
      },
      { initialProps: { id: 1 } },
    )
    await waitFor(() => expect(result.current.data).toBe('data:1'))

    const before = renders.length
    rerender({ id: 2 })

    expect(renders[before]).toMatchObject({
      data: 'data:1',
      isLoading: false,
      isFetching: true,
    })
    // ни одного кадра «старые данные без индикатора»
    renders
      .slice(before)
      .filter(r => r.data === 'data:1')
      .forEach(r => expect(r.isFetching).toBe(true))

    await waitFor(() => expect(result.current.data).toBe('data:2'))
    expect(result.current.isFetching).toBe(false)
  })

  it('ошибка после успешных данных: isError, прежние data остаются', async () => {
    let fail = false
    const { fetcher } = createFetcher(async id => {
      if (fail) throw new Error('boom')
      return `data:${id}`
    })
    const store = createQueryStore({ name: nextName(), fetcher })

    const { result } = renderHook(() => store.useQuery(1))
    await waitFor(() => expect(result.current.data).toBe('data:1'))

    fail = true
    advance(TTL_MS + 1)
    act(() => result.current.refetch())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBe('data:1')
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('подписка только на свой ключ: обновление другого ключа не перерисовывает', async () => {
    const { fetcher } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })
    let renderCount = 0

    const { result } = renderHook(() => {
      renderCount += 1
      return store.useQuery(1)
    })
    await waitFor(() => expect(result.current.data).toBe('data:1'))

    const before = renderCount
    await act(async () => {
      await store.fetch(2)
    })

    expect(renderCount).toBe(before)
  })
})

describe('createQueryStore — кулдаун ошибок', () => {
  const failingStore = () => {
    let fail = true
    const { fetcher, calls } = createFetcher(async id => {
      if (fail) throw new Error('boom')
      return `data:${id}`
    })
    const store = createQueryStore({ name: nextName(), fetcher })

    return {
      store,
      calls,
      recover: () => {
        fail = false
      },
    }
  }

  it('повторный монтаж в пределах кулдауна не перезапрашивает', async () => {
    const { store, calls } = failingStore()

    const first = renderHook(() => store.useQuery(1))
    await waitFor(() => expect(first.result.current.isError).toBe(true))
    first.unmount()

    advance(COOLDOWN_MS - 1)
    const second = renderHook(() => store.useQuery(1))

    expect(second.result.current).toMatchObject({
      isError: true,
      isFetching: false,
      isLoading: false,
    })
    await act(async () => {})
    expect(calls).toHaveLength(1)
  })

  it('после кулдауна повторный монтаж перезапрашивает', async () => {
    const { store, calls, recover } = failingStore()

    const first = renderHook(() => store.useQuery(1))
    await waitFor(() => expect(first.result.current.isError).toBe(true))
    first.unmount()

    recover()
    advance(COOLDOWN_MS + 1)
    const second = renderHook(() => store.useQuery(1))

    await waitFor(() => expect(second.result.current.data).toBe('data:1'))
    expect(calls).toHaveLength(2)
  })

  it('refetch() обходит кулдаун', async () => {
    const { store, calls, recover } = failingStore()

    const { result } = renderHook(() => store.useQuery(1))
    await waitFor(() => expect(result.current.isError).toBe(true))

    recover()
    act(() => result.current.refetch())

    await waitFor(() => expect(result.current.data).toBe('data:1'))
    expect(result.current.isError).toBe(false)
    expect(calls).toHaveLength(2)
  })

  it('invalidate() обходит кулдаун: смонтированный хук перезапрашивает', async () => {
    const { store, calls, recover } = failingStore()

    const { result } = renderHook(() => store.useQuery(1))
    await waitFor(() => expect(result.current.isError).toBe(true))

    recover()
    act(() => store.invalidate(1))

    await waitFor(() => expect(result.current.data).toBe('data:1'))
    expect(calls).toHaveLength(2)
  })

  it('двойной клик по Retry даёт один запрос', async () => {
    const { store, calls, recover } = failingStore()

    const { result } = renderHook(() => store.useQuery(1))
    await waitFor(() => expect(result.current.isError).toBe(true))

    recover()
    act(() => {
      result.current.refetch()
      result.current.refetch()
    })

    await waitFor(() => expect(result.current.data).toBe('data:1'))
    expect(calls).toHaveLength(2)
  })
})

describe('createQueryStore — invalidate, reset, гонки', () => {
  it('invalidate(params) перезапрашивает только свой ключ', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    await store.fetch(1)
    await store.fetch(2)
    store.invalidate(1)
    await store.fetch(1)
    await store.fetch(2)

    expect(calls).toEqual([1, 2, 1])
  })

  it('invalidate() без параметров — все ключи', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    await store.fetch(1)
    await store.fetch(2)
    store.invalidate()
    await store.fetch(1)
    await store.fetch(2)

    expect(calls).toEqual([1, 2, 1, 2])
  })

  it('invalidate оставляет данные на экране и обновляет их в фоне', async () => {
    let version = 1
    const { fetcher } = createFetcher(async id => `v${version}:${id}`)
    const store = createQueryStore({ name: nextName(), fetcher })

    const { result } = renderHook(() => store.useQuery(1))
    await waitFor(() => expect(result.current.data).toBe('v1:1'))

    version = 2
    act(() => store.invalidate(1))

    expect(result.current).toMatchObject({ data: 'v1:1', isFetching: true })
    await waitFor(() => expect(result.current.data).toBe('v2:1'))
  })

  it('ответ устаревшего запроса не перезаписывает более новый результат', async () => {
    const requests: Deferred<string>[] = []
    const store = createQueryStore<number, string>({
      name: nextName(),
      fetcher: () => {
        const request = deferred<string>()
        requests.push(request)
        return request.promise
      },
    })

    const { result } = renderHook(() => store.useQuery(1))
    expect(requests).toHaveLength(1)

    act(() => store.invalidate(1))
    await waitFor(() => expect(requests).toHaveLength(2))

    await act(async () => requests[1].resolve('new'))
    expect(result.current.data).toBe('new')

    await act(async () => requests[0].resolve('old'))
    expect(result.current.data).toBe('new')
    expect(result.current.isFetching).toBe(false)
  })

  it('устаревшая ошибка не перезаписывает более новые данные', async () => {
    const requests: Deferred<string>[] = []
    const store = createQueryStore<number, string>({
      name: nextName(),
      fetcher: () => {
        const request = deferred<string>()
        requests.push(request)
        return request.promise
      },
    })

    const first = store.fetch(1)
    store.invalidate(1)
    const second = store.fetch(1)

    requests[1].resolve('new')
    await second
    requests[0].reject(new Error('stale'))
    await expect(first).rejects.toThrow('stale')

    const { result } = renderHook(() => store.useQuery(1))
    expect(result.current).toMatchObject({ data: 'new', isError: false })
  })

  it('reset() и resetAllStores() очищают записи', async () => {
    const { fetcher, calls } = createFetcher()
    const store = createQueryStore({ name: nextName(), fetcher })

    await store.fetch(1)
    store.reset()
    await store.fetch(1)
    resetAllStores()
    await store.fetch(1)

    expect(calls).toEqual([1, 1, 1])
  })

  it('два экземпляра фабрики изолированы', async () => {
    const a = createFetcher(async id => `a:${id}`)
    const b = createFetcher(async id => `b:${id}`)
    const storeA = createQueryStore({ name: nextName(), fetcher: a.fetcher })
    const storeB = createQueryStore({ name: nextName(), fetcher: b.fetcher })

    await expect(storeA.fetch(1)).resolves.toBe('a:1')
    await expect(storeB.fetch(1)).resolves.toBe('b:1')
    storeA.invalidate()
    await storeB.fetch(1)

    expect(a.calls).toEqual([1])
    expect(b.calls).toEqual([1])
  })

  it('getKey задаёт сериализацию параметров', async () => {
    const fetcher = vi.fn(async (params: { id: number; extra: string }) =>
      String(params.id),
    )
    const store = createQueryStore({
      name: nextName(),
      fetcher,
      getKey: params => String(params.id),
    })

    await store.fetch({ id: 1, extra: 'a' })
    await store.fetch({ id: 1, extra: 'b' })

    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

describe('createQueryStore — составной стор', () => {
  it('refetch() A сразу перезапрашивает упавший шаг B, успешные шаги — из кеша', async () => {
    let failStep = true
    const step = createFetcher(async id => {
      if (id === 2 && failStep) throw new Error('step failed')
      return `step:${id}`
    })
    const storeB = createQueryStore({ name: nextName(), fetcher: step.fetcher })
    const storeA = createQueryStore({
      name: nextName(),
      fetcher: async (ids: number[]) =>
        Promise.all(ids.map(id => storeB.fetch(id))),
    })

    const { result } = renderHook(() => storeA.useQuery([1, 2, 3]))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(step.calls.sort()).toEqual([1, 2, 3])

    // в пределах кулдауна шага B
    failStep = false
    act(() => result.current.refetch())

    await waitFor(() =>
      expect(result.current.data).toEqual(['step:1', 'step:2', 'step:3']),
    )
    expect(step.calls.sort()).toEqual([1, 2, 2, 3])
  })
})

describe('createQueryStore — devtools', () => {
  it('в тестовом окружении (без расширения) не пишет предупреждений', async () => {
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const { fetcher } = createFetcher()

    const store = createQueryStore({ name: nextName(), fetcher })
    await store.fetch(1)

    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
