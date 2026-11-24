import {
  ActiveFilterChips,
  activeChips,
  FilterGroup,
  FilterPanel,
  filters as filtersAtom,
  goToPage,
  page,
  removeFilterChip,
  resetFilters,
  searchQuery,
  setFilters,
  setSort,
  sort as sortAtom,
  SORT_LABELS,
} from '@features/catalog-filter'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { useViewport } from '@shared/lib'
import {
  AsyncContent,
  EmptyState,
  Spinner,
  FilterIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@shared/ui'
import { BottomSheet } from '@widgets/mobile-chrome'
import { SearchSidebar } from '@widgets/search-sidebar'
import { useState } from 'react'

import { catalog } from '../../model/catalog'
import { Pagination } from '../Pagination'
import { SearchControls } from '../SearchControls'
import { SearchHeader } from '../SearchHeader'
import {
  SearchResultsGrid,
  SearchResultSkeletonGrid,
} from '../SearchResultsGrid'

import s from './Search.module.css'

// Во время обновления показывает прежние данные (`catalog.data()` не сбрасывается), а
// `Pagination` подсвечивает живой `page()` сразу, не дожидаясь ответа.
const SearchResults = reatomComponent(() => {
  const { movies, totalPages } = catalog.data()
  const query = searchQuery()
  const displayPage = page()
  const onPageChange = wrap(goToPage)

  if (movies.length === 0) {
    return (
      <div className={s.emptyWrap}>
        <EmptyState
          title='Nothing found'
          description={
            query
              ? `Ничего не найдено по «${query}»`
              : 'Try adjusting the filters'
          }
        />
        {/*
          Deep-linked/устаревший ?page может указывать за пределы реальной выдачи (курсор
          закончился раньше целевой страницы — см. loadMoviesPage) — movies пуст, но
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
      </div>
    )
  }

  return (
    <>
      {/*
        Genre round-trip: API отдаёт `genres.name` по-русски, `Movie.genre` этих значений не
        переводит обратно в английский — карточки показывают русские жанры как есть, reverse
        RU→EN не делаем (принятое решение, не баг, см. .claude/rules/search-catalog.md).
      */}
      <SearchResultsGrid movies={movies} />
      <div className={s.paginationSection}>
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          onChange={onPageChange}
        />
        <div className={s.countText} aria-live='polite'>
          {movies.length} shown · page {displayPage} of {totalPages}
        </div>
      </div>
    </>
  )
}, 'SearchResults')

// Выбор между SearchSidebar и мобильной filter-bar + BottomSheet (и между SortSelect и sort
// BottomSheet) — разные UX-паттерны, а не CSS-варианты одного дерева, поэтому ветвимся по
// `isMobile` (один из двух законных потребителей useViewport). Chrome (Header/BottomNav) живёт
// в AppLayout; Search — только контент страницы.
export const Search = reatomComponent(() => {
  const { isMobile } = useViewport()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const filters = filtersAtom()
  const sort = sortAtom()
  const chips = activeChips()
  const query = searchQuery()
  const isSearchMode = query.trim().length > 0
  // Скелетон — только до первых данных; дальше обновление идёт поверх старой выдачи с бейджем.
  const { isFirstPending, isPending } = catalog.status()
  const isUpdating = isPending && !isFirstPending

  const title = isSearchMode ? `Results for “${query}”` : 'Browse catalog'

  return (
    <div className={s.page}>
      {isMobile && (
        <div className={`hide-scrollbar ${s.filterBar}`}>
          <button
            type='button'
            onClick={() => setFiltersOpen(true)}
            disabled={isSearchMode}
            className={`${s.filterBtn} ${chips.length ? s.filterBtnActive : ''}`}
          >
            <FilterIcon />
            Filters
            {chips.length > 0 && (
              <span className={s.filterCount}>{chips.length}</span>
            )}
          </button>

          <button
            type='button'
            onClick={() => setSortOpen(true)}
            disabled={isSearchMode}
            className={s.sortBtn}
          >
            <span className={s.sortLabel}>Sort</span>
            {sort || 'Default'}
            <ChevronDownIcon />
          </button>

          <ActiveFilterChips
            chips={chips}
            onRemove={wrap(removeFilterChip)}
            compact
          />
        </div>
      )}

      <div className={s.layout}>
        {!isMobile && (
          <SearchSidebar
            filters={filters}
            onFiltersChange={wrap(setFilters)}
            onReset={wrap(resetFilters)}
            disabled={isSearchMode}
          />
        )}

        <main className={s.main}>
          <SearchHeader title={title} route='/search' />

          {!isMobile && (
            <SearchControls
              chips={chips}
              onRemoveChip={wrap(removeFilterChip)}
              onClearAll={wrap(resetFilters)}
              sort={sort}
              onSortChange={wrap(setSort)}
              sortDisabled={isSearchMode}
            />
          )}

          <div
            className={`${s.resultsWrapper} ${isUpdating ? s.updating : ''}`}
            aria-busy={isUpdating}
          >
            <AsyncContent
              pending={isFirstPending}
              error={catalog.error()}
              onRetry={wrap(catalog.retry)}
              fallback={<SearchResultSkeletonGrid />}
            >
              <SearchResults />
            </AsyncContent>
            {isUpdating && (
              <div className={s.updatingBadge}>
                <Spinner size={14} />
                Updating…
              </div>
            )}
          </div>
        </main>
      </div>

      {isMobile && (
        <>
          <BottomSheet
            open={filtersOpen && !isSearchMode}
            onClose={() => setFiltersOpen(false)}
            title='Filters'
          >
            {/* Без `count`: Type — одиночный выбор, значение есть всегда. */}
            <FilterGroup title='Type' defaultOpen compact>
              <div className={s.typeGrid}>
                {[
                  { key: 'movie', label: 'Movies' },
                  { key: 'series', label: 'Series' },
                  { key: 'anime', label: 'Anime' },
                ].map(t => (
                  <button
                    type='button'
                    key={t.key}
                    onClick={wrap(() =>
                      setFilters({ ...filters, type: t.key }),
                    )}
                    className={`${s.typeBtn} ${filters.type === t.key ? s.typeBtnActive : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </FilterGroup>

            <FilterPanel
              filters={filters}
              onFiltersChange={wrap(setFilters)}
              disabled={isSearchMode}
              compact
            />

            <div className={s.sheetSpacer} />
            <div className={s.sheetFooter}>
              <button
                type='button'
                onClick={wrap(resetFilters)}
                className={s.resetBtn}
              >
                Reset
              </button>
              <button
                type='button'
                onClick={() => setFiltersOpen(false)}
                className={s.showResultsBtn}
              >
                Show results
              </button>
            </div>
          </BottomSheet>

          <BottomSheet
            open={sortOpen && !isSearchMode}
            onClose={() => setSortOpen(false)}
            title='Sort by'
            heightVh={50}
          >
            <div className={s.sortList}>
              {SORT_LABELS.map(o => (
                <button
                  type='button'
                  key={o}
                  onClick={wrap(() => {
                    setSort(o)
                    setSortOpen(false)
                  })}
                  className={`${s.sortOption} ${sort === o ? s.sortOptionActive : ''}`}
                >
                  {o}
                  {sort === o && <CheckIcon />}
                </button>
              ))}
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  )
}, 'Search')
