import { reatomSet, withLocalStorage } from '@reatom/core'
import { persistOptions } from '@shared/lib'
import { z } from 'zod'

export const watchlistIds = reatomSet<number>([], 'watchlist.ids').extend(
  withLocalStorage(
    persistOptions({
      key: 'kinoshka:watchlist',
      schema: z.array(z.number()),
      fallback: new Set<number>(),
      fromValid: ids => new Set(ids),
      toSnapshot: ids => [...ids],
    }),
  ),
)
