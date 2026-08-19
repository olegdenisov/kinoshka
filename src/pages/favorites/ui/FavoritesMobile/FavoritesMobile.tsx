import { getMoviesByIds, MobileCard } from '@entities/movie'
import { useFavoriteMovies, useFavorites } from '@features/favorites'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'

import s from './FavoritesMobile.module.css'

const SKELETON_COUNT = 6

const FavoritesSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={220} borderRadius={10} />
    ))}
  </div>
)

const FavoritesGrid = () => {
  const movies = useFavoriteMovies()
  const { isFavorite, toggle } = useFavorites()

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
        <MobileCard
          key={movie.id}
          movie={movie}
          isFavorite={isFavorite(movie.id)}
          onToggleFavorite={toggle}
        />
      ))}
    </div>
  )
}

export const FavoritesMobile = () => {
  const { ids } = useFavorites()

  return (
    <div className={s.page}>
      <MobileHeader title='Favorites' />

      <div className={s.titleWrap}>
        <h1 className={s.title}>Favorites</h1>
      </div>

      {ids.length === 0 ? (
        <div className={s.stateWrap}>
          <EmptyState
            title='No favorites yet'
            description='Tap the heart icon on any movie card to add it here.'
          />
        </div>
      ) : (
        <AsyncBoundary
          fallback={<FavoritesSkeletonGrid />}
          onRetry={() => getMoviesByIds.invalidate(ids)}
        >
          <FavoritesGrid />
        </AsyncBoundary>
      )}

      <BottomNav active='lists' />
    </div>
  )
}
