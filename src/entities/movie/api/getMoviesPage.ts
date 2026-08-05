import { apiClient, type MovieControllerFindManyByQueryV15Data } from "@shared/api";
import type { Movie } from "../model/types";
import { createCachedFetcher } from "./createCachedFetcher";
import { mapDocToMovie } from "./mapDocToMovie";

export type CatalogParams = MovieControllerFindManyByQueryV15Data['query'];

export type CatalogPageResult = {
  movies: Movie[];
  totalPages: number;
};

type CursorStepParams = {
  params: CatalogParams;
  cursor?: string;
};

type CursorStepResult = {
  movies: Movie[];
  next: string | null;
  total: number | null;
};

const PER_PAGE = 10;
// demo-тариф: страницы 1–10 — clamp totalPages к потолку
const MAX_PAGES = 10;

const fetchCursorStep = async ({ params, cursor }: CursorStepParams): Promise<CursorStepResult> => {
  const response = await apiClient.getV15Movie({
    query: {
      ...params,
      limit: PER_PAGE,
      next: cursor,
      // total нужен только с первого шага курсора (страница не меняется от шага к шагу)
      withCount: cursor === undefined,
      notNullFields: ['poster.url', 'rating.kp', 'rating.imdb'],
      selectFields: ['id', 'name', 'year', 'rating', 'type', 'genres', 'movieLength', 'poster'],
    },
  })

  if (!('docs' in response.data)) {
    return { movies: [], next: null, total: null };
  }

  return {
    movies: response.data.docs.map(mapDocToMovie),
    next: response.data.next ?? null,
    total: response.data.total ?? null,
  };
}

// Кеш шагов-курсоров по ключу (params, cursor) — обобщённая фабрика Task 4
// даёт 403-cooldown и session-persist бесплатно.
const cachedCursorStep = createCachedFetcher('catalog-cursor', fetchCursorStep)

export const fetchCatalogCursor = (params: CatalogParams, cursor?: string): Promise<CursorStepResult> =>
  cachedCursorStep({ params, cursor })

const toTotalPages = (total: number | null): number => {
  // total недоступен (withCount не отработал) — не режем пагинацию, отдаём потолок demo-тарифа
  if (total === null) {
    return MAX_PAGES;
  }

  return Math.min(MAX_PAGES, Math.ceil(total / PER_PAGE));
}

const walkToPage = async (params: CatalogParams, page: number): Promise<CatalogPageResult> => {
  let cursor: string | undefined;
  let total: number | null = null;
  let step: CursorStepResult = { movies: [], next: null, total: null };

  for (let current = 1; current <= page; current += 1) {
    step = await fetchCatalogCursor(params, cursor);

    if (current === 1) {
      total = step.total;
    }

    if (current === page) {
      break;
    }

    if (!step.next) {
      // курсор закончился раньше целевой страницы — пустой хвост
      return { movies: [], totalPages: toTotalPages(total) };
    }

    cursor = step.next;
  }

  return { movies: step.movies, totalPages: toTotalPages(total) };
}

// page-level промис-мемо: обход next 1..N выполняется один раз на (params, page);
// повторный вызов возвращает тот же Promise (важно для стабильности use()/Suspense).
// In-memory, не переживает reload — см. план (Post-Completion).
const pageCache = new Map<string, Promise<CatalogPageResult>>()

export const getMoviesPage = (params: CatalogParams, page: number): Promise<CatalogPageResult> => {
  const key = JSON.stringify({ params, page })
  const cached = pageCache.get(key)

  if (cached) {
    return cached
  }

  const promise = walkToPage(params, page)
  pageCache.set(key, promise)

  return promise
}
