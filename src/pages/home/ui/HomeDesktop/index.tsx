import { MovieRailDesktop } from '@widgets/movie-rail'
import { CATALOG } from '@entities/movie'
import { Footer } from '@shared/ui'
import { Header } from '@widgets/header'
import { HeroSection } from '../HeroSection'
import s from './HomeDesktop.module.css'

const sections = [
  { title: 'Popular this week', subtitle: 'What everyone is watching', items: CATALOG.slice(0, 7) },
  { title: 'Trending series', subtitle: 'Binge-worthy', items: CATALOG.filter((m) => m.type === 'series').concat(CATALOG.slice(0, 3)).slice(0, 7) },
  { title: 'Top anime', subtitle: 'Hand-picked', items: CATALOG.filter((m) => m.type === 'anime').concat(CATALOG.slice(4, 8)).slice(0, 7) },
  { title: 'Because you watched "Orbit of Silence"', subtitle: 'Personal', items: CATALOG.slice(6, 14) },
]

export function HomeDesktop() {
  return (
    <div className={s.root}>
      <Header activeNav="home" />
      <HeroSection />
      <div className={s.rails}>
        {sections.map((section, i) => (
          <MovieRailDesktop key={i} title={section.title} subtitle={section.subtitle} items={section.items} />
        ))}
      </div>
      <Footer />
    </div>
  )
}
