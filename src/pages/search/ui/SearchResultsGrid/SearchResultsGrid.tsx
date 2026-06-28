import { Card } from '@entities/movie'
import type { Movie } from '@entities/movie'
import s from './SearchResultsGrid.module.css'

type SearchResultsGridProps = {
  movies: Movie[]
}

export const SearchResultsGrid = ({ movies }: SearchResultsGridProps) => {
  return (
    <div className={s.grid}>
      {movies.map((m) => (
        <Card key={m.id} movie={m} variant="grid" />
      ))}
    </div>
  )
}
