import { Card, getMoviesByIds } from '@entities/movie'
import { useFavoriteMovies, useFavorites } from '@features/favorites'
import { useViewport } from '@shared/lib'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { Header } from '@widgets/header'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'

import s from './Favorites.module.css'

const SKELETON_COUNT = 8

const FavoritesSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
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

// Навигационный chrome (Header vs MobileHeader+BottomNav) — временное useViewport-ветвление
// внутри Favorites, как зафиксировано решением Task 3 плана
// (docs/plans/20260827-mobile-first-adaptive-layout.md): единая точка композиции chrome
// появится только в Task 6 (layout-route/SiteChrome), здесь просто сведён в один компонент тот
// же выбор, который раньше делал FavoritesPage.tsx через рендер FavoritesDesktop/FavoritesMobile.
export const Favorites = () => {
  const { ids } = useFavorites()
  const { isMobile } = useViewport()

  return (
    <div className={s.page}>
      {isMobile ? (
        <MobileHeader title='Favorites' />
      ) : (
        <Header activeNav='favorites' />
      )}

      <main className={s.main}>
        <h1 className={s.heading}>Favorites</h1>
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
      </main>

      {isMobile && <BottomNav active='lists' />}
    </div>
  )
}
