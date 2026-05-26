import { useNavigate } from 'react-router'
import type { Movie } from '@entities/movie'
import { Card } from '@entities/movie'
import s from './RelatedMovies.module.css'

type RelatedMoviesProps = {
  movies: Movie[]
  movieTitle: string
}

export function RelatedMovies({ movies, movieTitle }: RelatedMoviesProps) {
  const navigate = useNavigate()
  return (
    <div className={s.section}>
      <div className={s.header}>
        <div className={s.eyebrow}>Similar titles</div>
        <h2 className={s.heading}>More like {movieTitle}</h2>
      </div>
      <div className={s.grid}>
        {movies.map((x) => (
          <Card key={x.id} movie={x} variant="grid" onOpen={(m) => navigate(`/movie/${m.id}`)} />
        ))}
      </div>
    </div>
  )
}
