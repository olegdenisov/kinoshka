import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Header } from '@widgets/header'
import { SearchSidebar } from '@widgets/search-sidebar'
import { useFilterState } from '@features/catalog-filter'
import { CATALOG } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { SearchHeader } from '../SearchHeader'
import { SearchControls } from '../SearchControls'
import { SearchResultsGrid } from '../SearchResultsGrid'
import { Pagination } from '../Pagination'
import s from './SearchDesktop.module.css'

const TOTAL_RESULTS = 2846
const PER_PAGE = 16
const TOTAL_PAGES = Math.ceil(TOTAL_RESULTS / PER_PAGE)

export const SearchDesktop = () => {
  const navigate = useNavigate()
  const { filters, setFilters, sort, setSort, toggleGenre, resetFilters, activeChips } = useFilterState()
  const [page, setPage] = useState(1)

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(TOTAL_PAGES, p)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openMovie = (movie: Movie) => navigate(`/movie/${movie.id}`)

  return (
    <div className={s.page}>
      <Header variant="search" activeNav="search" />
      <div className={s.layout}>
        <SearchSidebar filters={filters} onFiltersChange={setFilters} onToggleGenre={toggleGenre} onReset={resetFilters} />
        <main>
          <SearchHeader title="Drama films, 2020 onwards" resultsCount={TOTAL_RESULTS} route="/search" />
          <SearchControls chips={activeChips} onClearAll={resetFilters} sort={sort} onSortChange={setSort} />
          <SearchResultsGrid movies={CATALOG} onOpen={openMovie} />
          <Pagination page={page} totalPages={TOTAL_PAGES} onChange={goToPage} />
          <div className={s.countText}>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, TOTAL_RESULTS)} of {TOTAL_RESULTS.toLocaleString()}
          </div>
        </main>
      </div>
    </div>
  )
}
