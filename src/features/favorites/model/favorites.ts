import { reatomMoviesByIds } from '@entities/movie'
import { action, reatomSet, withLocalStorage } from '@reatom/core'
import { persistOptions, trackEvent } from '@shared/lib'
import { z } from 'zod'

export const favoriteIds = reatomSet<number>([], 'favorites.ids').extend(
  withLocalStorage(
    persistOptions({
      key: 'kinoshka:favorites',
      schema: z.array(z.number()),
      fallback: new Set<number>(),
      fromValid: ids => new Set(ids),
      toSnapshot: ids => [...ids],
    }),
  ),
)

export const toggleFavorite = action((id: number) => {
  const added = !favoriteIds().has(id)
  favoriteIds.toggle(id)
  // Событие не зависит от успеха записи в хранилище: Reatom проглатывает сбой setItem.
  if (added) trackEvent('favorite added')
}, 'favorites.toggle')

export const favoriteMovies = reatomMoviesByIds(favoriteIds, 'favorites.movies')
