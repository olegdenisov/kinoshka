import { Card } from '@entities/movie/ui/Card'
import type { Movie } from '@entities/movie/model/types'
import s from './SearchResultsGrid.module.css'

type SearchResultsGridProps = {
  movies: Movie[]
  onOpen: (movie: Movie) => void
}

export function SearchResultsGrid({ movies, onOpen }: SearchResultsGridProps) {
  return (
    <div className={s.grid}>
      {movies.map((m) => (
        <Card key={m.id} movie={m} variant="grid" onOpen={onOpen} />
      ))}
    </div>
  )
}
