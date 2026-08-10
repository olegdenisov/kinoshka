import { use } from 'react'

import { getMovieDetail } from '../api/getMovieDetail'
import { getMovieImages, type MovieImage } from '../api/getMovieImages'
import type { MovieDetail } from '../model/types'

export type MovieDetailBundle = {
  detail: MovieDetail
  images: MovieImage[]
}

const combineDetail = async (
  detailPromise: Promise<MovieDetail>,
  imagesPromise: Promise<MovieImage[]>,
): Promise<MovieDetailBundle> => {
  const [detailResult, imagesResult] = await Promise.allSettled([
    detailPromise,
    imagesPromise,
  ])

  if (detailResult.status === 'rejected') {
    throw detailResult.reason
  }

  return {
    detail: detailResult.value,
    images: imagesResult.status === 'fulfilled' ? imagesResult.value : [],
  }
}

// `Promise.allSettled(...).then(...)` создаёт новый Promise-объект на каждый вызов, даже
// если оба входных промиса — те самые стабильные ссылки из getMovieDetail/getMovieImages
// (createCachedFetcher). use() требует стабильную ссылку, пока промис не разрешится, иначе
// на каждый Suspense-ретрай — новый pending promise и бесконечный ре-саспенс (React не
// сохраняет useMemo между суспендом до первого коммита и ретраем — обычный useMemo здесь
// не спасает, это подтверждено разбором react-dom-client при пересмотре реализации).
// Решение — Map<id, entry>, где запись хранит вместе с bundlePromise те самые внутренние
// промисы, из которых он был собран (по прецеденту pageCache в getMoviesPage.ts). Стабильность
// наследуется от createCachedFetcher: пока getMovieDetail(id)/getMovieImages(id) отдают те же
// ссылки (их TTL/cooldown), bundlePromise тоже стабилен; как только внутренний кеш
// инвалидируется и отдаёт новый промис — ссылки расходятся, запись пересобирается сама,
// без ручного TTL/cooldown поверх уже закешированных фетчеров.
type BundleCacheEntry = {
  detailPromise: Promise<MovieDetail>
  imagesPromise: Promise<MovieImage[]>
  bundlePromise: Promise<MovieDetailBundle>
}

const bundleCache = new Map<number, BundleCacheEntry>()

// Экспортируется отдельно от useMovieDetail (не хук — plain function) для теста
// стабильности ссылки: см. useMovieDetail.test.tsx, "идентичность bundle-промиса".
export const getMovieDetailBundle = (
  id: number,
): Promise<MovieDetailBundle> => {
  const detailPromise = getMovieDetail(id)
  const imagesPromise = getMovieImages(id)

  const cached = bundleCache.get(id)

  if (
    cached &&
    cached.detailPromise === detailPromise &&
    cached.imagesPromise === imagesPromise
  ) {
    return cached.bundlePromise
  }

  const bundlePromise = combineDetail(detailPromise, imagesPromise)
  bundleCache.set(id, { detailPromise, imagesPromise, bundlePromise })

  return bundlePromise
}

export const useMovieDetail = (id: number): MovieDetailBundle =>
  use(getMovieDetailBundle(id))
