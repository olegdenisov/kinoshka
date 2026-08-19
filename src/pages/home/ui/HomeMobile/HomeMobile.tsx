import { CATALOG } from '@entities/movie'
import { SearchIcon } from '@shared/ui'
import { MobileHeader, BottomNav } from '@widgets/mobile-chrome'
import { MovieRailMobile } from '@widgets/movie-rail'
import { useState } from 'react'
import { Link } from 'react-router'

import s from './HomeMobile.module.css'

export const HomeMobile = () => {
  const [activeFilter, setActiveFilter] = useState('all')

  const chips = [
    { key: 'all', label: 'All' },
    { key: 'movies', label: 'Movies' },
    { key: 'series', label: 'Series' },
    { key: 'anime', label: 'Anime' },
  ]

  const sections = [
    {
      title: 'Popular this week',
      subtitle: 'Watching now',
      items: CATALOG.slice(0, 8),
    },
    {
      title: 'Trending series',
      subtitle: 'Binge-worthy',
      items: CATALOG.filter(m => m.type === 'tv-series')
        .concat(CATALOG.slice(0, 4))
        .slice(0, 8),
    },
    {
      title: 'Top anime',
      subtitle: 'Hand-picked',
      items: CATALOG.filter(m => m.type === 'anime')
        .concat(CATALOG.slice(4, 8))
        .slice(0, 8),
    },
    { title: 'For you', subtitle: 'Personal', items: CATALOG.slice(6, 14) },
  ]

  return (
    <div className={s.page}>
      <MobileHeader />

      <section className={s.hero}>
        <div className={s.heroBgWrap}>
          <div className={s.heroGradientBlobs} />
          <div className={s.heroFade} />
        </div>

        <div className={s.heroContent}>
          <div className={s.badge}>
            <span className={s.badgeDot} />
            <span>148,230 titles</span>
          </div>

          <h1 className={s.heading}>
            What do you <em className={s.headingAccent}>want</em> to watch
            <span className={s.headingPunct}>?</span>
          </h1>

          <Link to='/search' className={s.searchBar}>
            <SearchIcon size={16} />
            <span>Search films, series, anime…</span>
          </Link>

          <div className={`hide-scrollbar ${s.chips}`}>
            {chips.map(c => (
              <button
                type='button'
                key={c.key}
                onClick={() => setActiveFilter(c.key)}
                className={`${s.chip} ${activeFilter === c.key ? s.chipActive : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className={s.rails}>
        {sections.map((section, i) => (
          <MovieRailMobile
            key={i}
            title={section.title}
            subtitle={section.subtitle}
            items={section.items}
          />
        ))}
      </div>

      <BottomNav active='home' />
    </div>
  )
}
