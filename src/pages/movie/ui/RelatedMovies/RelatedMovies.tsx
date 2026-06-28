import type { Movie } from '@entities/movie'
import { Card } from '@entities/movie'
import s from './RelatedMovies.module.css'

type RelatedMoviesProps = {
  movies: Movie[]
  movieTitle: string
}

export const RelatedMovies = ({ movies, movieTitle }: RelatedMoviesProps) => {
  return (
    <div className={s.section}>
      <div className={s.header}>
        <div className={s.eyebrow}>Similar titles</div>
        <h2 className={s.heading}>More like {movieTitle}</h2>
      </div>
      <div className={s.grid}>
        {movies.map((x) => (
          <Card key={x.id} movie={x} variant="grid" />
        ))}
      </div>
    </div>
  )
}
