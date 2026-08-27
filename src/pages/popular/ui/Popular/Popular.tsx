import {
  Card,
  PopularBadge,
  invalidatePopularMovies,
  usePopularMovies,
} from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { useViewport } from '@shared/lib'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'
import { Header } from '@widgets/header'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'

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

// Навигационный chrome (Header vs MobileHeader+BottomNav) — временное useViewport-ветвление
// внутри Popular, тот же выбор, что зафиксирован решением Task 3 плана
// (docs/plans/20260827-mobile-first-adaptive-layout.md) для Favorites: единая точка композиции
// chrome появится только в Task 6 (layout-route/SiteChrome), здесь просто сведён в один
// компонент тот же выбор, который раньше делал PopularPage.tsx через рендер
// PopularDesktop/PopularMobile.
export const Popular = () => {
  const { isMobile } = useViewport()

  return (
    <div className={s.page}>
      {isMobile ? (
        <MobileHeader title='Popular' />
      ) : (
        <Header activeNav='popular' />
      )}

      <main className={s.main}>
        <h1 className={s.heading}>Popular this week</h1>
        <AsyncBoundary
          fallback={<PopularSkeletonGrid />}
          onRetry={() => invalidatePopularMovies()}
        >
          <PopularGrid />
        </AsyncBoundary>
      </main>

      {isMobile && <BottomNav active='popular' />}
    </div>
  )
}
