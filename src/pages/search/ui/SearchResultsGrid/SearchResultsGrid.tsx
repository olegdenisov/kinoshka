import { Card } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { useFavorites } from '@features/favorites'

import s from './SearchResultsGrid.module.css'

type SearchResultsGridProps = {
  movies: Movie[]
}

export const SearchResultsGrid = ({ movies }: SearchResultsGridProps) => {
  const { isFavorite, toggle } = useFavorites()

  return (
    <div className={s.grid}>
      {movies.map(m => (
        <Card
          key={m.id}
          movie={m}
          variant='grid'
          isFavorite={isFavorite(m.id)}
          onToggleFavorite={toggle}
        />
      ))}
    </div>
  )
}
