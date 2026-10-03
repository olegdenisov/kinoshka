import { Card } from '@entities/movie'
import {
  favoriteIds,
  favoriteMovies,
  toggleFavorite,
} from '@features/favorites'
import { watchlistIds } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent, EmptyState, Skeleton } from '@shared/ui'

import s from './Favorites.module.css'

const SKELETON_COUNT = 8

const FavoritesSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
    ))}
  </div>
)

const FavoritesGrid = reatomComponent(() => {
  const movies = favoriteMovies.data()

  if (movies.length === 0) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title="Couldn't load your favorites"
          description='Something went wrong loading your favorited movies. Try again later.'
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
        />
      ))}
    </div>
  )
}, 'FavoritesGrid')

// Навигационный chrome (Header vs MobileHeader+BottomNav) больше не выбирается здесь —
// единая точка композиции chrome теперь `AppLayout` (`src/app/layouts/AppLayout.tsx`, Task 6
// плана docs/plans/20260827-mobile-first-adaptive-layout.md), которая оборачивает роут
// `/favorites` (см. `src/app/routes.tsx`) и рендерит Header/MobileHeader+BottomNav снаружи.
// Favorites больше не вызывает useViewport и не решает, какой chrome показать.
export const Favorites = reatomComponent(() => {
  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Favorites</h1>
        {favoriteIds().size === 0 ? (
          <div className={s.stateWrap}>
            <EmptyState
              title='No favorites yet'
              description='Tap the heart icon on any movie card to add it here.'
            />
          </div>
        ) : (
          <AsyncContent
            pending={favoriteMovies.status().isFirstPending}
            error={favoriteMovies.error()}
            onRetry={wrap(favoriteMovies.retry)}
            fallback={<FavoritesSkeletonGrid />}
          >
            <FavoritesGrid />
          </AsyncContent>
        )}
      </main>
    </div>
  )
}, 'Favorites')
