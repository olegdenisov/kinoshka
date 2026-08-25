import {
  Card,
  PopularBadge,
  invalidatePopularMovies,
  usePopularMovies,
} from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { Header } from '@widgets/header'

import s from './PopularDesktop.module.css'

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

const PopularGrid = () => {
  const movies = usePopularMovies()
  const { isFavorite, toggle } = useFavorites()

  if (movies.length === 0) {
    return (
      <EmptyState
        title='No popular movies right now'
        description="This week's popular list is empty. Check back later."
      />
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

export const PopularDesktop = () => {
  return (
    <div className={s.page}>
      <Header activeNav='popular' />
      <main className={s.main}>
        <h1 className={s.heading}>Popular this week</h1>
        <AsyncBoundary
          fallback={<PopularSkeletonGrid />}
          onRetry={() => invalidatePopularMovies()}
        >
          <PopularGrid />
        </AsyncBoundary>
      </main>
    </div>
  )
}
