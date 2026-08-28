import {
  invalidateNewMovies,
  invalidatePopularMovies,
  invalidateTopRatedMovies,
} from '@entities/movie'
import { AsyncBoundary, Footer } from '@shared/ui'
import { MovieRailSkeleton } from '@widgets/movie-rail'

import { HeroSection } from '../HeroSection'
import { PersonalRails } from '../PersonalRails'
import { PopularMoviesRail } from '../PopularMoviesRail'
import { TopAnimeRails } from '../TopAnimeRails'
import { TrandingSeriesRail } from '../TrandingSeriesRail'

import s from './Home.module.css'

// Навигационный chrome (Header vs MobileHeader+BottomNav) больше не выбирается здесь —
// единая точка композиции chrome теперь `AppLayout` (`src/app/layouts/AppLayout.tsx`, Task 6
// плана docs/plans/20260827-mobile-first-adaptive-layout.md), которая оборачивает роут `/`
// (см. `src/app/router.tsx`) и рендерит Header/MobileHeader+BottomNav снаружи. Home больше не
// вызывает useViewport и не решает, какой chrome показать — обе раскладки (мобильная и
// десктопная) рендерят один и тот же контент, разница только в CSS (Home.module.css,
// HeroSection.module.css).
//
// Footer — рендерится безусловно в обоих брейкпоинтах (Task 8 решение; раньше был только в
// HomeDesktop). Footer.module.css адаптирован под mobile-first в этой же задаче (одноколоночный
// стек на мобильном, исходная 4-колоночная раскладка сохранена как `@media (min-width: 720px)`
// оверрайд) — без этого Footer выглядел бы сломанным на узких экранах (никогда не рендерился на
// мобильном брейкпоинте до этой задачи).
export const Home = () => {
  return (
    <div className={s.page}>
      <HeroSection />
      <div className={s.rails}>
        <AsyncBoundary
          fallback={<MovieRailSkeleton />}
          onRetry={() => invalidatePopularMovies()}
        >
          <PopularMoviesRail />
        </AsyncBoundary>
        <AsyncBoundary
          fallback={<MovieRailSkeleton />}
          onRetry={() => invalidateNewMovies({ type: ['tv-series'] })}
        >
          <TrandingSeriesRail />
        </AsyncBoundary>
        <AsyncBoundary
          fallback={<MovieRailSkeleton />}
          onRetry={() => invalidateTopRatedMovies({ type: ['anime'] })}
        >
          <TopAnimeRails />
        </AsyncBoundary>
        <AsyncBoundary
          fallback={<MovieRailSkeleton />}
          onRetry={() => invalidateTopRatedMovies()}
        >
          <PersonalRails />
        </AsyncBoundary>
      </div>
      <Footer />
    </div>
  )
}
