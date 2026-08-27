import { Card } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'

import {
  invalidateRecommendations,
  useRecommendedMovies,
} from '../../model/useRecommendedMovies'

import s from './RecommendationsMobile.module.css'

const SKELETON_COUNT = 6

const RecommendationsSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={220} borderRadius={10} />
    ))}
  </div>
)

// Без isFavorite/onToggleFavorite — намеренно, зеркалит RecommendationsDesktop (см. Technical
// Details плана docs/plans/20260825-recommendations-rule-based.md): передача toggle сюда меняла
// бы `ids` в useFavorites() при каждом клике по сердечку → новый кэш-ключ getMoviesByIds(ids) →
// весь грид уходит в Suspense заново → новый computeRecommendationQuery → новый запрос
// getMoviesPage — полный skeleton-flash и пересчёт подборки на каждый клик.
const RecommendationsGrid = () => {
  const movies = useRecommendedMovies()

  if (movies === null) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title="Couldn't load your favorites"
          description='Something went wrong loading your favorited movies. Try again later.'
        />
      </div>
    )
  }

  if (movies.length === 0) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title='Nothing to recommend yet'
          description='Add a few more favorites to help us find matches'
        />
      </div>
    )
  }

  return (
    <div className={s.grid}>
      {movies.map(movie => (
        <Card key={movie.id} movie={movie} />
      ))}
    </div>
  )
}

export const RecommendationsMobile = () => {
  const { ids } = useFavorites()

  return (
    <div className={s.page}>
      <MobileHeader title='Recommended for you' />

      <div className={s.titleWrap}>
        <h1 className={s.title}>Recommended for you</h1>
      </div>

      {ids.length === 0 ? (
        <div className={s.stateWrap}>
          <EmptyState
            title='No favorites yet'
            description='Add movies you like to get recommendations'
          />
        </div>
      ) : (
        <AsyncBoundary
          fallback={<RecommendationsSkeletonGrid />}
          onRetry={() => invalidateRecommendations(ids)}
        >
          <RecommendationsGrid />
        </AsyncBoundary>
      )}

      <BottomNav active='recommendations' />
    </div>
  )
}
