# Kino•shka

[![CI](https://github.com/olegdenisov/kinoshka/actions/workflows/ci.yml/badge.svg)](https://github.com/olegdenisov/kinoshka/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
[![Feature-Sliced Design](https://img.shields.io/badge/Architecture-FSD-blueviolet)](https://feature-sliced.design/)

Каталог фильмов — SPA с лентой на главной, поиском, фильтрами, страницами фильмов (обзор, каст, медиа), списком избранного (хранится в localStorage браузера, без синхронизации между устройствами), разделом «Popular this week» (`/popular`) с позициями фильмов в рейтинге и их изменением, и разделом «Recommended for you» (`/recommendations`) — рекомендации, вычисленные чистым правилом поверх избранного (топ-3 жанра + средний рейтинг избранного), и профилем (`/profile`) — локальное имя (хранится в localStorage, без бэкенда), быстрые ссылки на избранное/популярное/рекомендации и выбор темы Light/Dark/System, а также страницей персоны (`/person/:id`) — фото, дата рождения/возраст, профессии, фильмография со ссылками на карточки фильмов и факты, доступной по клику на актёра/члена съёмочной группы со страницы фильма.

## Стек

- **React 19** + **TypeScript 7** + **Vite 8**
- **React Router 7** — клиентская маршрутизация
- **React Compiler** — автоматическая мемоизация (`babel-plugin-react-compiler`); ручные `useMemo` / `useCallback` / `memo` не нужны
- **Vitest** + **Testing Library** + **MSW** — юнит и интеграционные тесты, мокирование API-запросов
- **Playwright** + **axe-core** — E2E-тесты в реальном браузере против production preview-сборки (`vite preview`) и реального API, с a11y-проверкой (`AxeBuilder`) в каждом сценарии; отдельный mobile-viewport project (`devices['iPhone 13']`) на `/`, `/search`, `/movie/:id`
- **Zod** — валидация данных (localStorage, API-границы)
- **oxlint** — Rust-линтер (TS/React/jsx-a11y правила)
- **husky** + **lint-staged** + **commitlint** — pre-commit линтинг и conventional commits (`pnpm commit`)
- **Sentry** (`@sentry/react` + `@sentry/vite-plugin`) — error tracking и Performance-трейсинг (`tracesSampleRate=0.2`, параметризованные роуты типа `/movie/:id` группируются в один transaction через `reactRouterBrowserTracingIntegration`/`wrapCreateBrowserRouter`) в prod-сборке, аплоад source maps на этапе билда; alert/dashboard-провижининг as code (`make sentry-telemetry`) поверх `sentry` CLI
- **Plausible** — privacy-friendly event tracking (page view, search submitted, filter changed, favorite added) в prod-сборке; Core Web Vitals (LCP/INP/CLS) теперь собираются через Sentry Performance (см. выше), а не через отдельный `web-vitals`-пайплайн

## Команды

```bash
make dev              # dev-сервер с HMR
make build            # проверка типов (tsc -b) + production-сборка
make lint             # oxlint по всем TS/TSX-файлам
make preview          # раздача production-сборки локально
make test             # запустить тесты один раз
make test-watch       # тесты в watch-режиме
make coverage         # отчёт покрытия
make e2e              # E2E-тесты (Playwright) против production preview-сборки
make e2e-install      # установить браузеры Playwright (chromium + webkit)
make lighthouse       # Lighthouse CI dev-smoke локально (не авторитетный источник порогов, см. AGENTS.md)
make generate-api     # регенерировать API-клиент из OpenAPI-спецификации
make check            # format-check + lint + build (полная проверка)
make hooks            # установить git-хуки husky
make audit            # pnpm audit (prod-зависимости, high severity)
make analyze          # визуализация состава бандла (dist/stats.html)
make size             # бюджеты размера бандла (size-limit)
make knip             # детектор неиспользуемого кода/зависимостей
make sentry-telemetry # провижининг Sentry alert/dashboard as code (см. sentry-telemetry.config.ts)
make clean            # удалить dist и node_modules
```

## Архитектура

Проект следует [Feature-Sliced Design](https://feature-sliced.design/):

```
src/
├── app/        # провайдеры, роутер, глобальные стили
├── pages/      # компоненты уровня роута
├── widgets/    # крупные переиспользуемые секции UI (header, mobile-chrome, movie-rail, search-sidebar)
├── features/   # интерактивные фичи (catalog-filter, favorites, watched, watchlist, theme, recommendations, profile)
├── entities/   # бизнес-объекты (movie, person — типы, данные, UI)
└── shared/     # утилиты и примитивы (lib/, ui/)
```

Направление импортов: `pages → widgets → features → entities → shared`. Импорты вверх по слоям запрещены.

## Адаптивность

Mobile-first: у каждой страницы/виджета один компонент и один CSS-модуль — мобильная раскладка безусловная (базовая), десктопные переопределения идут в блоках `@media (min-width: 720px)` поверх неё. Пары `*Desktop`/`*Mobile` не используются. Breakpoint: **720px** (`MOBILE_BREAKPOINT`, `src/shared/lib/viewport/useViewport.ts`).

Хук `useViewport` остался, но его вызовы намеренно сужены до двух точечных JS-развилок — случаев, когда разница не CSS-вариант оформления, а выбор, какой компонент монтировать (и его сайд-эффекты):

- `src/app/layouts/AppLayout.tsx` — выбирает `Header` (`@widgets/header`) или `MobileHeader`+`BottomNav` (`@widgets/mobile-chrome`).
- `src/pages/search/ui/Search/Search.tsx` — выбирает `SearchSidebar` (`@widgets/search-sidebar`) или мобильный filter-bar + `BottomSheet`.

Остальные бывшие `useViewport()`-развилки (старые `*Page.tsx`, стрелки скролла в `MovieRail` и т.п.) свелись к чистому CSS.

## Структура компонентов

Каждый компонент живёт в собственной директории с CSS-модулем:

```
ComponentName/
├── index.tsx
└── ComponentName.module.css
```

Каждый слайс `widgets/` и `features/` предоставляет публичный API через `index.ts` в корне слайса. Всегда импортируй через него, не через внутренние пути:

```ts
import { Header } from '@widgets/header' // ✓
import { Header } from '@widgets/header/ui/Header' // ✗
```

## Соглашения

- **Типы:** использовать `type`, не `interface`
- **TypeScript:** включены `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` — `enum` и `namespace` запрещены
- **Стили:** CSS Modules (`ComponentName.module.css`), hover-состояния через `:hover`, не через `useState`
- **Иконки:** SVG-спрайт `public/icons.svg`; ссылка через `<use href="/icons.svg#<id>" />`
- **Шрифты:** Instrument Serif, Instrument Sans, JetBrains Mono (Google Fonts, загружаются в `index.html`) — новые шрифты не добавлять

## Ветка `zustand`: Zustand

> Ветка не предназначена для слияния в `main`: она живёт параллельно ему как эксперимент для сравнительной таблицы roadmap 3.8 (рядом с `rtk`). Запрет обеспечивает job `branch-guard` в CI.

Ветка повторяет функциональность `main`, но весь стейт идёт через Zustand: клиентский — изолированные сторы с `persist`, серверный — query-сторы, созданные общей фабрикой `createQueryStore`. Второго механизма кеша в ветке нет (`createCachedFetcher`, `sessionCache`, `use()` + `AsyncBoundary`, `useStorageSlot` удалены). Поведение и ключи `localStorage` (`kinoshka:*`) те же, что на `main`.

### Разбор паттернов

- **Много маленьких сторов.** Каждая фича (`favorites`, `theme`, `watched`, `watchlist`, `profile`) и каждый запрос — отдельный стор; компонент подписывается только на свой. Не-URL стейт страницы поиска (шторки фильтров/сортировки) — `useSearchUiStore` внутри страницы.
- **Persist поверх существующего слота.** `createPersistedStore` подключает `persist` с кастомным `storage`-адаптером над `createStorageSlot`. В `localStorage` по-прежнему лежит голое значение (без envelope `{ state, version }`), поэтому инлайн-скрипт темы и CSP-хэш не тронуты, а данные существующих пользователей читаются без потерь. Zod-валидация и репорт сбоев в Sentry остаются в слоте. Гидрация синхронная — первый рендер уже с данными.
- **Откат неудачной записи.** Адаптер запоминает результат `slot.set()`; если запись не удалась (квота, приватный режим), стор через `persist.rehydrate()` возвращается к содержимому хранилища, а `commit` возвращает `false`. На этом держатся `boolean`-результат `useProfile().setName` и правило «аналитика только при успешной записи».
- **Синхронизация вкладок.** `slot.subscribe` → `rehydrate()`; собственные уведомления слота пропускаются флагом «идёт своя запись».
- **`useShallow`.** Примитив или одно поле читается простым селектором, несколько полей объектом — через `useShallow`; экшены берутся отдельным селектором (стабильны по ссылке).
- **Фабрика query-сторов.** `createQueryStore({ name, fetcher })` — мини-кеш запросов на vanilla-сторе: записи по ключу параметров, дедупликация in-flight, TTL, 20-секундный кулдаун ошибок (бережёт квоту demo-API). Запрос стартует из эффекта `useQuery`, а не во время рендера.
- **Композиция через `fetch()`.** Императивный `queryStore.fetch(params)` делит кеш с другими сторами: `getMoviesByIds` переиспользует детали фильма, каталог — шаги курсора, рекомендации — оба. Составной стор отдаёт один `QueryResult` и один `refetch`.
- **Stale-while-fetching.** Опция `keepPreviousData` держит прежние данные на экране, пока грузится новый ключ; `isFetching` — индикатор обновления на `/search`.
- **Нет провайдера.** Сторы module-level, `providers.tsx` не менялся. Цена — глобальные синглтоны: тесты сбрасывают их через реестр (`resetAllStores`).
- **`QueryBoundary`** (`@shared/ui`) вместо Suspense + `AsyncBoundary`: принимает структурный тип результата запроса, Retry = `refetch`.

### Плюсы и минусы

- Плюсы: минимум бойлерплейта (стор — одна функция, без slice/action/reducer); нет провайдера; подписка на конкретный селектор даёт точечные ререндеры; лёгкий бандл (+1.6 KB gzip к `main`); DevTools через `devtools` middleware только в DEV.
- Минусы: кеш запросов приходится писать самим (дедупликация, TTL, кулдаун, `keepPreviousData`, композиция) — Zustand его не даёт; нет инвалидации по тегам, поэтому связи между сторами (например, рекомендации от избранного) выражаются ключом запроса; ошибки несериализуемые (`ApiError` хранится как есть); module-level синглтоны требуют сброса в тестах.
- Потеряно относительно `main`: Suspense/`use()` и декларативные границы загрузки (состояния читаются из статуса); `sessionStorage`-персист кеша в DEV; вытеснение записей кеша — записи живут до перезагрузки, протухшие данные показываются сразу и обновляются в фоне.
- Сравнение с `rtk`: у RTK Query кеш, дедупликация, теги и подписки есть из коробки, но заметно больше бойлерплейта и +26 KB gzip в `vendor`. Zustand легче (около +1.6 KB), но серверный стейт здесь учебная самописная конструкция.

### Почему фильтры каталога не в сторе

Roadmap 3.2 предполагает `useFiltersStore`, но ветка его не заводит: URL остаётся единственным источником истины для запроса, фильтров, сортировки и страницы (ссылки, back/forward). Дублирование в сторе потребовало бы двусторонней синхронизации и дало бы второй источник истины. В стор уходит только то, чего в URL нет, — открытость шторок.

### Оговорка про query-кеш

`createQueryStore` — учебная конструкция, она нужна, чтобы честно сравнить подходы в таблице 3.8. В production-проекте серверный стейт берут из TanStack Query (roadmap 3.7), а Zustand оставляют для клиентского стейта.

### Разница бандла с `main` и `rtk`

Gzip-размеры из `size-limit`, все билды с `VITE_SENTRY_DSN` (подробности — `docs/concepts/zustand-bundle-diff.md`).

| Чанк                 | main, KB | rtk, KB | zustand, KB | diff с main, KB | diff с rtk, KB |
| -------------------- | -------- | ------- | ----------- | --------------- | -------------- |
| entry                | 3.53     | 3.83    | 3.54        | +0.01           | -0.29          |
| vendor               | 169.15   | 194.32  | 170.45      | +1.30           | -23.87         |
| shared               | 21.57    | 22.38   | 22.17       | +0.60           | -0.21          |
| page-home            | 2.58     | 2.47    | 2.47        | -0.11           | 0.00           |
| page-movie           | 8.04     | 8.07    | 8.08        | +0.04           | +0.01          |
| page-favorites       | 1.15     | 1.18    | 1.10        | -0.05           | -0.08          |
| page-watched         | 1.14     | 1.17    | 1.09        | -0.05           | -0.08          |
| page-watchlist       | 1.09     | 1.12    | 1.06        | -0.03           | -0.06          |
| page-popular         | 1.13     | 1.17    | 1.16        | +0.03           | -0.01          |
| page-recommendations | 1.24     | 1.46    | 1.22        | -0.02           | -0.24          |
| page-search          | 5.88     | 5.58    | 5.73        | -0.15           | +0.15          |
| page-profile         | 2.80     | 2.80    | 2.79        | -0.01           | -0.01          |
| page-person          | 3.82     | 3.84    | 3.85        | +0.03           | +0.01          |

Итого к `main`: около +1.6 KB gzip, почти всё в `vendor` (`zustand` и `persist`). Против `rtk` ветка легче примерно на 25 KB.

## Sentry MCP

В корне репозитория закоммичен `.mcp.json` с project-scoped Sentry MCP-сервером (`https://mcp.sentry.dev/mcp`). После клонирования репозитория Claude Code предложит авторизовать этот MCP-сервер через OAuth — подтвердите авторизацию, чтобы получить доступ к Sentry-инструментам (issues, alerts, dashboards) прямо из сессии. Опционально можно локально (не в коммите) сузить `url` до `https://mcp.sentry.dev/mcp/mycomp-ey/kinoshka`, ограничив MCP-сервер конкретными org/project.
