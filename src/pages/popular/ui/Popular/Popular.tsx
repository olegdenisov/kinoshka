import { Card, PopularBadge, popularMovies } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { watchlistIds } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent, EmptyState, Skeleton } from '@shared/ui'

import s from './Popular.module.css'

const SKELETON_COUNT = 10

const PopularSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <div key={i}>
        <Skeleton height={280} borderRadius={10} />
      </div>
    ))}
  </div>
)

const PopularGrid = reatomComponent(() => {
  const movies = popularMovies.data()

  if (movies.length === 0) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title='No popular movies right now'
          description="This week's popular list is empty. Check back later."
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
          isFavorite={favoriteIds().has(movie.id)}
          onToggleFavorite={wrap(toggleFavorite)}
          inWatchlist={watchlistIds().has(movie.id)}
          onToggleWatchlist={wrap(watchlistIds.toggle)}
          rankBadge={
            <PopularBadge
              position={movie.position}
              positionDiff={movie.positionDiff}
            />
          }
        />
      ))}
    </div>
  )
}, 'PopularGrid')

const PopularContent = reatomComponent(
  () => (
    <AsyncContent
      pending={popularMovies.status().isFirstPending}
      error={popularMovies.error()}
      onRetry={wrap(popularMovies.retry)}
      fallback={<PopularSkeletonGrid />}
    >
      <PopularGrid />
    </AsyncContent>
  ),
  'PopularContent',
)

// Навигационный chrome (Header vs MobileHeader+BottomNav) больше не выбирается здесь —
// единая точка композиции chrome теперь `AppLayout` (`src/app/layouts/AppLayout.tsx`, Task 6
// плана docs/plans/20260827-mobile-first-adaptive-layout.md), которая оборачивает роут
// `/popular` (см. `src/app/router.tsx`) и рендерит Header/MobileHeader+BottomNav снаружи.
// Popular больше не вызывает useViewport и не решает, какой chrome показать.
export const Popular = () => {
  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Popular this week</h1>
        <PopularContent />
      </main>
    </div>
  )
}
