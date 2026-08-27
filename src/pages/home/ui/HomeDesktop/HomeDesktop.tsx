import {
  invalidateNewMovies,
  invalidatePopularMovies,
  invalidateTopRatedMovies,
} from '@entities/movie'
import { AsyncBoundary, Footer } from '@shared/ui'
import { Header } from '@widgets/header'
import { MovieRailSkeleton } from '@widgets/movie-rail'

import { HeroSection } from '../HeroSection'
import { PersonalRails } from '../PersonalRails'
import { PopularMoviesRail } from '../PopularMoviesRail'
import { TopAnimeRails } from '../TopAnimeRails'
import { TrandingSeriesRail } from '../TrandingSeriesRail'

import s from './HomeDesktop.module.css'

export const HomeDesktop = () => {
  return (
    <div className={s.root}>
      <Header activeNav='home' />
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
