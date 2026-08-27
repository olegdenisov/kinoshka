import {
  Card,
  PopularBadge,
  invalidatePopularMovies,
  usePopularMovies,
} from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'

import s from './PopularMobile.module.css'

const SKELETON_COUNT = 6

const PopularSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={220} borderRadius={10} />
    ))}
  </div>
)

const PopularGrid = () => {
  const movies = usePopularMovies()
  const { isFavorite, toggle } = useFavorites()

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
          isFavorite={isFavorite(movie.id)}
          onToggleFavorite={toggle}
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
}

export const PopularMobile = () => {
  return (
    <div className={s.page}>
      <MobileHeader title='Popular' />

      <div className={s.titleWrap}>
        <h1 className={s.title}>Popular this week</h1>
      </div>

      <AsyncBoundary
        fallback={<PopularSkeletonGrid />}
        onRetry={() => invalidatePopularMovies()}
      >
        <PopularGrid />
      </AsyncBoundary>

      <BottomNav active='popular' />
    </div>
  )
}
