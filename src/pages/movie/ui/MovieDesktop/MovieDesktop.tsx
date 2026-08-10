import { useState } from 'react'
import { Header } from '@widgets/header'
import type { MovieDetail, MovieImage } from '@entities/movie'
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

type MovieDesktopProps = {
  movie: MovieDetail
  images: MovieImage[]
}

export const MovieDesktop = ({ movie, images }: MovieDesktopProps) => {
  const [tab, setTab] = useState('Overview')
  const [liked, setLiked] = useState<LikedState>({
    rate: false,
    list: false,
    watched: true,
    fav: false,
  })
  const related = movie.similarMovies.slice(0, 6)

  return (
    <div className={s.root}>
      <Header activeNav="movie" />
      <MovieHero movie={movie} liked={liked} onLikedChange={setLiked} />
      <MovieTabsNav tabs={TABS} activeTab={tab} onTabChange={setTab} />
      <div className={s.tabContent}>
        {tab === 'Overview' && <OverviewTab m={movie} />}
        {tab === 'Cast' && <CastTab cast={movie.cast} />}
        {tab === 'Media' && <MediaTab m={movie} images={images} />}
        {tab === 'Details' && <DetailsTab m={movie} />}
      </div>
      <RelatedMovies movies={related} movieTitle={movie.title} />
    </div>
  )
}
