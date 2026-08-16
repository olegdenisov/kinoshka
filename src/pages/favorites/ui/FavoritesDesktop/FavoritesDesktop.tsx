import { Card, getMoviesByIds } from '@entities/movie'
import { useFavoriteMovies, useFavorites } from '@features/favorites'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { Header } from '@widgets/header'

import s from './FavoritesDesktop.module.css'

const SKELETON_COUNT = 8

const FavoritesSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <div key={i}>
        <Skeleton height={280} borderRadius={10} />
      </div>
    ))}
  </div>
)

const FavoritesGrid = () => {
  const movies = useFavoriteMovies()
  const { isFavorite, toggle } = useFavorites()

  return (
    <div className={s.grid}>
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

export const FavoritesDesktop = () => {
  const { ids } = useFavorites()

  return (
    <div className={s.page}>
      <Header activeNav='favorites' />
      <main className={s.main}>
        <h1 className={s.heading}>Favorites</h1>
        {ids.length === 0 ? (
          <EmptyState
            title='No favorites yet'
            description='Tap the heart icon on any movie card to add it here.'
          />
        ) : (
          <AsyncBoundary
            fallback={<FavoritesSkeletonGrid />}
            onRetry={() => getMoviesByIds.invalidate(ids)}
          >
            <FavoritesGrid />
          </AsyncBoundary>
        )}
      </main>
    </div>
  )
}
