import { reatomMoviesByIds } from '@entities/movie'
import { reatomSet, withLocalStorage } from '@reatom/core'
import { persistOptions } from '@shared/lib'
import { z } from 'zod'

export const watchedIds = reatomSet<number>([], 'watched.ids').extend(
  withLocalStorage(
    persistOptions({
      key: 'kinoshka:watched',
      schema: z.array(z.number()),
      fallback: new Set<number>(),
      fromValid: ids => new Set(ids),
      toSnapshot: ids => [...ids],
    }),
  ),
)

export const watchedMovies = reatomMoviesByIds(watchedIds, 'watched.movies')
