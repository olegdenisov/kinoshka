import { fetchSearchMovies, loadMoviesPage, type Movie } from '@entities/movie'
import {
  catalogParams,
  normalizeSearchUrl,
  page,
  searchQuery,
} from '@features/catalog-filter'
import {
  computed,
  effect,
  sleep,
  urlAtom,
  withAsyncData,
  withConnectHook,
  wrap,
} from '@reatom/core'
import { trackEvent } from '@shared/lib'

type CatalogMode = 'search' | 'catalog'

export type CatalogResult = {
  movies: Movie[]
  mode: CatalogMode
  totalPages: number
}

const EMPTY_RESULT: CatalogResult = {
  movies: [],
  mode: 'catalog',
  totalPages: 0,
}

// Серия быстрых коммитов ?q (дебаунс шапки короче) считается одним «submit».
const SEARCH_SETTLE_MS = 800

// API не сочетает текстовый поиск с фильтрами: непустой запрос → /movie/search, фильтры
// игнорируются; пустой → каталог по фильтрам с курсорной эмуляцией страниц. catalogParams
// читается только в своей ветке, чтобы в режиме поиска его смена не перезапускала запрос.
export const catalog = computed(async (): Promise<CatalogResult> => {
  const query = searchQuery().trim()
  const currentPage = page()

  if (query) {
    const result = await wrap(fetchSearchMovies({ query, page: currentPage }))
    return { ...result, mode: 'search' }
  }

  const result = await wrap(loadMoviesPage(catalogParams(), currentPage))
  return { ...result, mode: 'catalog' }
}, 'searchCatalog.catalog').extend(
  withAsyncData({ initState: EMPTY_RESULT, status: true }),
  // Эффекты живут, пока каталог подключён (страница /search смонтирована). Сам connect-hook
  // срабатывает один раз — реагировать на смену URL должен effect внутри него.
  withConnectHook(() => {
    // Каждая смена URL, включая переход на «грязный» URL без перемонтирования страницы.
    effect(() => {
      urlAtom()
      normalizeSearchUrl()
    }, 'searchCatalog.normalizeUrl')

    // Замыкание на время подключения: повторный заход на /search с тем же ?q снова считается
    // поиском — как раньше при новом монтировании страницы.
    let lastTracked = ''
    effect(() => {
      const query = searchQuery().trim()
      if (!query) {
        // Повторный ввод того же текста после очистки поля — новый поиск.
        lastTracked = ''
        return
      }
      // Новая смена ?q отменяет ожидание прошлого запуска effect. Отмена — штатный исход,
      // поэтому отклонение гасится здесь, а не уходит в unhandled rejection.
      wrap(sleep(SEARCH_SETTLE_MS)).then(
        () => {
          if (query === lastTracked) return
          lastTracked = query
          trackEvent('search submitted')
        },
        () => {},
      )
    }, 'searchCatalog.trackSearch')
  }),
)
