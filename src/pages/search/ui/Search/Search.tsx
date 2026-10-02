import {
  ActiveFilterChips,
  FilterGroup,
  FilterPanel,
  useFilterState,
  SORT_LABELS,
} from '@features/catalog-filter'
import { useViewport } from '@shared/lib'
import {
  EmptyState,
  QueryBoundary,
  Spinner,
  FilterIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@shared/ui'
import { BottomSheet } from '@widgets/mobile-chrome'
import { SearchSidebar } from '@widgets/search-sidebar'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import type { MovieCatalogResult } from '../../model/movieCatalogStore'
import { useSearchUiStore } from '../../model/searchUiStore'
import { useMovieCatalog } from '../../model/useMovieCatalog'
import { usePageSync } from '../../model/usePageSync'
import { useSearchAnalytics } from '../../model/useSearchAnalytics'
import { Pagination } from '../Pagination'
import { SearchControls } from '../SearchControls'
import { SearchHeader } from '../SearchHeader'
import {
  SearchResultsGrid,
  SearchResultSkeletonGrid,
} from '../SearchResultsGrid'

import s from './Search.module.css'

type SearchResultsProps = {
  result: MovieCatalogResult
  query: string
  displayPage: number
  onPageChange: (p: number) => void
}

/**
 * Выдача `/search`. `result` может быть выдачей прошлых параметров (keepPreviousData в
 * `useMovieCatalog`), а `displayPage` — всегда live-значение из URL: клик по номеру страницы в
 * `Pagination` подсвечивается мгновенно, не дожидаясь ответа.
 */
const SearchResults = ({
  result: { movies, totalPages },
  query,
  displayPage,
  onPageChange,
}: SearchResultsProps) => {
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
      </div>
    )
  }

  return (
    <>
      {/*
        Genre round-trip: API отдаёт `genres.name` по-русски, `Movie.genre` этих значений не
        переводит обратно в английский — карточки показывают русские жанры как есть, reverse
        RU→EN не делаем (принятое решение, не баг, см. AGENTS.md "Data state").
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
}

/**
 * Единый адаптивный `Search` (Task 10, план `docs/plans/20260827-mobile-first-adaptive-layout.md`
 * — намеренно последняя и самая сложная задача слияния, см. Development Approach плана).
 * Слил `SearchDesktop`/`SearchMobile`, каждый из которых сам разветвлялся через
 * `SearchPage.tsx`'s `useViewport`.
 *
 * **Осознанное отклонение от буквальной формулировки роадмапа (2.5: "фильтры — drawer на
 * мобильной базе, раскрываются в сайдбар на широких экранах", подразумевающей один компонент
 * для фильтров).** `SearchSidebar` (always-visible aside с radio-rows) и bottom-sheet
 * (открывается по кнопке, портал, свой `filtersOpen`/`sortOpen` стейт) — разные UX-паттерны, не
 * CSS-варианты одного дерева (см. Task 1/Audit и Solution Overview плана). Слияние НЕ сводит их
 * в одну раскладку — оба варианта остаются как разные под-деревья, но выбор между ними (и выбор
 * `Pagination`-варианта — впрочем, тот последний свёлся к чистому CSS, см. `Pagination`'s
 * докблок) переехал в эту единую точку (`Search`) вместо того, чтобы быть разбросанным по
 * `SearchDesktop.tsx`/`SearchMobile.tsx` по отдельности. Тот же принцип отклонения от буквального
 * роадмапа уже задокументирован в AGENTS.md для `useRecommendedMovies` (vs роадмапного
 * `useRecommendations`) — здесь применяется тот же приём: расхождение зафиксировано явно, а не
 * обнаружено постфактум.
 *
 * **Chrome (`Header`/`MobileHeader`+`BottomNav`) сюда не входит** — `/search` подключён под
 * `AppLayout` (см. `src/app/router.tsx`), который сам решает `Header`'s `variant='search'`/
 * `activeNav` (из `?type`, не из пути — см. `AppLayout.tsx`'s `SEARCH_CHROME`/`isSearchRoute`) и
 * `MobileHeader`+`BottomNav` для мобильного брейкпоинта. `Search` — только контент страницы.
 *
 * **`SearchHeader`/`SearchResultsGrid`/`SearchResultSkeletonGrid` — не были общими компонентами
 * до этой задачи, вопреки предположению плана.** Чтение кода `SearchMobile.tsx` (Task 10)
 * показало, что эти три компонента (и `SearchControls`/`SortSelect`) реально использовались
 * только `SearchDesktop.tsx` — `SearchMobile.tsx` рендерил параллельные инлайновые эквиваленты
 * (`.sectionHeader`/`.eyebrow`+`.title`, `Card`-грид напрямую, свой sticky filter-bar).
 * `SearchResultsGrid`/`SearchResultSkeletonGrid` унифицированы под mobile-first CSS (2 колонки
 * мобильный / 4 десктоп, см. их докблоки) и используются на обоих брейкпоинтах — чистое "просто
 * CSS" слияние. `SearchHeader` тоже унифицирован (mobile-first размеры), но с одной сознательной
 * потерей паритета: мобильный overline-лейбл раньше менялся между "Search results"/"Catalog" по
 * `isSearchMode`, единый `SearchHeader` показывает статичный `Catalog · /search`, как раньше было
 * у десктопа (заголовок `title` при этом по-прежнему меняется по `isSearchMode`, как и раньше) —
 * принятое упрощение, не покрытое ни одним существующим тестом ни на одном брейкпоинте.
 *
 * **`SearchControls` (chips + `SortSelect`-дропдаун) и мобильный sticky filter-bar (кнопки-
 * триггеры + bottom-sheet сортировки) остаются раздельными компонентами того же семейства, что
 * и sidebar/bottom-sheet фильтры** — дропдаун сортировки поверх текста (десктоп, мышь) и
 * полноэкранный bottom-sheet со списком (мобильный, тач) — тоже разный UX, не просто разный CSS,
 * тот же принцип, что применяется к фильтрам выше. Оба выбираются тем же `isMobile`.
 */
export const Search = () => {
  const { isMobile } = useViewport()
  // Каждая шторка подписана только на свой флаг
  const filtersOpen = useSearchUiStore(s => s.filtersOpen)
  const sortOpen = useSearchUiStore(s => s.sortOpen)
  const openFilters = useSearchUiStore(s => s.openFilters)
  const closeFilters = useSearchUiStore(s => s.closeFilters)
  const openSort = useSearchUiStore(s => s.openSort)
  const closeSort = useSearchUiStore(s => s.closeSort)
  const resetSearchUi = useSearchUiStore(s => s.reset)
  // Стор module-level: без сброса при уходе со страницы шторка осталась бы открытой при возврате
  useEffect(() => resetSearchUi, [resetSearchUi])
  const { filters, setFilters, sort, setSort, resetFilters, activeChips } =
    useFilterState()
  const [searchParams] = useSearchParams()

  const query = searchParams.get('q') ?? ''
  useSearchAnalytics(query)
  const isSearchMode = query.trim().length > 0
  const { page, goToPage } = usePageSync({ query, filters })
  const catalog = useMovieCatalog({ query, filters, sort, page })
  // Фоновый запрос поверх уже показанной выдачи; первый заход (isLoading) — скелетон, не бейдж
  const isUpdating = catalog.isFetching && !catalog.isLoading

  const title = isSearchMode ? `Results for “${query}”` : 'Browse catalog'

  return (
    <div className={s.page}>
      {isMobile && (
        <div className={`hide-scrollbar ${s.filterBar}`}>
          <button
            type='button'
            onClick={() => openFilters()}
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
            onClick={() => openSort()}
            disabled={isSearchMode}
            className={s.sortBtn}
          >
            <span className={s.sortLabel}>Sort</span>
            {sort || 'Default'}
            <ChevronDownIcon />
          </button>

          <ActiveFilterChips chips={activeChips} compact />
        </div>
      )}

      <div className={s.layout}>
        {!isMobile && (
          <SearchSidebar
            filters={filters}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            disabled={isSearchMode}
          />
        )}

        <main className={s.main}>
          <SearchHeader title={title} route='/search' />

          {!isMobile && (
            <SearchControls
              chips={activeChips}
              onClearAll={resetFilters}
              sort={sort}
              onSortChange={setSort}
              sortDisabled={isSearchMode}
            />
          )}

          <div
            className={`${s.resultsWrapper} ${isUpdating ? s.updating : ''}`}
            aria-busy={isUpdating}
          >
            <QueryBoundary
              query={catalog}
              fallback={<SearchResultSkeletonGrid />}
            >
              {result => (
                <SearchResults
                  result={result}
                  query={query}
                  displayPage={page}
                  onPageChange={goToPage}
                />
              )}
            </QueryBoundary>
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
            onClose={() => closeFilters()}
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
                    onClick={() => setFilters({ ...filters, type: t.key })}
                    className={`${s.typeBtn} ${filters.type === t.key ? s.typeBtnActive : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </FilterGroup>

            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              disabled={isSearchMode}
              compact
            />

            <div className={s.sheetSpacer} />
            <div className={s.sheetFooter}>
              <button
                type='button'
                onClick={resetFilters}
                className={s.resetBtn}
              >
                Reset
              </button>
              <button
                type='button'
                onClick={() => closeFilters()}
                className={s.showResultsBtn}
              >
                Show results
              </button>
            </div>
          </BottomSheet>

          <BottomSheet
            open={sortOpen && !isSearchMode}
            onClose={() => closeSort()}
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
                    closeSort()
                  }}
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
}
