import { Card } from '@entities/movie'
import {
  ActiveFilterChips,
  GenreSelector,
  YearRangeSlider,
  useFilterState,
  SORT_LABELS,
} from '@features/catalog-filter'
import type { FilterState } from '@features/catalog-filter'
import { useFavorites } from '@features/favorites'
import {
  AsyncBoundary,
  EmptyState,
  Skeleton,
  Spinner,
  FilterIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from '@shared/ui'
import { MobileHeader, BottomNav, BottomSheet } from '@widgets/mobile-chrome'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { buildPageRange, clampPage } from '../../lib/buildPageRange'
import { useCatalogUpdateStatus } from '../../model/useCatalogUpdateStatus'
import {
  invalidateMovieCatalog,
  useMovieCatalog,
} from '../../model/useMovieCatalog'
import { usePageSync } from '../../model/usePageSync'

import s from './SearchMobile.module.css'

type MobilePaginationProps = {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

const MobilePagination = ({
  page,
  totalPages,
  onChange,
}: MobilePaginationProps) => {
  // Та же защита от рассинхрона, что в desktop Pagination.tsx: ?page из URL может временно
  // выйти за пределы totalPages (напр. смена фильтров ещё не долетела до фетчера) — клэмпим
  // для рендера/disabled, не мутируя проп и не решая за вызывающий код, что писать в URL.
  // Клэмп и построение диапазона — общая pure-функция с desktop Pagination.tsx (lib/buildPageRange).
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = clampPage(page, totalPages)
  const pages = buildPageRange(page, totalPages)

  return (
    <div className={s.paginationContainer}>
      <button
        type='button'
        className={s.pageBtn}
        disabled={safePage <= 1}
        onClick={() => onChange(Math.max(1, safePage - 1))}
      >
        <ChevronLeftIcon size={10} />
      </button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={p + i} className={s.pageEllipsis}>
            …
          </span>
        ) : (
          <button
            type='button'
            key={p}
            className={`${s.pageBtn} ${p === safePage ? s.pageBtnActive : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type='button'
        className={s.pageBtn}
        disabled={safePage >= safeTotalPages}
        onClick={() => onChange(Math.min(safeTotalPages, safePage + 1))}
      >
        <ChevronRightIcon size={10} />
      </button>
    </div>
  )
}

const MobileResultsSkeleton = () => (
  <div className={s.skeletonGrid}>
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className={s.skeletonItem}>
        <Skeleton height={220} borderRadius={10} />
        <Skeleton height={14} width='80%' />
        <Skeleton height={10} width='50%' />
      </div>
    ))}
  </div>
)

type MobileSearchResultsProps = {
  query: string
  filters: FilterState
  sort: string
  page: number
  displayPage: number
  onPageChange: (p: number) => void
}

/**
 * Отдельный компонент под `use()` внутри `useMovieCatalog` — Suspense должен ловить именно
 * этот узел, а не всю страницу (шапка/переключатели фильтров/сортировки остаются
 * интерактивными во время загрузки). Тот же паттерн, что `SearchResults` в `SearchDesktop`.
 *
 * `query`/`filters`/`sort`/`page` — deferred-значения из `useCatalogUpdateStatus` (Task 7,
 * зеркало Task 6 в SearchDesktop): пока React их не догнал, `use()` внутри `useMovieCatalog`
 * берёт cache-hit на старых параметрах вместо повторного саспенда уже смонтированного дерева.
 * `displayPage` — live-значение, отдельно от `page`, чтобы клик по номеру страницы в
 * `MobilePagination` подсвечивался мгновенно.
 */
const MobileSearchResults = ({
  query,
  filters,
  sort,
  page,
  displayPage,
  onPageChange,
}: MobileSearchResultsProps) => {
  const { movies, totalPages } = useMovieCatalog({ query, filters, sort, page })
  const { isFavorite, toggle } = useFavorites()

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
          Тот же дед-энд, что в SearchDesktop: устаревший/deep-linked ?page может указывать
          за пределы реальной выдачи — movies пуст, но totalPages всё равно приходит из total.
          Без MobilePagination тут нет способа вернуться на валидную страницу.
        */}
        {totalPages > 0 && (
          <div className={s.emptyPaginationWrap}>
            <MobilePagination
              page={displayPage}
              totalPages={totalPages}
              onChange={onPageChange}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={s.resultsGrid}>
        {movies.map(m => (
          <Card
            key={m.id}
            movie={m}
            isFavorite={isFavorite(m.id)}
            onToggleFavorite={toggle}
          />
        ))}
      </div>

      <div className={s.paginationSection}>
        <MobilePagination
          page={displayPage}
          totalPages={totalPages}
          onChange={onPageChange}
        />
        <div className={s.resultsCount} aria-live='polite'>
          {movies.length} shown · page {displayPage} of {totalPages}
        </div>
      </div>
    </>
  )
}

export const SearchMobile = () => {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
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

  const query = searchParams.get('q') ?? ''
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
      <MobileHeader />

      <div className={`hide-scrollbar ${s.filterBar}`}>
        <button
          type='button'
          onClick={() => setFiltersOpen(true)}
          disabled={isSearchMode}
          className={`${s.filterBtn} ${activeChips.length ? s.filterBtnActive : ''}`}
        >
          <FilterIcon />
          Filters
          {activeChips.length > 0 && (
            <span className={s.filterCount}>{activeChips.length}</span>
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

        <ActiveFilterChips chips={activeChips} compact />
      </div>

      <div className={s.sectionHeader}>
        <div className={s.eyebrow}>
          {isSearchMode ? 'Search results' : 'Catalog'}
        </div>
        <h1 className={s.title}>
          {isSearchMode ? `Results for “${query}”` : 'Browse catalog'}
        </h1>
      </div>

      <div
        className={`${s.resultsWrapper} ${isUpdating ? s.resultsWrapperUpdating : ''}`}
        aria-busy={isUpdating}
      >
        <AsyncBoundary
          fallback={<MobileResultsSkeleton />}
          onRetry={() =>
            invalidateMovieCatalog({
              query: deferredQuery,
              filters: deferredFilters,
              sort: deferredSort,
              page: deferredPage,
            })
          }
        >
          <MobileSearchResults
            query={deferredQuery}
            filters={deferredFilters}
            sort={deferredSort}
            page={deferredPage}
            displayPage={page}
            onPageChange={goToPage}
          />
        </AsyncBoundary>
        {isUpdating && (
          <div className={s.updatingIndicator}>
            <Spinner size={12} />
            Updating…
          </div>
        )}
      </div>

      <BottomNav active='search' />

      <BottomSheet
        open={filtersOpen && !isSearchMode}
        onClose={() => setFiltersOpen(false)}
        title='Filters'
      >
        <div className={s.filterSheetBody}>
          <div>
            <div className={s.fieldLabel}>Type</div>
            <div className={s.typeGrid}>
              {[
                { key: 'movie', label: 'Movies' },
                { key: 'series', label: 'Series' },
                { key: 'anime', label: 'Anime' },
              ].map(t => (
                <button
                  type='button'
                  key={t.key}
                  onClick={() => setFilters({ ...filters, type: t.key })}
                  className={`${s.typeBtn} ${filters.type === t.key ? s.typeBtnActive : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className={s.fieldLabel}>Genre</div>
            <GenreSelector
              selected={filters.genres}
              onToggle={toggleGenre}
              disabled={isSearchMode}
              compact
            />
          </div>

          <div>
            <div className={s.fieldLabel}>Year</div>
            <YearRangeSlider
              yearFrom={filters.yearFrom}
              yearTo={filters.yearTo}
              onChange={(yearFrom, yearTo) =>
                setFilters({ ...filters, yearFrom, yearTo })
              }
              disabled={isSearchMode}
              compact
            />
          </div>

          <div>
            <div className={s.fieldLabel}>Minimum rating</div>
            <div className={s.ratingRow}>
              {[5, 6, 7, 8, 9].map(r => (
                <button
                  type='button'
                  key={r}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      rating: filters.rating === r ? null : r,
                    })
                  }
                  className={`${s.ratingBtn} ${filters.rating === r ? s.ratingBtnActive : ''}`}
                >
                  {r}+
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={s.sheetSpacer} />
        <div className={s.sheetFooter}>
          <button type='button' onClick={resetFilters} className={s.resetBtn}>
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
              onClick={() => {
                setSort(o)
                setSortOpen(false)
              }}
              className={`${s.sortOption} ${sort === o ? s.sortOptionActive : ''}`}
            >
              {o}
              {sort === o && <CheckIcon />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
