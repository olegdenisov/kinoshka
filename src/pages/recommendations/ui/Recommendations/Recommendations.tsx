import { Card } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { useWatchlist } from '@features/watchlist'
import { EmptyState, QueryBoundary, Skeleton } from '@shared/ui'

import { useRecommendedMovies } from '../../model/useRecommendedMovies'

import s from './Recommendations.module.css'

const SKELETON_COUNT = 8

const RecommendationsSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
    ))}
  </div>
)

// Без isFavorite/onToggleFavorite — намеренно: клик по сердечку меняет вход правила (избранное) →
// инвалидация тега Recommendations → подборка пересчитывается и перестраивается прямо под курсором.
// Watchlist подключён спокойно: подборка от него не зависит.
type RecommendationsGridProps = { movies: Movie[] | null }

const RecommendationsGrid = ({ movies }: RecommendationsGridProps) => {
  const { isInWatchlist, toggle: toggleWatchlist } = useWatchlist()

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
        <Card
          key={movie.id}
          movie={movie}
          variant='grid'
          inWatchlist={isInWatchlist(movie.id)}
          onToggleWatchlist={toggleWatchlist}
        />
      ))}
    </div>
  )
}

// Навигационный chrome (Header vs MobileHeader+BottomNav) больше не выбирается здесь —
// единая точка композиции chrome теперь `AppLayout` (`src/app/layouts/AppLayout.tsx`, Task 6
// плана docs/plans/20260827-mobile-first-adaptive-layout.md), которая оборачивает роут
// `/recommendations` (см. `src/app/router.tsx`) и рендерит Header/MobileHeader+BottomNav
// снаружи. Recommendations больше не вызывает useViewport и не решает, какой chrome показать.
export const Recommendations = () => {
  const { ids } = useFavorites()
  const query = useRecommendedMovies()

  return (
    <div className={s.page}>
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
          <QueryBoundary
            query={query}
            fallback={<RecommendationsSkeletonGrid />}
          >
            {movies => <RecommendationsGrid movies={movies} />}
          </QueryBoundary>
        )}
      </main>
    </div>
  )
}
