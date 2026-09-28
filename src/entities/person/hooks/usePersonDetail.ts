import { use } from 'react'

import { getPersonDetail } from '../api/getPersonDetail'
import type { PersonDetail } from '../model/types'

// В отличие от useMovieDetail здесь не нужен bundleCache: там он был нужен
// только потому, что хук комбинировал два промиса через Promise.allSettled,
// что создавало новую ссылку на bundle-промис при каждом рендере (иначе —
// бесконечный ре-саспенс). Здесь промис ровно один и приходит напрямую из
// createCachedFetcher — ссылка уже стабильна сама по себе.
export const usePersonDetail = (id: number): PersonDetail =>
  use(getPersonDetail(id))

export const invalidatePersonDetail = (id: number): void => {
  getPersonDetail.invalidate(id)
}
