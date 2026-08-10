import { AsyncBoundary, Footer } from '@shared/ui'
import { Header } from '@widgets/header'
import { MovieRailSkeletonDesktop } from '@widgets/movie-rail'

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
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <PopularMoviesRail />
        </AsyncBoundary>
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <TrandingSeriesRail />
        </AsyncBoundary>
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <TopAnimeRails />
        </AsyncBoundary>
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <PersonalRails />
        </AsyncBoundary>
      </div>
      <Footer />
    </div>
  )
}
