import type { MovieDetail, MovieImage } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { watchedIds } from '@features/watched'
import { watchlistIds } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
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
export const Movie = reatomComponent(({ movie, images }: MovieProps) => {
  const [tab, setTab] = useState('Overview')
  const [liked, setLiked] = useState<LikedState>({ rate: false })
  const related = movie.similarMovies.slice(0, 6)

  return (
    <div className={s.root}>
      <MovieHero
        movie={movie}
        liked={liked}
        onLikedChange={setLiked}
        watched={watchedIds().has(movie.id)}
        onWatchedToggle={() => watchedIds.toggle(movie.id)}
        inWatchlist={watchlistIds().has(movie.id)}
        onWatchlistToggle={() => watchlistIds.toggle(movie.id)}
        favorite={favoriteIds().has(movie.id)}
        // Через toggleFavorite, а не favoriteIds.toggle: иначе не уйдёт событие `favorite added`
        onFavoriteToggle={wrap(() => toggleFavorite(movie.id))}
      />
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
}, 'Movie')
