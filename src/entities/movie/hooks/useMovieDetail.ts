import { use } from "react"
import type { MovieDetail } from "../model/types"
import { getMovieDetail } from "../api/getMovieDetail"
import { getMovieImages, type MovieImage } from "../api/getMovieImages"

export type MovieDetailBundle = {
  detail: MovieDetail
  images: MovieImage[]
}

const combineDetail = async (
  detailPromise: Promise<MovieDetail>,
  imagesPromise: Promise<MovieImage[]>,
): Promise<MovieDetailBundle> => {
  const [detailResult, imagesResult] = await Promise.allSettled([detailPromise, imagesPromise])

  if (detailResult.status === 'rejected') {
    throw detailResult.reason
  }

  return {
    detail: detailResult.value,
    images: imagesResult.status === 'fulfilled' ? imagesResult.value : [],
  }
}

// `Promise.allSettled(...).then(...)` создаёt новый Promise-объект на каждый вызов, даже
// если оба входных промиса — те самые стабильные ссылки из getMovieDetail/getMovieImages
// (createCachedFetcher). use() требует стабильную ссылку, пока промис не разрешится, иначе
// на каждый Suspense-ретрай — новый pending promise и бесконечный ре-саспенс (React не
// сохраняет useMemo между суспендом до первого коммита и ретраем — обычный useMemo здесь
// не спасает, это подтверждено разбором react-dom-client при пересмотре реализации).
// Решение — WeakMap, ключ которого сами уже-закешированные внутренние промисы: пока
// getMovieDetail(id)/getMovieImages(id) отдают ту же ссылку (их собственные TTL/cooldown
// внутри createCachedFetcher), связка тоже стабильна; как только внутренний кеш инвалидируется
// и отдаёт новый промис — WeakMap-запись естественно "устаревает" без ручного TTL/cooldown.
const bundleCache = new WeakMap<Promise<MovieDetail>, WeakMap<Promise<MovieImage[]>, Promise<MovieDetailBundle>>>()

const getMovieDetailBundle = (id: number): Promise<MovieDetailBundle> => {
  const detailPromise = getMovieDetail(id)
  const imagesPromise = getMovieImages(id)

  let byImagesPromise = bundleCache.get(detailPromise)

  if (!byImagesPromise) {
    byImagesPromise = new WeakMap()
    bundleCache.set(detailPromise, byImagesPromise)
  }

  const cached = byImagesPromise.get(imagesPromise)

  if (cached) {
    return cached
  }

  const bundlePromise = combineDetail(detailPromise, imagesPromise)
  byImagesPromise.set(imagesPromise, bundlePromise)

  return bundlePromise
}

export const useMovieDetail = (id: number): MovieDetailBundle => use(getMovieDetailBundle(id))
