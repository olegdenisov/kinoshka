import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

const themeSchema = z.enum(['light', 'dark', 'system'])

export type Theme = z.infer<typeof themeSchema>

export const themeSlot = createStorageSlot(
  'kinoshka:theme',
  themeSchema,
  'system',
)
