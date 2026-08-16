import { getMoviesByIds, MobileCard } from '@entities/movie'
import { useFavoriteMovies, useFavorites } from '@features/favorites'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'

const SKELETON_COUNT = 6

const FavoritesSkeletonGrid = () => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 14,
      padding: '0 16px',
    }}
  >
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
      <div style={{ padding: '12px 20px 40px' }}>
        <EmptyState
          title="Couldn't load your favorites"
          description='Something went wrong loading your favorited movies. Try again later.'
        />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 14,
        padding: '0 16px',
      }}
    >
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
    <div
      style={{
        background: '#0F0D11',
        color: '#F2F0EF',
        minHeight: '100vh',
        paddingBottom: 80,
      }}
    >
      <MobileHeader title='Favorites' />

      <div style={{ padding: '20px 16px 12px' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          Favorites
        </h1>
      </div>

      {ids.length === 0 ? (
        <div style={{ padding: '12px 20px 40px' }}>
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
