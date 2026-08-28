import type { MovieDetail, MovieImage } from '@entities/movie'
import { useState } from 'react'

import { MovieHero } from '../MovieHero'
import { MovieTabsNav } from '../MovieTabsNav'
import { RelatedMovies } from '../RelatedMovies'
import { CastTab } from '../tabs/CastTab'
import { DetailsTab } from '../tabs/DetailsTab'
import { MediaTab } from '../tabs/MediaTab'
import { OverviewTab } from '../tabs/OverviewTab'
import type { LikedState } from '../types'

import s from './Movie.module.css'

const TABS = ['Overview', 'Cast', 'Media', 'Details']

type MovieProps = {
  movie: MovieDetail
  images: MovieImage[]
}

// Слияние MovieDesktop/MovieMobile (Task 9 плана docs/plans/20260827-mobile-first-adaptive-layout.md):
// навигационный chrome (Header/MobileHeader+BottomNav) сюда не переехал — им теперь владеет
// AppLayout (Task 6/9, см. MOVIE_CHROME в src/app/layouts/AppLayout.tsx), Movie отвечает только
// за контент страницы. Раскладка/размеры меняются через CSS (Movie.module.css, MovieHero.module.css,
// MovieTabsNav.module.css, RelatedMovies.module.css, ui/tabs/*/*.module.css — все переведены на
// mobile-first `@media (min-width: 720px)`), JS-дерево одно и то же на обоих брейкпоинтах.
export const Movie = ({ movie, images }: MovieProps) => {
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
