import {
  resetCountryDictionaryState,
  resetGenreDictionaryState,
} from '@entities/movie'
import '@testing-library/jest-dom/vitest'
import { context, urlAtom } from '@reatom/core'
import { resetAllCachedFetchers } from '@shared/lib'
import { cleanup } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

// Первым: глобальное расширение Reatom должно зарегистрироваться до создания атомов модулями ниже.
import { abortTestFrames } from './reatomTestScope'

// window.matchMedia — jsdom вообще не реализует этот API (docs/plans/20260819-theme-toggle.md,
// Task 4). reatomMediaQuery темы вызывает `window.matchMedia('(prefers-color-scheme: dark)')`,
// так что без этого стаба любой тест, монтирующий компонент с темой/ThemeToggle, упал бы с
// "window.matchMedia is not a function". Слушатели хранятся по строке запроса (а не заглушены
// no-op'ом), чтобы тест мог получить `addEventListener.mock.calls` / переопределить
// `window.matchMedia` самостоятельно и вызвать сохранённый 'change'-слушатель напрямую, эмулируя
// смену системной темы — см. паттерн переопределения в theme.test.ts (этот глобальный стаб
// по умолчанию гарантирует только `matches: false` и рабочую подписку/отписку).
const mediaQueryListeners = new Map<
  string,
  Set<(event: MediaQueryListEvent) => void>
>()

window.matchMedia = vi.fn().mockImplementation((query: string) => {
  const listeners =
    mediaQueryListeners.get(query) ??
    new Set<(event: MediaQueryListEvent) => void>()
  mediaQueryListeners.set(query, listeners)

  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.add(listener)
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.delete(listener)
      },
    ),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList
})

// window.IntersectionObserver — jsdom его тоже не реализует (docs/plans/20260916-performance-
// virtualization-lazy-loading.md, Task 3). Первый потребитель — useInView() в RelatedMovies.
// Дефолт — «элемент сразу во viewport»: observe() синхронно вызывает колбэк с
// isIntersecting: true (по аналогии с дефолтным matches: false у matchMedia-стаба выше), чтобы
// тесты, монтирующие Movie/MoviePage/RelatedMovies, видели lazy-контент без специальной
// подготовки. Сценарий «вне вьюпорта» тесты воспроизводят локальным override
// window.IntersectionObserver с восстановлением оригинала в afterEach (см. useInView.test.ts).
class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly scrollMargin = '0px'
  readonly thresholds = [0]
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this,
    )
  }

  unobserve() {}

  disconnect() {}

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

window.IntersectionObserver = IntersectionObserverStub

// Дефолтный MSW-хендлер для справочника жанров (Task 3, docs/plans/20260815-dynamic-genre-
// dictionary.md) — без него любой тест, рендерящий Search/SearchSidebar (эти компоненты вызывают
// useGenreDictionary → фоновый fetch), падает на `onUnhandledRequest: 'error'`. Отдельные тесты
// переопределяют этот хендлер через `server.use(...)`, если им нужен конкретный набор жанров или
// сценарий ошибки.
const DEFAULT_GENRE_DICTIONARY_ITEMS = [
  { id: 1, name: 'боевик', slug: null, enName: null },
  { id: 2, name: 'драма', slug: null, enName: null },
  { id: 3, name: 'триллер', slug: null, enName: null },
]

// Справочник стран — то же самое для CountrySelector (useCountryDictionary → фоновый fetch).
// Содержит весь шорт-лист STATIC_FALLBACK_COUNTRIES в написании живого API (country.test.ts
// это проверяет) плюс «Аргентину» — страну только из словаря, по ней видно, что словарь загрузился.
export const DEFAULT_COUNTRY_DICTIONARY_NAMES = [
  'США',
  'Россия',
  'Великобритания',
  'Франция',
  'Германия',
  'Италия',
  'Япония',
  'Корея Южная',
  'Испания',
  'Канада',
  'Аргентина',
]

const DEFAULT_COUNTRY_DICTIONARY_ITEMS = DEFAULT_COUNTRY_DICTIONARY_NAMES.map(
  (name, i) => ({ id: i + 1, name, slug: null, enName: null }),
)

export const server = setupServer(
  http.get('*/v1.5/dictionary/genres', () =>
    HttpResponse.json({
      type: 'genres',
      total: DEFAULT_GENRE_DICTIONARY_ITEMS.length,
      items: DEFAULT_GENRE_DICTIONARY_ITEMS,
    }),
  ),
  http.get('*/v1.5/dictionary/countries', () =>
    HttpResponse.json({
      type: 'countries',
      total: DEFAULT_COUNTRY_DICTIONARY_ITEMS.length,
      items: DEFAULT_COUNTRY_DICTIONARY_ITEMS,
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// Один afterEach с явным порядком: несколько отдельных afterEach Vitest выполняет в обратном
// порядке регистрации, и зависимость шагов друг от друга становится неочевидной.
// - cleanup() первым: размонтирование снимает подписки компонентов до сброса контекста.
// - urlAtom.init.abort() — context.reset() не снимает слушатели popstate/click, поставленные
//   urlAtom.init; без этого они копятся от теста к тесту и дублируют pushState.
// - abortTestFrames() — явная отмена: context.reset() асинхронные продолжения не абортит
//   (см. reatomTestScope.ts). Отмена до сброса хранилищ, чтобы незавершённый запрос прошлого
//   теста не дописал persist-значение в уже чистый storage.
// - server.resetHandlers() последним: к этому моменту запросы прошлого теста уже отменены,
//   иначе они попадают в onUnhandledRequest: 'error' следующего теста.
afterEach(() => {
  cleanup()
  urlAtom.init.abort()
  abortTestFrames()
  context.reset()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  // Модульное состояние вне атомов: in-memory кэш createCachedFetcher и словари (жанры,
  // страны) живут между тестами и файлами, иначе тест получает закэшированный промис
  // прошлого теста вместо своего MSW-хендлера.
  resetAllCachedFetchers()
  resetGenreDictionaryState()
  resetCountryDictionaryState()
  server.resetHandlers()
})
afterAll(() => server.close())
