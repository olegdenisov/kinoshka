import type { Movie } from '@entities/movie'
import { Card } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { useInView } from '@shared/lib'

import s from './RelatedMovies.module.css'

type RelatedMoviesProps = {
  movies: Movie[]
  movieTitle: string
}

export const RelatedMovies = ({ movies, movieTitle }: RelatedMoviesProps) => {
  const { isFavorite, toggle } = useFavorites()
  // Явный параметр типа: RefObject<HTMLElement> не присваивается ref'у <div> (инвариантность).
  const { ref, inView } = useInView<HTMLDivElement>()

  if (movies.length === 0) {
    return null
  }

  return (
    <div ref={ref} className={s.section}>
      <div className={s.header}>
        <div className={s.eyebrow}>Similar titles</div>
        <h2 className={s.heading}>More like {movieTitle}</h2>
      </div>
      <div className={`${s.grid} hide-scrollbar`}>
        {/* Пока секция не у viewport — плейсхолдеры в том же гриде вместо Card: место под
            постеры резервируется через aspect-ratio, без хардкод-высоты под брейкпоинт. */}
        {inView
          ? movies.map(x => (
              <Card
                key={x.id}
                movie={x}
                variant='grid'
                isFavorite={isFavorite(x.id)}
                onToggleFavorite={toggle}
              />
            ))
          : movies.map(x => (
              <div key={x.id} className={s.placeholderCard} aria-hidden />
            ))}
      </div>
    </div>
  )
}
