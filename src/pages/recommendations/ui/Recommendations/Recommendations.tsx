import { Card } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { useViewport } from '@shared/lib'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { Header } from '@widgets/header'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'

import {
  invalidateRecommendations,
  useRecommendedMovies,
} from '../../model/useRecommendedMovies'

import s from './Recommendations.module.css'

const SKELETON_COUNT = 8

const RecommendationsSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
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
        <Card key={movie.id} movie={movie} variant='grid' />
      ))}
    </div>
  )
}

// Навигационный chrome (Header vs MobileHeader+BottomNav) — временное useViewport-ветвление
// внутри Recommendations, тот же выбор, что зафиксирован решением Task 3/4 плана
// (docs/plans/20260827-mobile-first-adaptive-layout.md) для Favorites/Popular: единая точка
// композиции chrome появится только в Task 6 (layout-route/SiteChrome), здесь просто сведён в
// один компонент тот же выбор, который раньше делал RecommendationsPage.tsx через рендер
// RecommendationsDesktop/RecommendationsMobile.
export const Recommendations = () => {
  const { ids } = useFavorites()
  const { isMobile } = useViewport()

  return (
    <div className={s.page}>
      {isMobile ? (
        <MobileHeader title='Recommended for you' />
      ) : (
        <Header activeNav='recommendations' />
      )}

      <main className={s.main}>
        <h1 className={s.heading}>Recommended for you</h1>
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
      </main>

      {isMobile && <BottomNav active='recommendations' />}
    </div>
  )
}
