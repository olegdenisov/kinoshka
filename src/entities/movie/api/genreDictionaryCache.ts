import { createDictionaryCache } from './createDictionaryCache'
import { getGenreDictionary } from './getGenreDictionary'

/**
 * Кэш справочника жанров — экземпляр общей фабрики (кулдаун/дедупликация/TTL — в
 * createDictionaryCache.ts). Хранит русские названия как есть: канонический жанр из плана
 * docs/plans/20260815-dynamic-genre-dictionary.md.
 */
const genreDictionaryCache = createDictionaryCache({
  storageKey: 'kinoshka:genres',
  fetchItems: () =>
    getGenreDictionary().then(genres => genres.map(genre => genre.name)),
})

export {
  BACKGROUND_RETRY_COOLDOWN_MS,
  DICTIONARY_TTL_MS as GENRE_DICTIONARY_TTL_MS,
} from './createDictionaryCache'

export const genreDictionarySlot = genreDictionaryCache.slot
export const isGenreDictionaryStale = genreDictionaryCache.isStale
export const refreshGenreDictionary = genreDictionaryCache.refresh
export const invalidateGenreDictionary = genreDictionaryCache.invalidate
export const resetGenreDictionaryState = genreDictionaryCache.resetState
