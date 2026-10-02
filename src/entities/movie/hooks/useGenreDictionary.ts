import { genreDictionaryCache } from '../api/createDictionaryCache'
import { useGetGenreDictionaryQuery } from '../api/dictionaryApi'
import type { Genre } from '../model/genre'
import { STATIC_FALLBACK_GENRES } from '../model/genre'

/**
 * Синхронный хук без блокировки рендера: компонент сразу получает ответ RTK Query, а пока его
 * нет — localStorage-кеш или статический `STATIC_FALLBACK_GENRES`. Свежий кеш (`skip`) запрос не
 * делает; устаревший/пустой обновляется в фоне, успешный ответ пишется в слот в `onQueryStarted`.
 */
export const useGenreDictionary = (): Genre[] => {
  const { data } = useGetGenreDictionaryQuery(undefined, {
    skip: genreDictionaryCache.isFresh(),
  })
  // Пустой ответ API не вытесняет кеш (см. createDictionaryCache.save)
  const items = data?.length ? data : genreDictionaryCache.slot.get().items

  if (items.length === 0) {
    return STATIC_FALLBACK_GENRES
  }

  return items.map(name => ({ name }))
}
