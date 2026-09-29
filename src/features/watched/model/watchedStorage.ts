import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

const watchedSchema = z.array(z.number())

export const watchedSlot = createStorageSlot(
  'kinoshka:watched',
  watchedSchema,
  [],
)
