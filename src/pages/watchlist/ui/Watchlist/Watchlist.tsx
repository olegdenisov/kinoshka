import { Card } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { useWatchlist, useWatchlistMovies } from '@features/watchlist'
import { EmptyState, QueryBoundary, Skeleton } from '@shared/ui'

import s from './Watchlist.module.css'

const SKELETON_COUNT = 8

const WatchlistSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
    ))}
  </div>
)

type WatchlistGridProps = { movies: Movie[] }

const WatchlistGrid = ({ movies }: WatchlistGridProps) => {
  // Пусто здесь = все id ответили 404 (удалены из каталога); восстановимые сбои отдаёт
  // endpoint getMoviesByIds как ошибку, её ловит QueryBoundary, поэтому текст — не про
  // ошибку загрузки.
  const { isFavorite, toggle } = useFavorites()

  if (movies.length === 0) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title='Watchlist titles unavailable'
          description='These titles are no longer available in the catalog.'
        />
      </div>
    )
  }

  return (
    <div className={s.grid}>
      {/* Без onToggleWatchlist намеренно: снятие меняет ids → новый аргумент getMoviesByIds →
          перезапрос всего списка. Убрать из списка можно со страницы фильма или с других списков. */}
      {movies.map(movie => (
        <Card
          key={movie.id}
          movie={movie}
          variant='grid'
          isFavorite={isFavorite(movie.id)}
          onToggleFavorite={toggle}
        />
      ))}
    </div>
  )
}

// Композиция features/entities прямо в UI — по образцу `Favorites` (без `model/`-фасада).
// Chrome (Header/MobileHeader+BottomNav) рисует `AppLayout`, страница его не выбирает.
export const Watchlist = () => {
  const { ids } = useWatchlist()
  const query = useWatchlistMovies()

  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Watchlist</h1>
        {ids.length === 0 ? (
          <div className={s.stateWrap}>
            <EmptyState
              title='Nothing in your watchlist yet'
              description='Tap Watchlist on any movie or series page to add it here.'
            />
          </div>
        ) : (
          <QueryBoundary query={query} fallback={<WatchlistSkeletonGrid />}>
            {movies => <WatchlistGrid movies={movies} />}
          </QueryBoundary>
        )}
      </main>
    </div>
  )
}
