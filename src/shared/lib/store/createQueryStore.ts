import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { createStore, type StateCreator } from 'zustand/vanilla'

import { registerStoreReset } from './registry'
import { withDevtools } from './withDevtools'

export type QueryResult<TData> = {
  data: TData | undefined
  // нет данных и идёт первый запрос
  isLoading: boolean
  // идёт любой запрос, включая фоновый
  isFetching: boolean
  isError: boolean
  error: unknown
  refetch: () => void
}

export type UseQueryOptions = {
  skip?: boolean
  // пока грузится новый ключ, хук отдаёт данные прошлого ключа (stale-while-fetching)
  keepPreviousData?: boolean
}

type QueryEntry<TData> = {
  // pending — запрос ни разу не завершился
  status: 'pending' | 'success' | 'error'
  // при ошибке после успеха прежние data остаются
  data: TData | undefined
  // ошибка хранится как есть (ApiError со status) — стор не обязан быть сериализуемым
  error: unknown
  updatedAt: number
  isFetching: boolean
}

type QueryState<TData> = {
  entries: Record<string, QueryEntry<TData>>
}

export type QueryStore<TParams, TData> = {
  useQuery: (params: TParams, options?: UseQueryOptions) => QueryResult<TData>
  // для композиции внутри других fetcher'ов: та же дедупликация и TTL
  fetch: (params: TParams) => Promise<TData>
  // invalidate/reset — не для продакшен-кода: их зовут тесты (сброс кеша между шагами,
  // проверка перезапроса протухшей записи), а реестр сторов сбрасывает через внутренний reset
  invalidate: (params?: TParams) => void
  reset: () => void
}

type QueryStoreOptions<TParams, TData> = {
  // имя для devtools
  name: string
  // fetcher не должен резолвиться undefined: data === undefined означает «данных нет»
  fetcher: (params: TParams) => Promise<TData>
  getKey?: (params: TParams) => string
  ttlMs?: number
  errorCooldownMs?: number
}

const DEFAULT_TTL_MS = 5 * 60_000
// Кулдаун бережёт квоту demo-API (200 запросов/день): повторный монтаж компонента после ошибки
// не перезапрашивает сразу
const DEFAULT_ERROR_COOLDOWN_MS = 20_000

const defaultGetKey = (params: unknown): string => JSON.stringify(params) ?? ''

const noop = () => {}

