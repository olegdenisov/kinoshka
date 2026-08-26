import { Card } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { Header } from '@widgets/header'

import {
  invalidateRecommendations,
  useRecommendedMovies,
} from '../../model/useRecommendedMovies'

import s from './RecommendationsDesktop.module.css'

const SKELETON_COUNT = 8

const RecommendationsSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <div key={i}>
        <Skeleton height={280} borderRadius={10} />
      </div>
    ))}
  </div>
)

// Без isFavorite/onToggleFavorite — намеренно (см. Technical Details плана
// docs/plans/20260825-recommendations-rule-based.md): передача toggle сюда меняла бы
// `ids` в useFavorites() при каждом клике по сердечку → новый кэш-ключ getMoviesByIds(ids)
// → весь грид уходит в Suspense заново → новый computeRecommendationQuery → новый запрос
// getMoviesPage — полный skeleton-flash и пересчёт подборки на каждый клик.
const RecommendationsGrid = () => {
  const movies = useRecommendedMovies()

  if (movies === null) {
    return (
      <EmptyState
        title="Couldn't load your favorites"
        description='Something went wrong loading your favorited movies. Try again later.'
      />
    )
  }

  if (movies.length === 0) {
    return (
      <EmptyState
        title='Nothing to recommend yet'
        description='Add a few more favorites to help us find matches'
      />
    )
  }

  return (
    <div className={s.grid}>
      {movies.map(movie => (
        <Card key={movie.id} movie={movie} variant='grid' />
      ))}
    </div>
  )
}

export const RecommendationsDesktop = () => {
  const { ids } = useFavorites()

  return (
    <div className={s.page}>
      <Header activeNav='recommendations' />
      <main className={s.main}>
        <h1 className={s.heading}>Recommended for you</h1>
        {ids.length === 0 ? (
          <EmptyState
            title='No favorites yet'
            description='Add movies you like to get recommendations'
          />
        ) : (
          <AsyncBoundary
            fallback={<RecommendationsSkeletonGrid />}
            onRetry={() => invalidateRecommendations(ids)}
          >
            <RecommendationsGrid />
          </AsyncBoundary>
        )}
      </main>
    </div>
  )
}
