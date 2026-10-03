import {
  type AtomLike,
  withCache,
  type WithCacheOptions,
  withSessionStorage,
} from '@reatom/core'

// 5 минут: повторные заходы на страницу укладываются
// в квоту API (200 запросов/сутки).
export const QUERY_STALE_MS = 5 * 60 * 1000

// Только в DEV: кэш запросов переживает перезагрузку страницы при HMR/ручной отладке и не жжёт
// квоту. В проде кэш — в памяти, как раньше у createSessionCache.
export const devSessionPersist =
  import.meta.env.MODE === 'development' ? withSessionStorage : undefined

// Единая политика кэша для запросов к API. Только для action: на computed withCache тело
// выполняется до поиска в кэше, и запрос уходит, хотя потом отменяется. swr выключен — свежая
// запись не перезапрашивается в фоне, иначе каждый заход тратит квоту.
export const withQueryCache = <Target extends AtomLike>(
  options: WithCacheOptions<Target> = {},
) =>
  withCache<Target>({
    swr: false,
    staleTime: QUERY_STALE_MS,
    withPersist: devSessionPersist,
    ...options,
  })
