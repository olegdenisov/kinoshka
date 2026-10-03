import {
  action,
  type AtomLike,
  type Ext,
  type CacheAtom,
  type CacheRecord,
  computed,
  withAsync,
  withAsyncData,
  withCache,
  withLocalStorage,
  type WithPersistOptions,
  wrap,
} from '@reatom/core'
import { apiClient, ApiError } from '@shared/api'
import { z } from 'zod'

import { STATIC_FALLBACK_COUNTRIES } from './country'
import type { Genre } from './genre'
import { STATIC_FALLBACK_GENRES } from './genre'

const DICTIONARY_STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7 дней

// Проверяем только то, что читает withCache при восстановлении (params, value, lastUpdate);
// остальные поля записи (таймер, контроллер) не в схеме и в хранилище не участвуют.
const cacheSnapshotSchema = z.array(
  z.tuple([
    z.unknown(),
    z.object({
      params: z.array(z.unknown()),
      value: z.array(z.string()),
      lastUpdate: z.number(),
    }),
  ]),
)

// Мусор в localStorage не должен ронять чтение атома: при невалидном снапшоте остаётся текущее
// состояние кэша, а не TypeError из withPersist.
const persistDictionary =
  (key: string) =>
  <Target extends AtomLike>(
    options: WithPersistOptions<Map<unknown, CacheRecord<Target>>>,
  ): Ext<CacheAtom<Target>> =>
    withLocalStorage<CacheAtom<Target>, unknown>({
      ...options,
      key,
      fromSnapshot: (snapshot, state) =>
        cacheSnapshotSchema.safeParse(snapshot).success
          ? options.fromSnapshot!(snapshot, state)
          : (state ?? new Map()),
    })

const fetchDictionaryNames = async (
  type: 'genres' | 'countries',
): Promise<string[]> => {
  const response = await apiClient.getV15DictionaryByType({ path: { type } })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return response.data.items.map(item => item.name)
}

// swr выключен: свежий словарь не перезапрашивается; устаревший (старше 7 дней) исчезает из
// кэша и запрашивается заново. Ошибка не кэшируется, но ресурс ниже не перезапускается сам.
const fetchGenreNames = action(
  () => fetchDictionaryNames('genres'),
  'movie.fetchGenreNames',
).extend(
  withAsync(),
  withCache({
    swr: false,
    staleTime: DICTIONARY_STALE_MS,
    withPersist: persistDictionary('kinoshka:genres'),
  }),
)

const fetchCountryNames = action(
  () => fetchDictionaryNames('countries'),
  'movie.fetchCountryNames',
).extend(
  withAsync(),
  withCache({
    swr: false,
    staleTime: DICTIONARY_STALE_MS,
    withPersist: persistDictionary('kinoshka:countries'),
  }),
)

export const genreDictionary = computed(
  async () => await wrap(fetchGenreNames()),
  'movie.genreDictionary',
).extend(withAsyncData({ initState: [] }))

export const countryDictionary = computed(
  async () => await wrap(fetchCountryNames()),
  'movie.countryDictionary',
).extend(withAsyncData({ initState: [] }))

// Статический шорт-лист вместо пустого списка: до загрузки, при ошибке и пока устаревший
// словарь перезапрашивается.
export const genres = computed((): Genre[] => {
  const names = genreDictionary.data()
  if (genreDictionary.error() || names.length === 0) {
    return STATIC_FALLBACK_GENRES
  }
  return names.map(name => ({ name }))
}, 'movie.genres')

export const countries = computed((): string[] => {
  const names = countryDictionary.data()
  if (countryDictionary.error() || names.length === 0) {
    return STATIC_FALLBACK_COUNTRIES
  }
  return names
}, 'movie.countries')
