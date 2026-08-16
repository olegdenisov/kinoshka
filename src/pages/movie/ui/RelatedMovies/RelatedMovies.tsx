import type { Movie } from '@entities/movie'
import { Card } from '@entities/movie'
import { useFavorites } from '@features/favorites'

import s from './RelatedMovies.module.css'

type RelatedMoviesProps = {
  movies: Movie[]
  movieTitle: string
}

export const RelatedMovies = ({ movies, movieTitle }: RelatedMoviesProps) => {
  const { isFavorite, toggle } = useFavorites()

  if (movies.length === 0) {
    return null
  }

  return (
    <div className={s.section}>
      <div className={s.header}>
        <div className={s.eyebrow}>Similar titles</div>
        <h2 className={s.heading}>More like {movieTitle}</h2>
      </div>
      <div className={s.grid}>
        {movies.map(x => (
          <Card
            key={x.id}
            movie={x}
            variant='grid'
            isFavorite={isFavorite(x.id)}
            onToggleFavorite={toggle}
          />
        ))}
      </div>
    </div>
  )
}
