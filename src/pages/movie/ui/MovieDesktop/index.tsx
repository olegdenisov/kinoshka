import { useState } from 'react'
import { Header } from '@widgets/header/ui/Header'
import { CATALOG } from '@entities/movie/model/catalog'
import type { Movie } from '@entities/movie/model/types'
import { OverviewTab } from '../tabs/OverviewTab'
import { CastTab } from '../tabs/CastTab'
import { MediaTab } from '../tabs/MediaTab'
import { DetailsTab } from '../tabs/DetailsTab'
import { MovieHero } from '../MovieHero'
import { MovieTabsNav } from '../MovieTabsNav'
import { RelatedMovies } from '../RelatedMovies'
import type { LikedState } from './types'
import s from './MovieDesktop.module.css'

export type { LikedState }

const TABS = ['Overview', 'Cast', 'Media', 'Details']

export function MovieDesktop({ movie }: { movie: Movie }) {
  const [tab, setTab] = useState('Overview')
  const [liked, setLiked] = useState<LikedState>({ rate: false, list: false, watched: true, fav: false })
  const related = CATALOG.filter((x) => x.id !== movie.id).slice(0, 6)

  return (
    <div className={s.root}>
      <Header activeNav="movie" />
      <MovieHero movie={movie} liked={liked} onLikedChange={setLiked} />
      <MovieTabsNav tabs={TABS} activeTab={tab} onTabChange={setTab} />
      <div className={s.tabContent}>
        {tab === 'Overview' && <OverviewTab m={movie} />}
        {tab === 'Cast' && <CastTab />}
        {tab === 'Media' && <MediaTab m={movie} />}
        {tab === 'Details' && <DetailsTab m={movie} />}
      </div>
      <RelatedMovies movies={related} movieTitle={movie.title} />
    </div>
  )
}
