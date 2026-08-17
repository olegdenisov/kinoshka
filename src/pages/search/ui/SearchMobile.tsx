import { MobileCard } from '@entities/movie'
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

import { buildPageRange, clampPage } from '../lib/buildPageRange'
import { useCatalogUpdateStatus } from '../model/useCatalogUpdateStatus'
import {
  invalidateMovieCatalog,
  useMovieCatalog,
} from '../model/useMovieCatalog'
import { usePageSync } from '../model/usePageSync'

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

  const btnStyle = (active: boolean, disabled: boolean) => ({
    minWidth: 34,
    height: 34,
    padding: '0 8px',
    borderRadius: 4,
    background: active ? 'rgba(209,142,95,0.15)' : 'transparent',
    color: active ? '#D18E5F' : disabled ? '#3A3639' : '#B8ADAB',
    border: `1px solid ${active ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
    cursor: disabled ? ('default' as const) : ('pointer' as const),
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        flexWrap: 'wrap' as const,
      }}
    >
      <button
        type='button'
        style={btnStyle(false, safePage <= 1)}
        disabled={safePage <= 1}
        onClick={() => onChange(Math.max(1, safePage - 1))}
      >
        <ChevronLeftIcon size={10} />
      </button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span
            key={p + i}
            style={{
              ...btnStyle(false, true),
              border: 'none',
              color: '#5A5059',
            }}
          >
            …
          </span>
        ) : (
          <button
            type='button'
            key={p}
            style={btnStyle(p === safePage, false)}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type='button'
        style={btnStyle(false, safePage >= safeTotalPages)}
        disabled={safePage >= safeTotalPages}
        onClick={() => onChange(Math.min(safeTotalPages, safePage + 1))}
      >
        <ChevronRightIcon size={10} />
      </button>
    </div>
  )
}

const MobileResultsSkeleton = () => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 14,
      padding: '0 16px',
    }}
  >
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
      <div style={{ padding: '12px 20px 40px' }}>
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
          <div style={{ textAlign: 'center', marginTop: 24 }}>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          padding: '0 16px',
        }}
      >
        {movies.map(m => (
          <MobileCard
            key={m.id}
            movie={m}
            isFavorite={isFavorite(m.id)}
            onToggleFavorite={toggle}
          />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24, padding: '0 16px' }}>
        <MobilePagination
          page={displayPage}
          totalPages={totalPages}
          onChange={onPageChange}
        />
        <div
          style={{
            marginTop: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: '#5A5059',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          aria-live='polite'
        >
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
    <div
      style={{
        background: '#0F0D11',
        color: '#F2F0EF',
        minHeight: '100vh',
        paddingBottom: 80,
      }}
    >
      <MobileHeader />

      <div
        className='hide-scrollbar'
        style={{
          position: 'sticky',
          top: 52,
          zIndex: 30,
          background: 'rgba(15,13,17,0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(184,173,171,0.08)',
          padding: '10px 16px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          overflowX: 'auto',
        }}
      >
        <button
          type='button'
          onClick={() => setFiltersOpen(true)}
          disabled={isSearchMode}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            padding: '0 12px',
            background: activeChips.length
              ? 'rgba(209,142,95,0.15)'
              : 'rgba(24,22,27,0.6)',
            border: `1px solid ${activeChips.length ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.12)'}`,
            color: activeChips.length ? '#D18E5F' : '#F2F0EF',
            borderRadius: 999,
            cursor: isSearchMode ? 'not-allowed' : 'pointer',
            opacity: isSearchMode ? 0.4 : 1,
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <FilterIcon />
          Filters
          {activeChips.length > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 16,
                height: 16,
                padding: '0 5px',
                background: '#D18E5F',
                color: '#0F0D11',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {activeChips.length}
            </span>
          )}
        </button>

        <button
          type='button'
          onClick={() => setSortOpen(true)}
          disabled={isSearchMode}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            padding: '0 12px',
            background: 'rgba(24,22,27,0.6)',
            border: '1px solid rgba(184,173,171,0.12)',
            color: '#F2F0EF',
            borderRadius: 999,
            cursor: isSearchMode ? 'not-allowed' : 'pointer',
            opacity: isSearchMode ? 0.4 : 1,
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              color: '#92887F',
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Sort
          </span>
          {sort || 'Default'}
          <ChevronDownIcon />
        </button>

        <ActiveFilterChips chips={activeChips} compact />
      </div>

      <div style={{ padding: '20px 20px 12px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: '#92887F',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {isSearchMode ? 'Search results' : 'Catalog'}
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          {isSearchMode ? `Results for “${query}”` : 'Browse catalog'}
        </h1>
      </div>

      <div
        style={{
          position: 'relative',
          opacity: isUpdating ? 0.5 : 1,
          pointerEvents: isUpdating ? 'none' : 'auto',
          transition: 'opacity 150ms ease',
        }}
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
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              color: '#92887F',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: '#92887F',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Type
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
              }}
            >
              {[
                { key: 'movie', label: 'Movies' },
                { key: 'series', label: 'Series' },
                { key: 'anime', label: 'Anime' },
              ].map(t => (
                <button
                  type='button'
                  key={t.key}
                  onClick={() => setFilters({ ...filters, type: t.key })}
                  style={{
                    height: 40,
                    borderRadius: 6,
                    background:
                      filters.type === t.key
                        ? 'rgba(209,142,95,0.15)'
                        : 'rgba(184,173,171,0.04)',
                    color: filters.type === t.key ? '#D18E5F' : '#F2F0EF',
                    border: `1px solid ${filters.type === t.key ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    fontWeight: 500,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: '#92887F',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Genre
            </div>
            <GenreSelector
              selected={filters.genres}
              onToggle={toggleGenre}
              disabled={isSearchMode}
              compact
            />
          </div>

          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: '#92887F',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Year
            </div>
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
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: '#92887F',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Minimum rating
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
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
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 6,
                    background:
                      filters.rating === r
                        ? 'rgba(209,142,95,0.15)'
                        : 'rgba(184,173,171,0.04)',
                    color: filters.rating === r ? '#D18E5F' : '#B8ADAB',
                    border: `1px solid ${filters.rating === r ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {r}+
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ height: 80 }} />
        <div
          style={{
            position: 'sticky',
            bottom: -20,
            left: -20,
            right: -20,
            margin: '0 -20px -20px',
            padding: '14px 20px 20px',
            background: 'linear-gradient(180deg, transparent, #18161B 40%)',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            type='button'
            onClick={resetFilters}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(184,173,171,0.2)',
              color: '#B8ADAB',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Reset
          </button>
          <button
            type='button'
            onClick={() => setFiltersOpen(false)}
            style={{
              flex: 2,
              height: 48,
              borderRadius: 8,
              background: '#D18E5F',
              color: '#0F0D11',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
            }}
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {SORT_LABELS.map(o => (
            <button
              type='button'
              key={o}
              onClick={() => {
                setSort(o)
                setSortOpen(false)
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(184,173,171,0.06)',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: sort === o ? '#D18E5F' : '#F2F0EF',
              }}
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
