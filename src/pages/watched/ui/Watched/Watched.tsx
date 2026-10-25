import { Card } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { useWatched, useWatchedMovies } from '@features/watched'
import { useWatchlist } from '@features/watchlist'
import { EmptyState, QueryBoundary, Skeleton } from '@shared/ui'

import s from './Watched.module.css'

const SKELETON_COUNT = 8

const WatchedSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
    ))}
  </div>
)

type WatchedGridProps = { movies: Movie[] }

const WatchedGrid = ({ movies }: WatchedGridProps) => {
  // Пусто здесь = все id ответили 404 (удалены из каталога); восстановимые сбои отдаёт
  // endpoint getMoviesByIds как ошибку, её ловит QueryBoundary, поэтому текст — не про
  // ошибку загрузки.
  const { isFavorite, toggle } = useFavorites()
  const { isInWatchlist, toggle: toggleWatchlist } = useWatchlist()

  if (movies.length === 0) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title='Watched titles unavailable'
          description='These titles are no longer available in the catalog.'
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
          isFavorite={isFavorite(movie.id)}
          onToggleFavorite={toggle}
          inWatchlist={isInWatchlist(movie.id)}
          onToggleWatchlist={toggleWatchlist}
        />
      ))}
    </div>
  )
}

// Композиция features/entities прямо в UI — по образцу `Favorites` (без `model/`-фасада).
// Chrome (Header/MobileHeader+BottomNav) рисует `AppLayout`, страница его не выбирает.
export const Watched = () => {
  const { ids } = useWatched()
  const query = useWatchedMovies()

  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Watched</h1>
        {ids.length === 0 ? (
          <div className={s.stateWrap}>
            <EmptyState
              title='No watched titles yet'
              description='Tap Watched on any movie or series page to add it here.'
            />
          </div>
        ) : (
          <QueryBoundary query={query} fallback={<WatchedSkeletonGrid />}>
            {movies => <WatchedGrid movies={movies} />}
          </QueryBoundary>
        )}
      </main>
    </div>
  )
}
