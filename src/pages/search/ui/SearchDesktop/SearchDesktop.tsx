import { useState } from 'react'
import { Header } from '@widgets/header'
import { SearchSidebar } from '@widgets/search-sidebar'
import { useFilterState } from '@features/catalog-filter'
import { CATALOG } from '@entities/movie'
import { SearchHeader } from '../SearchHeader'
import { SearchControls } from '../SearchControls'
import { SearchResultsGrid, SearchResultSkeletonGrid } from '../SearchResultsGrid'
import { Pagination } from '../Pagination'
import s from './SearchDesktop.module.css'
import { AsyncBoundary } from '@shared/ui'
import { useSearch } from '@entities/movie'

const TOTAL_RESULTS = 2846
const PER_PAGE = 16
const TOTAL_PAGES = Math.ceil(TOTAL_RESULTS / PER_PAGE)

export const SearchDesktop = () => {
  const { filters, setFilters, sort, setSort, toggleGenre, resetFilters, activeChips } = useFilterState()
  const [page, setPage] = useState(1)

  useSearch({ query: filters.query, page })

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(TOTAL_PAGES, p)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={s.page}>
      <Header variant="search" activeNav="search" />
      <div className={s.layout}>
        <SearchSidebar filters={filters} onFiltersChange={setFilters} onToggleGenre={toggleGenre} onReset={resetFilters} />
        <main>
          <SearchHeader title="Drama films, 2020 onwards" resultsCount={TOTAL_RESULTS} route="/search" />
          <SearchControls chips={activeChips} onClearAll={resetFilters} sort={sort} onSortChange={setSort} />
          <AsyncBoundary fallback={<SearchResultSkeletonGrid />}>
            <SearchResultsGrid movies={CATALOG} />
          </AsyncBoundary>
          <Pagination page={page} totalPages={TOTAL_PAGES} onChange={goToPage} />
          <div className={s.countText}>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, TOTAL_RESULTS)} of {TOTAL_RESULTS.toLocaleString()}
          </div>
        </main>
      </div>
    </div>
  )
}
