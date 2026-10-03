import { action, computed, withAsync, withAsyncData, wrap } from '@reatom/core'

import { QUERY_STALE_MS, withQueryCache } from './withQueryCache'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('withQueryCache', () => {
  it('повторный вызов с теми же параметрами не вызывает тело', async () => {
    const body = vi.fn(async (id: number) => id * 10)
    const query = action(body, 'test.query').extend(
      withAsync(),
      withQueryCache(),
    )

    expect(await query(1)).toBe(10)
    expect(await query(1)).toBe(10)
    expect(body).toHaveBeenCalledTimes(1)

    await query(2)
    expect(body).toHaveBeenCalledTimes(2)
  })

  // Без ignoreAbort незавершённая запись с параметрами делится только внутри того же
  // abort-контроллера: вызовы из разных кадров шлют каждый свой запрос.
  it('параллельные вызовы с ignoreAbort делят один промис', async () => {
    const body = vi.fn(async (id: number) => id)
    const query = action(body, 'test.parallel').extend(
      withAsync(),
      withQueryCache({ ignoreAbort: true }),
    )

    const [a, b] = await Promise.all([query(1), query(1)])

    expect(a).toBe(1)
    expect(b).toBe(1)
    expect(body).toHaveBeenCalledTimes(1)
  })

  it('запись сверх length вытесняется — самая старая', async () => {
    const body = vi.fn(async (id: number) => id)
    const query = action(body, 'test.length').extend(
      withAsync(),
      withQueryCache({ length: 2 }),
    )

    await query(1)
    await query(2)
    await query(3)
    expect(body).toHaveBeenCalledTimes(3)

    await query(3)
    await query(2)
    expect(body).toHaveBeenCalledTimes(3)

    await query(1)
    expect(body).toHaveBeenCalledTimes(4)
  })

  it('отклонённый результат не кэшируется — следующий вызов идёт заново', async () => {
    let shouldFail = true
    const body = vi.fn(async (id: number) => {
      if (shouldFail) throw new Error('boom')
      return id
    })
    const query = action(body, 'test.reject').extend(
      withAsync(),
      withQueryCache(),
    )

    await expect(query(1)).rejects.toThrow('boom')
    await flush()

    shouldFail = false
    expect(await query(1)).toBe(1)
    expect(body).toHaveBeenCalledTimes(2)
  })

  it('запись старше QUERY_STALE_MS удаляется', async () => {
    vi.useFakeTimers()
    try {
      const body = vi.fn(async (id: number) => id)
      const query = action(body, 'test.stale').extend(
        withAsync(),
        withQueryCache(),
      )

      await query(1)
      vi.advanceTimersByTime(QUERY_STALE_MS - 1)
      await query(1)
      expect(body).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(QUERY_STALE_MS)
      await query(1)
      expect(body).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('computed-ресурс без зависимостей поверх запроса', () => {
  it('после ошибки не перезапрашивается при повторной подписке, только по retry()', async () => {
    let shouldFail = true
    const body = vi.fn(async () => {
      if (shouldFail) throw new Error('boom')
      return ['ok']
    })
    const query = action(body, 'test.resourceQuery').extend(
      withAsync(),
      withQueryCache(),
    )
    const resource = computed(
      async () => await wrap(query()),
      'test.resource',
    ).extend(withAsyncData({ initState: [] as string[], status: true }))

    const unsubscribe = resource.subscribe()
    await vi.waitFor(() => expect(resource.status().isRejected).toBe(true))
    expect(resource.error()?.message).toBe('boom')
    unsubscribe()

    shouldFail = false
    const unsubscribeAgain = resource.subscribe()
    await flush()
    expect(body).toHaveBeenCalledTimes(1)
    expect(resource.status().isRejected).toBe(true)

    resource.retry()
    await vi.waitFor(() => expect(resource.data()).toEqual(['ok']))
    expect(body).toHaveBeenCalledTimes(2)
    expect(resource.error()).toBeUndefined()
    unsubscribeAgain()
  })
})
