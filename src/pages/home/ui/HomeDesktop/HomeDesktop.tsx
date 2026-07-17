import { AsyncBoundary, Footer } from '@shared/ui'
import { Header } from '@widgets/header'
import { HeroSection } from '../HeroSection'
import s from './HomeDesktop.module.css'
import { PopularMoviesRail } from '../PopularMoviesRail'
import { TrandingSeriesRail } from '../TrandingSeriesRail'
import { TopAnimeRails } from '../TopAnimeRails'
import { PersonalRails } from '../PersonalRails'

export const HomeDesktop = () => {
  return (
    <div className={s.root}>
      <Header activeNav="home" />
      <HeroSection />
      <div className={s.rails}>
        <AsyncBoundary>
          <PopularMoviesRail />
        </AsyncBoundary>
        <AsyncBoundary>
          <TrandingSeriesRail />
        </AsyncBoundary>
        <AsyncBoundary>
          <TopAnimeRails />
        </AsyncBoundary>
        <AsyncBoundary>
          <PersonalRails />
        </AsyncBoundary>
      </div>
      <Footer />
    </div>
  )
}
