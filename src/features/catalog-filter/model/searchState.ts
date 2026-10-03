import {
  action,
  atom,
  computed,
  ifChanged,
  isDeepEqual,
  sleep,
  urlAtom,
  withAbort,
  withComputed,
  withMemo,
  wrap,
} from '@reatom/core'
import { matchRoutePattern } from '@shared/config'
import { trackEvent } from '@shared/lib'

import { getFilterChips, removeChipFromFilters } from '../lib/filterChips'
import { filtersToParams, SORT_LABELS } from '../lib/filtersToParams'
import {
  EMPTY_FILTERS,
  FILTER_URL_KEYS,
  filtersToSearchParams,
  getFilterFromSearchParams,
  resetPageToOne,
  stripFilterAndSortParams,
} from '../lib/searchParams'
import type { FilterState } from './types'

export const QUERY_MIN_LENGTH = 2
export const QUERY_DEBOUNCE_MS = 250

/** Demo-тариф: страницы 1–10 (клэмп и на чтении из URL, и на записи через goToPage). */
const MAX_PAGE = 10

const clampPage = (page: number) => Math.min(MAX_PAGE, Math.max(1, page))

/** Значение, которое реально попадёт в `?q`: trim, короче порога — пусто. */
const toUrlQuery = (raw: string) => {
  const trimmed = raw.trim()
  return trimmed.length >= QUERY_MIN_LENGTH ? trimmed : ''
}

const isSearchPath = (pathname: string) =>
  matchRoutePattern(pathname) === '/search'

const EMPTY_PARAMS = new URLSearchParams()

// Вне /search состояние пустое: параметры чужой страницы (например, ?q где-то ещё) не должны
// просачиваться в фильтры и каталог.
const searchParams = computed(() => {
  const url = urlAtom()
  return isSearchPath(url.pathname) ? url.searchParams : EMPTY_PARAMS
}, 'catalogFilter.searchParams')

export const searchQuery = computed(
  () => searchParams().get('q') ?? '',
  'catalogFilter.query',
)

// Мусорная сортировка из URL даёт дефолт, а не «выбранный» несуществующий пункт.
export const sort = computed(() => {
  const raw = searchParams().get('sort') ?? ''
  return SORT_LABELS.includes(raw) ? raw : ''
}, 'catalogFilter.sort')

export const page = computed(
  () => clampPage(Number.parseInt(searchParams().get('page') ?? '1', 10) || 1),
  'catalogFilter.page',
)

// withMemo: смена посторонних параметров (?page, ?q) даёт структурно те же фильтры — зависимые
// чипы и каталог не пересчитываются.
export const filters = computed(
  () => getFilterFromSearchParams(searchParams()),
  'catalogFilter.filters',
).extend(withMemo(isDeepEqual))

export const activeChips = computed(
  () => getFilterChips(filters()),
  'catalogFilter.activeChips',
)

export const catalogParams = computed(
  () => filtersToParams(filters(), sort()),
  'catalogFilter.catalogParams',
).extend(withMemo(isDeepEqual))

const withSearch = (url: URL, params: URLSearchParams) => {
  const next = new URL(url)
  next.search = params.toString()
  return next
}

// Единственная точка записи: вся мутация (включая сброс страницы и зачистку фильтров) — один
// urlAtom.set, а значит одна запись в history. Реактивный сброс дал бы вторую запись.
const updateSearchUrl = action(
  (mutator: (params: URLSearchParams) => URLSearchParams) => {
    urlAtom.set(
      url =>
        isSearchPath(url.pathname)
          ? withSearch(url, mutator(new URLSearchParams(url.search)))
          : url,
      true,
    )
  },
  'catalogFilter.updateUrl',
)

export const setFilters = action(
  (next: FilterState | ((prev: FilterState) => FilterState)) => {
    const resolved = typeof next === 'function' ? next(filters()) : next
    updateSearchUrl(params => {
      const updated = new URLSearchParams(params)
      FILTER_URL_KEYS.forEach(key => updated.delete(key))
      filtersToSearchParams(resolved).forEach((value, key) =>
        updated.set(key, value),
      )
      return resetPageToOne(updated)
    })
    // Единственная точка коммита FilterState — setSort трекается отдельно и намеренно не
    // проходит через setFilters.
    trackEvent('filter changed')
  },
  'catalogFilter.setFilters',
)

export const toggleGenre = action((genre: string) => {
  setFilters(f => ({
    ...f,
    genres: f.genres.includes(genre)
      ? f.genres.filter(g => g !== genre)
      : [...f.genres, genre],
  }))
}, 'catalogFilter.toggleGenre')

export const resetFilters = action(() => {
  setFilters(EMPTY_FILTERS)
}, 'catalogFilter.resetFilters')

export const removeFilterChip = action((id: string) => {
  setFilters(f => removeChipFromFilters(f, id))
}, 'catalogFilter.removeChip')

// Страницу не сбрасывает — как на main.
export const setSort = action((next: string) => {
  updateSearchUrl(params => {
    const updated = new URLSearchParams(params)
    if (next) updated.set('sort', next)
    else updated.delete('sort')
    return updated
  })
}, 'catalogFilter.setSort')

export const goToPage = action((next: number) => {
  updateSearchUrl(params => {
    const updated = new URLSearchParams(params)
    updated.set('page', String(clampPage(next)))
    return updated
  })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}, 'catalogFilter.goToPage')

// API не сочетает текстовый поиск с фильтрами: вход в текстовый режим убирает фильтры и
// сортировку. Новый запрос — новая выдача, поэтому ?page убирается целиком.
export const submitSearchQuery = action((raw: string) => {
  const nextQuery = toUrlQuery(raw)
  updateSearchUrl(params => {
    if ((params.get('q') ?? '') === nextQuery) return params

    const updated = nextQuery
      ? stripFilterAndSortParams(params)
      : new URLSearchParams(params)
    if (nextQuery) updated.set('q', nextQuery)
    else updated.delete('q')
    updated.delete('page')
    return updated
  })
}, 'catalogFilter.submitQuery')

// Deep-link или back/forward на «грязный» URL (?q вместе с фильтрами): фильтры мертвы, их
// убираем; страницу сохраняем — она относится к текстовой выдаче.
export const normalizeSearchUrl = action(() => {
  updateSearchUrl(params =>
    params.get('q')?.trim() ? stripFilterAndSortParams(params) : params,
  )
}, 'catalogFilter.normalizeUrl')

// Черновик инпута: следует за URL, но принимает прямую запись. Смена ?q, которая лишь
// отражает текущий черновик (наш же коммит: trim, короткий ввод → пусто), черновик не
// трогает — иначе коммит стирал бы введённый пробел или единственную букву.
export const searchDraft = atom('', 'catalogFilter.draft').extend(
  withComputed(state => {
    ifChanged(searchQuery, query => {
      if (toUrlQuery(state) !== query) state = query
    })
    return state
  }),
)

// Debounce через withAbort: каждый новый вызов отменяет спящий предыдущий. Отмена — штатный
// исход каждого нажатия: action синхронный и промис наружу не отдаёт, иначе отменённые вызовы
// уходили бы вызывающему unhandled rejection.
export const commitSearchDraft = action(() => {
  wrap(sleep(QUERY_DEBOUNCE_MS)).then(
    wrap(() => submitSearchQuery(searchDraft())),
    () => {},
  )
}, 'catalogFilter.commitDraft').extend(withAbort())
