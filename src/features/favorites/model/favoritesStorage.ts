import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

const favoritesSchema = z.array(z.number())

export const favoritesSlot = createStorageSlot(
  'kinoshka:favorites',
  favoritesSchema,
  [],
)
