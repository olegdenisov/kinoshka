import { MovieRailDesktop } from '@widgets/movie-rail'
import { CATALOG } from '@entities/movie'
import { AsyncBoundary, Footer } from '@shared/ui'
import { Header } from '@widgets/header'
import { HeroSection } from '../HeroSection'
import s from './HomeDesktop.module.css'
import { PopularMoviesRail } from '../PopularMoviesRail'
import { TrandingSeriesRail } from '../TrandingSeriesRail'
import { TopAnimeRails } from '../TopAnimeRails'

const sections = [
  { title: 'Because you watched "Orbit of Silence"', subtitle: 'Personal', items: CATALOG.slice(6, 14) },
]

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
        
        {sections.map((section, i) => (
          <MovieRailDesktop key={i} title={section.title} subtitle={section.subtitle} items={section.items} />
        ))}
      </div>
      <Footer />
    </div>
  )
}
