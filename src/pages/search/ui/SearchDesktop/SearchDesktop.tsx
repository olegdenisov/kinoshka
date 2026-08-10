import { useSearchParams } from "react-router"
import { Header } from "@widgets/header"
import { SearchSidebar } from "@widgets/search-sidebar"
import { useFilterState } from "@features/catalog-filter"
import type { FilterState } from "@features/catalog-filter"
import { AsyncBoundary, EmptyState, Spinner } from "@shared/ui"
import { SearchHeader } from "../SearchHeader"
import { SearchControls } from "../SearchControls"
import {
  SearchResultsGrid,
  SearchResultSkeletonGrid,
} from "../SearchResultsGrid"
import { Pagination } from "../Pagination"
import { useMovieCatalog } from "../../model/useMovieCatalog"
import { usePageSync } from "../../model/usePageSync"
import { useCatalogUpdateStatus } from "../../model/useCatalogUpdateStatus"
import s from "./SearchDesktop.module.css"

type SearchResultsProps = {
  query: string
  filters: FilterState
  sort: string
  page: number
  displayPage: number
  onPageChange: (p: number) => void
}

/**
 * Отдельный компонент под `use()` внутри `useMovieCatalog` — Suspense должен ловить именно
 * этот узел, а не всю страницу (заголовок/сайдбар остаются интерактивными во время загрузки).
 *
 * `query`/`filters`/`sort`/`page` здесь — deferred-значения из `useCatalogUpdateStatus` (Task 6):
 * пока React их не догнал, `use()` внутри `useMovieCatalog` берёт cache-hit на старых параметрах
 * вместо повторного саспенда уже смонтированного дерева. `displayPage` — live-значение, отдельно
 * от `page`, чтобы клик по номеру страницы в `Pagination` подсвечивался мгновенно, а не только
 * после того, как deferred-фетч догонит live `page`.
 */
const SearchResults = ({
  query,
  filters,
  sort,
  page,
  displayPage,
  onPageChange,
}: SearchResultsProps) => {
  const { movies, totalPages } = useMovieCatalog({ query, filters, sort, page })

  if (movies.length === 0) {
    return (
      <>
        <EmptyState
          title="Nothing found"
          description={
            query
              ? `Ничего не найдено по «${query}»`
              : "Try adjusting the filters"
          }
        />
        {/*
          Deep-linked/устаревший ?page может указывать за пределы реальной выдачи (курсор
          закончился раньше целевой страницы — см. getMoviesPage.ts) — movies пуст, но
          totalPages всё равно приходит из total. Без Pagination тут это тупик: EmptyState
          не даёт способа вернуться на валидную страницу.
        */}
        {totalPages > 0 && (
          <Pagination
            page={displayPage}
            totalPages={totalPages}
            onChange={onPageChange}
          />
        )}
      </>
    )
  }

  return (
    <>
      {/*
        Genre round-trip (Task 9, план п.5, дефолт): API отдаёт `genres.name` по-русски,
        `Movie.genre` этих значений не переводит обратно в английский — карточки показывают
        русские жанры как есть, reverse RU→EN не делаем (принятое решение, не баг).
      */}
      <SearchResultsGrid movies={movies} />
      <Pagination
        page={displayPage}
        totalPages={totalPages}
        onChange={onPageChange}
      />
      <div className={s.countText} aria-live="polite">
        {movies.length} shown · page {displayPage} of {totalPages}
      </div>
    </>
  )
}

export const SearchDesktop = () => {
  const {
    filters,
    setFilters,
    sort,
    setSort,
    toggleGenre,
    resetFilters,
    activeChips,
  } = useFilterState()
  const [searchParams] = useSearchParams()

  const query = searchParams.get("q") ?? ""
  const isSearchMode = query.trim().length > 0
  const { page, goToPage } = usePageSync({ query, filters })
  const {
    deferredQuery,
    deferredFilters,
    deferredSort,
    deferredPage,
    isUpdating,
  } = useCatalogUpdateStatus({
    query,
    filters,
    sort,
    page,
  })

  return (
    <div className={s.page}>
      <Header variant="search" activeNav="search" />
      <div className={s.layout}>
        <SearchSidebar
          filters={filters}
          onFiltersChange={setFilters}
          onToggleGenre={toggleGenre}
          onReset={resetFilters}
          disabled={isSearchMode}
        />
        <main>
          <SearchHeader
            title={isSearchMode ? `Results for “${query}”` : "Browse catalog"}
            route="/search"
          />
          <SearchControls
            chips={activeChips}
            onClearAll={resetFilters}
            sort={sort}
            onSortChange={setSort}
            sortDisabled={isSearchMode}
          />
          <div
            className={`${s.resultsWrapper} ${isUpdating ? s.updating : ""}`}
            aria-busy={isUpdating}
          >
            <AsyncBoundary fallback={<SearchResultSkeletonGrid />}>
              <SearchResults
                query={deferredQuery}
                filters={deferredFilters}
                sort={deferredSort}
                page={deferredPage}
                displayPage={page}
                onPageChange={goToPage}
              />
            </AsyncBoundary>
            {isUpdating && (
              <div className={s.updatingBadge}>
                <Spinner size={14} />
                Updating…
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
