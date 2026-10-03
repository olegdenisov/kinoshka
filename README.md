# Kino•shka

[![CI](https://github.com/olegdenisov/kinoshka/actions/workflows/ci.yml/badge.svg)](https://github.com/olegdenisov/kinoshka/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
[![Feature-Sliced Design](https://img.shields.io/badge/Architecture-FSD-blueviolet)](https://feature-sliced.design/)

Каталог фильмов — SPA с лентой на главной, поиском, фильтрами, страницами фильмов (обзор, каст, медиа), списком избранного (хранится в localStorage браузера, без синхронизации между устройствами), разделом «Popular this week» (`/popular`) с позициями фильмов в рейтинге и их изменением, и разделом «Recommended for you» (`/recommendations`) — рекомендации, вычисленные чистым правилом поверх избранного (топ-3 жанра + средний рейтинг избранного), и профилем (`/profile`) — локальное имя (хранится в localStorage, без бэкенда), быстрые ссылки на избранное/популярное/рекомендации и выбор темы Light/Dark/System, а также страницей персоны (`/person/:id`) — фото, дата рождения/возраст, профессии, фильмография со ссылками на карточки фильмов и факты, доступной по клику на актёра/члена съёмочной группы со страницы фильма.

## Стек

- **React 19** + **TypeScript 7** + **Vite 8**
- **Reatom v1001** (`@reatom/core`, `@reatom/react`) — client state, server state, URL-состояние и роутинг (`reatomRoute`); React Router удалён
- **React Compiler** — автоматическая мемоизация (`babel-plugin-react-compiler`); ручные `useMemo` / `useCallback` / `memo` не нужны
- **Vitest** + **Testing Library** + **MSW** — юнит и интеграционные тесты, мокирование API-запросов
- **Playwright** + **axe-core** — E2E-тесты в реальном браузере против production preview-сборки (`vite preview`) и реального API, с a11y-проверкой (`AxeBuilder`) в каждом сценарии; отдельный mobile-viewport project (`devices['iPhone 13']`) на `/`, `/search`, `/movie/:id`
- **Zod** — валидация данных (localStorage, API-границы)
- **oxlint** — Rust-линтер (TS/React/jsx-a11y правила)
- **husky** + **lint-staged** + **commitlint** — pre-commit линтинг и conventional commits (`pnpm commit`)
- **Sentry** (`@sentry/react` + `@sentry/vite-plugin`) — error tracking и Performance-трейсинг (`tracesSampleRate=0.2`, спаны pageload/navigation создаются вручную в `src/app/model/routeTracing.ts` с именем по шаблону роута, так что `/movie/:id` — один transaction) в prod-сборке, аплоад source maps на этапе билда; alert/dashboard-провижининг as code (`make sentry-telemetry`) поверх `sentry` CLI
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

- **Типы:** использовать `type`, не `interface` (исключения: `Window` в `src/vite-env.d.ts` и `RouteChild` в `src/app/reatom.d.ts` — declaration merging)
- **TypeScript:** включены `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` — `enum` и `namespace` запрещены
- **Стили:** CSS Modules (`ComponentName.module.css`), hover-состояния через `:hover`, не через `useState`
- **Иконки:** React-компоненты из `@shared/ui`; `public/icons.svg` — спрайт только с соцсетями
- **Шрифты:** Instrument Serif, Instrument Sans, JetBrains Mono (Google Fonts, загружаются в `index.html`) — новые шрифты не добавлять

## Ветка `reatom`: миграция на Reatom v1001

Сравнительная ветка фазы 3 роадмапа (пункт 3.3), в `main` не мержится. Реализация — на **Reatom v1001** (`@reatom/core@1001.3.0`), а не на v3, как написан пункт роадмапа. Охват «полный стек»:

| Слой          | `main`                                       | Ветка `reatom`                                                                                       |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| client state  | `createStorageSlot` + `useSyncExternalStore` | `atom` / `reatomSet` / `reatomEnum` + `withLocalStorage(persistOptions(...))`                        |
| server state  | `createCachedFetcher` + `use()` + Suspense   | `action + withAsync + withQueryCache`, ресурсы — `computed(async) + withAsyncData({ status: true })` |
| URL-состояние | `useSearchParams`                            | `computed` поверх `urlAtom`, каждая мутация — один `urlAtom.set(fn, true)` в action                  |
| роутинг       | React Router 7                               | `reatomRoute` (layout-роут, `render`/`outlet()`, loaders для `/movie/:id` и `/person/:id`)           |

### Паттерны

- Компонент, читающий атомы, — `reatomComponent(..., 'Name')`; обработчики — `wrap(...)`. Обычный компонент с прямым вызовом атома ломает React Compiler: результат кэшируется один раз и устаревает.
- Persist — штатный `withLocalStorage`; ключ, TTL «навсегда» и Zod-валидацию задаёт хелпер `persistOptions` (`src/shared/lib/persist`).
- Кэш запросов — только на `action` через `withQueryCache` (5 минут, под квоту API). Данные страницы — по `status()` и презентационному `AsyncContent`; Suspense остался только для ленивых чанков страниц.
- Все роуты — в `src/app/routes.tsx`; нижние слои знают только строители путей `paths` (`@shared/config`) и обычные `<a href>`.
- Тесты изолируются одним `afterEach` в `src/test/setup.ts`; URL в компонентных тестах задаёт `renderWithRouter`.

### Плюсы и минусы

- Плюс: гранулярные подписки, один механизм для state/async/URL/роутов, нативные persist, кросс-таб синхронизация и fallback на память без своего кода; бандл `vendor` меньше на ~9 KB.
- Минус: больше неочевидных ловушек (React Compiler, TTL persist, `withCache` на `computed`, `withSearchParams`), документация местами расходится с `1001.3.0`; требует дисциплины с `reatomComponent`; нет из коробки восстановления скролла и интеграции с Sentry — написаны вручную.

### Дельта бандла (gzip, с `VITE_SENTRY_DSN`, относительно `main`)

- entry: ~3.5 KB -> ~4.5 KB (+~1 KB)
- vendor: ~160.6 KB -> ~151.6 KB (-~9 KB)
- shared: ~19.7 KB -> ~20.4 KB (+~0.7 KB)

### Принятые изменения поведения

- Нет сигнала о сбое записи в `localStorage`: Reatom проглатывает ошибку `setItem`, состояние живёт в памяти. `/profile` не показывает «не удалось сохранить», событие `favorite added` не зависит от успеха записи, отчёта о сбое хранилища в Sentry нет.
- Нет 20-секундного кэша ошибок: ресурс без зависимостей после ошибки не перезапрашивается до `retry()`, loader при повторном заходе на упавший роут шлёт один новый запрос.
- Словари жанров и стран: пока идёт перезапрос устаревшего словаря, показывается статический fallback; 60-секундный кулдаун после ошибки заменён на «без повтора до перезагрузки страницы».
- Неизвестный путь показывает страницу `NotFound` (на `main` catch-all роута нет).
- Старые «сырые» значения `localStorage` читаются как отсутствующие и дают дефолт (формат с `main` несовместим).

## Sentry MCP

В корне репозитория закоммичен `.mcp.json` с project-scoped Sentry MCP-сервером (`https://mcp.sentry.dev/mcp`). После клонирования репозитория Claude Code предложит авторизовать этот MCP-сервер через OAuth — подтвердите авторизацию, чтобы получить доступ к Sentry-инструментам (issues, alerts, dashboards) прямо из сессии. Опционально можно локально (не в коммите) сузить `url` до `https://mcp.sentry.dev/mcp/mycomp-ey/kinoshka`, ограничив MCP-сервер конкретными org/project.