export const createQueryStore = <TParams, TData>({
  name,
  fetcher,
  getKey = defaultGetKey,
  ttlMs = DEFAULT_TTL_MS,
  errorCooldownMs = DEFAULT_ERROR_COOLDOWN_MS,
}: QueryStoreOptions<TParams, TData>): QueryStore<TParams, TData> => {
  const initializer: StateCreator<QueryState<TData>> = () => ({ entries: {} })

  const store = createStore<QueryState<TData>>()(
    withDevtools(name, initializer),
  )

  // In-flight промисы — в замыкании, не в стейте: промис не нужен подписчикам, а стейт
  // остаётся читаемым в devtools. Запись в Map — признак «текущего» запроса ключа: ответ
  // запроса, чью запись уже вытеснили (invalidate/reset), стор не трогает.
  const inflight = new Map<string, { promise: Promise<TData> }>()

  const setEntry = (
    key: string,
    update: (entry: QueryEntry<TData> | undefined) => QueryEntry<TData>,
  ) => {
    store.setState(state => ({
      entries: { ...state.entries, [key]: update(state.entries[key]) },
    }))
  }

  const isFreshData = (entry: QueryEntry<TData> | undefined) =>
    entry?.status === 'success' && Date.now() - entry.updatedAt < ttlMs

  const isCoolingDown = (entry: QueryEntry<TData> | undefined) =>
    entry?.status === 'error' && Date.now() - entry.updatedAt < errorCooldownMs

  // Нужен ли автоматический запуск из useQuery. Только по стейту — вызывается и в рендере
  const needsAutoFetch = (entry: QueryEntry<TData> | undefined) =>
    !entry ||
    (!entry.isFetching && !isFreshData(entry) && !isCoolingDown(entry))

  const start = (key: string, params: TParams): Promise<TData> => {
    const record = {} as { promise: Promise<TData> }
    const isCurrent = () => inflight.get(key) === record

    // new Promise ловит и синхронный throw fetcher'а
    record.promise = new Promise<TData>(resolve =>
      resolve(fetcher(params)),
    ).then(
      data => {
        if (isCurrent()) {
          inflight.delete(key)
          setEntry(key, () => ({
            status: 'success',
            data,
            error: undefined,
            updatedAt: Date.now(),
            isFetching: false,
          }))
        }

        return data
      },
      (error: unknown) => {
        if (isCurrent()) {
          inflight.delete(key)
          setEntry(key, entry => ({
            status: 'error',
            data: entry?.data,
            error,
            updatedAt: Date.now(),
            isFetching: false,
          }))
        }

        throw error
      },
    )

    inflight.set(key, record)
    setEntry(key, entry => ({
      status: entry?.status ?? 'pending',
      data: entry?.data,
      error: entry?.error,
      updatedAt: entry?.updatedAt ?? 0,
      isFetching: true,
    }))

    return record.promise
  }

  // Императивный запуск (композиция, refetch): закешированную ошибку не реплеит, а
  // перезапрашивает. Иначе Retry составного стора был бы мёртв на время кулдауна — refetch
  // снимал бы кулдаун только со своего ключа, а вложенные шаги отдавали бы старую ошибку.
  // Квоту бережёт кулдаун верхнего ключа в useQuery.
  const fetchQuery = (params: TParams): Promise<TData> => {
    const key = getKey(params)
    const running = inflight.get(key)
    if (running) return running.promise

    const entry = store.getState().entries[key]
    if (isFreshData(entry)) return Promise.resolve(entry.data as TData)

    return start(key, params)
  }

  // Автоматический запуск из useQuery: уважает кулдаун ошибок
  const ensure = (key: string, params: TParams) => {
    if (inflight.has(key)) return
    const entry = store.getState().entries[key]
    if (isFreshData(entry) || isCoolingDown(entry)) return

    // ошибку покажет стейт записи; промис ловим, чтобы не было unhandled rejection
    start(key, params).catch(noop)
  }

  // Запись помечается протухшей (данные остаются на экране), текущий запрос забывается —
  // смонтированные useQuery перезапрашивают в фоне
  const invalidate = (params?: TParams) => {
    const keys =
      params === undefined
        ? Object.keys(store.getState().entries)
        : [getKey(params)]

    keys.forEach(key => inflight.delete(key))
    store.setState(state => {
      const entries = { ...state.entries }
      keys.forEach(key => {
        const entry = entries[key]
        if (entry) {
          entries[key] = {
            ...entry,
            updatedAt: Number.NEGATIVE_INFINITY,
            isFetching: false,
          }
        }
      })

      return { entries }
    })
  }

  const reset = () => {
    inflight.clear()
    store.setState({ entries: {} })
  }

  registerStoreReset(reset)

  const useQuery = (
    params: TParams,
    { skip = false, keepPreviousData = false }: UseQueryOptions = {},
  ): QueryResult<TData> => {
    const key = getKey(params)
    // подписка только на запись своего ключа: изменения других ключей не перерисовывают
    const entry = useStore(store, state => state.entries[key])
    const shouldFetch = !skip && needsAutoFetch(entry)

    const [previousData, setPreviousData] = useState<TData | undefined>()
    const entryData = entry?.data
    // derived state в рендере, а не эффектом: иначе в первом рендере нового ключа данных не было бы
    if (
      keepPreviousData &&
      entryData !== undefined &&
      entryData !== previousData
    ) {
      setPreviousData(entryData)
    }

    // Запуск — из эффекта, не во время рендера. shouldFetch в зависимостях: после invalidate
    // ключ тот же, а запрос нужен; повторные вызовы ensure идемпотентны (in-flight/TTL/кулдаун).
    // params в зависимостях: объект с новой ссылкой на каждый рендер перезапускает эффект, но
    // ensure ничего не делает повторно — это лишь холостой вызов, не лишний запрос
    useEffect(() => {
      if (shouldFetch) ensure(key, params)
    }, [shouldFetch, key, params])

    const data =
      entryData !== undefined
        ? entryData
        : keepPreviousData
          ? previousData
          : undefined
    // Выводится синхронно: запуск идёт из эффекта, и без этого при keepPreviousData был бы
    // кадр «старые данные без индикатора»
    const isFetching = (entry?.isFetching ?? false) || shouldFetch

    return {
      data,
      isLoading: data === undefined && isFetching,
      isFetching,
      // пока идёт повтор после ошибки, ошибку не показываем: иначе Retry не даёт обратной связи
      isError: entry?.status === 'error' && !entry.isFetching,
      error: entry?.error,
      // двойной клик по Retry не даёт второго запроса: fetch() дедуплицирует in-flight
      refetch: () => {
        if (!skip) fetchQuery(params).catch(noop)
      },
    }
  }

  return { useQuery, fetch: fetchQuery, invalidate, reset }
}
