import { Card } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { useWatchlist } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'

import s from './SearchResultsGrid.module.css'

type SearchResultsGridProps = {
  movies: Movie[]
}

/**
 * Грид карточек результатов — до Task 10 использовался только `SearchDesktop`; `SearchMobile.tsx`
 * рендерил `Card` напрямую в собственном `.resultsGrid` вместо переиспользования этого
 * компонента (обнаружено при чтении кода — план предполагал, что оба варианта уже общие).
 * Единый `Search` использует этот компонент на обоих брейкпоинтах — разница (2 колонки мобильный/
 * 4 десктоп) выражена целиком в `SearchResultsGrid.module.css` через mobile-first `@media`.
 */
export const SearchResultsGrid = reatomComponent(
  ({ movies }: SearchResultsGridProps) => {
    const { isInWatchlist, toggle: toggleWatchlist } = useWatchlist()

    return (
      <div className={s.grid}>
        {movies.map(m => (
          <Card
            key={m.id}
            movie={m}
            variant='grid'
            isFavorite={favoriteIds().has(m.id)}
            onToggleFavorite={wrap(toggleFavorite)}
            inWatchlist={isInWatchlist(m.id)}
            onToggleWatchlist={toggleWatchlist}
          />
        ))}
      </div>
    )
  },
  'SearchResultsGrid',
)
