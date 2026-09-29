import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

const watchlistSchema = z.array(z.number())

export const watchlistSlot = createStorageSlot(
  'kinoshka:watchlist',
  watchlistSchema,
  [],
)
