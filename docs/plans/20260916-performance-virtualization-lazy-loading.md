# Performance — виртуализация, lazy-loading, Lighthouse (roadmap 2.7)

## Overview

Roadmap `2.7` содержит четыре чекбокса: (1) виртуализация rails на главной, (2) виртуализация грида `/search` — условно, только если появится infinite scroll, (3) `loading="lazy"`/`decoding="async"` на изображениях, (4) замер Lighthouse Performance до/после. Блок «Как лучше» под чекбоксами отдельно советует `IntersectionObserver` для lazy-mount тяжёлых секций и `content-visibility: auto` для offscreen-rails — это не отдельные требования, а техники для выполнения тех же чекбоксов.

Discovery (см. ниже) показал, что буквальная реализация первого чекбокса («виртуализация rails на главной») не имеет смысла на текущих данных — и это решение подтверждено пользователем перед составлением плана (см. AskUserQuestion в сессии планирования).

**Что входит в план:**

1. `content-visibility: auto` на секциях rails главной страницы — совпадает по духу с «виртуализацией» (браузер пропускает layout/paint для offscreen-контента), не требует сторонней библиотеки и не конфликтует с существующим hover-arrow `scrollBy`.
2. `loading="lazy"`/`decoding="async"` на всех оставшихся `<img>` без этих атрибутов (аватары каста, скриншоты в Media-табе; постеры уже частично готовы).
3. `useInView()` — общий хук на `IntersectionObserver` (`@shared/lib`) + lazy-mount `RelatedMovies` (всегда смонтированная секция «Similar titles» под табами `/movie/:id`).
4. Замер Lighthouse Performance (`/` и `/movie/:id`) до и после — baseline в первой задаче, повторный замер в задаче верификации.

**Что осознанно не входит** (и почему — см. Technical Details):

- `@tanstack/react-virtual`/`react-window` для rails главной — demo-тариф API (`limit ≤ 10`, см. AGENTS.md/roadmap 1.1) ограничивает каждый rail максимум 10 карточками; виртуализация списка из ≤10 элементов не даёт измеримого выигрыша и конфликтует по сложности с текущим hover-arrow `scrollBy(480px)`. Пользователь подтвердил это решение при планировании.
- Виртуализация грида `/search` — сам roadmap обуславливает её переходом на infinite scroll; `/search` остаётся на нумерованной пагинации (`MAX_PAGE = 10`, `src/pages/search/model/usePageSync.ts`), условие не выполняется.

## Context (from discovery)

- **Rails главной** (`src/widgets/movie-rail/ui/MovieRail/MovieRail.tsx` + `.module.css`) — горизонтальный scroll-контейнер, `ArrowBtn` скроллит на фиксированные 480px. `Home.tsx` монтирует 4 rails (`PopularMoviesRail`, `TrandingSeriesRail`, `TopAnimeRails`, `PersonalRails`). Только `usePopularMovies.ts` передаёт `limit: 10` явно (`POPULAR_PARAMS`); `useNewMovies.ts`/`useTopRatedMovies.ts` (3 из 4 rails, через общий `getMovies.ts`) **не передают `limit` вообще** — `getMovies.ts` не задаёт его по умолчанию. Потолок в ≤10 карточек на этих трёх rails — не параметр запроса, а внешний факт demo-тарифа API (roadmap 1.1: «limit ≤ 10»), а не гарантия, читаемая из кода. Если тариф сменится или в `getMovies.ts` добавят явный `limit`, это обоснование виртуализации устареет молча — см. заметку про внешний факт в Task 5.
- **`Poster.tsx`** (`src/entities/movie/ui/Poster/`) уже рендерит `<img loading='lazy' ... />`, но без `decoding='async'`. Тест `Poster.test.tsx` проверяет только `loading=lazy`.
- **`CastTab.tsx`** (`src/pages/movie/ui/tabs/CastTab/`) рендерит `<img className={s.avatar} src={c.photo} ...>` без `loading`/`decoding` вообще, без теста (`CastTab.test.tsx` не существует).
- **`MediaTab.tsx`** (`src/pages/movie/ui/tabs/MediaTab/`) рендерит грид скриншотов `<img src={image.previewUrl ?? image.url} ...>` без `loading`/`decoding`, без теста.
- **`Movie.tsx`** (`src/pages/movie/ui/Movie/`) рендерит табы условно (`{tab === 'X' && <XTab/>}` — уже не в DOM, пока не выбраны), но `<RelatedMovies movies={related} movieTitle={movie.title} />` смонтирован **безусловно**, ниже табов. `movie.similarMovies` (до 6 штук) уже доступен синхронно из данных детальной страницы — отдельного запроса на "похожие" нет.
- **`@shared/lib`** (`src/shared/lib/index.ts`) — баррель с `useViewport`, `createStorageSlot`/`useStorageSlot`, `createSessionCache`, `useDebouncedValue`, `lazyNamed`, analytics-хелперы. Паттерн для нового хука: своя поддиректория (`viewport/`, `debounce/`) + реэкспорт из барреля.
- **`src/test/setup.ts`** — глобальные стабы для jsdom (`window.matchMedia`, MSW-хендлер для genre dictionary). `IntersectionObserver` **не застаблен нигде** — jsdom его не реализует, а `RelatedMovies` после этой задачи станет первым потребителем.
- **`plans/roadmap.md`** уже документирует похожие «буквальная формулировка vs факт» отклонения прямо в тексте пункта (см. 1.1, 1.4, 2.3) — этот план продолжает тот же стиль.

## Development Approach

- **Testing approach:** Regular (код → тесты), как во всех завершённых планах в `docs/plans/completed/`.
- Каждая задача — атомарная, со своим `Files:`-блоком и тестами, тесты должны проходить до перехода к следующей задаче.
- React Compiler уже мемоизирует — `useMemo`/`useCallback` не добавлять (AGENTS.md).
- CSS-only правки (Task 1) не требуют нового юнит-теста — jsdom не считает layout/`content-visibility`; регрессия проверяется прогоном существующего `MovieRail.test.tsx`.

## Testing Strategy

- **Unit-тесты:** обязательны для `useInView` (новый хук) и для всех изменённых компонентов с проверяемым поведением (`Poster`, `CastTab`, `MediaTab`, `RelatedMovies`).
- **CSS-only изменения** (Task 1): без нового теста, но с явной проверкой, что существующий тест не сломался.
- **E2E:** проект имеет Playwright (`e2e/`), но эта задача не меняет пользовательские сценарии (только атрибуты изображений и момент маунта одной секции) — новый E2E-сценарий не нужен; в задаче верификации — прогнать существующий `e2e/movie*.spec.ts`/smoke, если локально настроен `VITE_API_KEY` (не блокирующе, см. Post-Completion).
- **Lighthouse:** ручной, локальный замер через `npx lighthouse` против прод-сборки, поднятой на фиксированном порту (`vite preview --port 4173 --strictPort`, тот же паттерн, что у `playwright.config.ts`) — методология (3 прогона на страницу/фазу, медиана, единый 5%-порог по score/LCP/CLS/TBT, пин версии CLI) зафиксирована в Progress Tracking; не CI-интеграция (это отдельный roadmap-пункт 2.5.6, `@lhci/cli`, ещё не реализован); никакой новый devDependency не добавляется. **Квота:** ~36 API-запросов (24 на `/`, 12 на `/movie/:id`; см. точный расчёт в Progress Tracking) — около 18% суточного лимита 200 запросов, не совмещать с `make e2e` (~40-50 запросов) в один день без проверки остатка квоты.

## Progress Tracking

Обновлять чекбоксы по мере выполнения. Baseline/after-Lighthouse-числа фиксировать прямо в этом файле (секция ниже), как только будут измерены.

**Методология замера (одна и та же в Task 1 и Task 4, чтобы числа были сравнимы):**

- Собрать прод-бандл и поднять preview **в фоне, на фиксированном порту** — тот же паттерн, что уже использует `playwright.config.ts`: `make build-only && pnpm exec vite preview --port 4173 --strictPort &` (отдельный терминал/background job), дождаться готовности сервера, только потом запускать Lighthouse; после серии прогонов — остановить preview-процесс явно.
- Зафиксировать версию CLI один раз перед baseline: `npx lighthouse --version`, записать строку версии в Progress Tracking; в фазе "после" (Task 4) вызывать `npx lighthouse@<та же версия>` — иначе baseline и after могут быть посчитаны разными релизами Lighthouse (`npx lighthouse` без пина резолвит `latest` на момент вызова).
- Для `/movie/:id` — выбрать один конкретный, заранее проверенный валидный id (`GET`-запросом убедиться, что фильм существует и не 404-ит) и использовать этот же id в baseline и after — не полагаться на «любой id».
- `npx lighthouse@<pinned> http://localhost:4173/<path> --preset=desktop --only-categories=performance --output=json --output-path=<scratchpad>/lh-<page>-<before|after>-<n>.json` — **3 прогона подряд** на каждую страницу/фазу (не 5 — см. пересчёт квоты ниже), `--preset=desktop` фиксирует throttling явно.
- Из 3 JSON-отчётов брать **медиану** Performance-score и отдельно медианы LCP/CLS/TBT, а также **min/max по каждой метрике** (разброс внутри одной серии нужен для интерпретации критерия ниже — если сам baseline "гуляет" в пределах 5%, порог неприменим).
- Отчёты (`.json`) хранить в scratchpad-директории сессии, не коммитить в репозиторий; в PR/этот файл идут только итоговые числа.
- **Критерий приёмки:** после (Task 4) — регрессия по метрике засчитывается, только если она одновременно (а) превышает 5% от baseline-медианы **и** (б) превышает абсолютный шумовой порог: CLS > 0.01, TBT > 20ms, LCP > 50ms (у этого SPA на `--preset=desktop` CLS/TBT обычно близки к нулю — чисто относительный 5%-порог на почти нулевых числах либо всегда «проваливается» от шума, либо всегда проходит от округления; для Performance-score, целочисленного 0-100, отдельный абсолютный порог не нужен, оставить только 5%). При регрессии, удовлетворяющей обоим условиям — определить, какой из трёх шагов (Task 1/2/3) виноват, и либо исправить, либо откатить именно его, не весь план. **Отсутствие изменений — ожидаемый и приемлемый исход**, не провал: изменения точечные (4 rail-секции + skeleton ≤10 карточек, 6 карточек `RelatedMovies` уже с `loading='lazy'`), а живой demo-API вносит собственную дисперсию TTFB, которую 3 прогона гасят не полностью; roadmap-чекбокс «Lighthouse измерен до/после» закрывается фактом измерения, а не обязательным ростом числа.
- **Пересчёт нагрузки на API (без кэша — каждый Lighthouse-прогон это свежий Chrome и полная загрузка страницы; `createSessionCache` персистится в `sessionStorage` только под `import.meta.env.DEV`, в прод-preview не помогает):** `/` делает 4 API-вызова за загрузку (по одному на rail) → 3 прогона × 4 вызова × 2 фазы (baseline/after) = **24 вызова**; `/movie/:id` делает 2 параллельных вызова (`getMovieDetail`+`getMovieImages`) → 3 × 2 × 2 = **12 вызовов**. Итого **~36 запросов** к demo-API только на Lighthouse — около 18% суточной квоты в 200 запросов. Не запускать в тот же день, что и `make e2e` (~40-50 запросов) без явного расчёта оставшейся квоты. Если API ответит 403 (лимит исчерпан) посреди серии — остановиться, зафиксировать сколько прогонов реально собрано, не дожидаться полных 3, и явно пометить это в Progress Tracking, а не подставлять частичные данные как финальную медиану.

**Lighthouse Performance (`/`, `--preset=desktop`, медиана из 3 прогонов):**

- Lighthouse CLI версия (зафиксирована в Task 1, переиспользуется в Task 4): _TBD_
- Baseline (до, Task 1): _TBD_ (score / LCP / CLS / TBT)
- После (Task 4): _TBD_ (score / LCP / CLS / TBT)

**Lighthouse Performance (`/movie/:id`, `--preset=desktop`, медиана из 3 прогонов):**

- Использованный movie id: _TBD_
- Baseline (до, Task 1): _TBD_ (score / LCP / CLS / TBT)
- После (Task 4): _TBD_ (score / LCP / CLS / TBT)

## Solution Overview

- **Rails главной:** `content-visibility: auto` + `contain-intrinsic-size` на `.section` — в `MovieRail.module.css` (загруженное состояние) **и** в `MovieRailSkeleton.module.css` (состояние загрузки, которое реально присутствует в измеряемом Lighthouse-окне) — браузер пропускает рендер-работу для rails ниже первого экрана до скролла, без стороннего JS/библиотеки.
- **Изображения:** дополнить недостающие `loading='lazy' decoding='async'` там, где их ещё нет (`CastTab`, `MediaTab`), и добавить `decoding='async'` туда, где уже есть `loading='lazy'` (`Poster`).
- **`RelatedMovies`:** новый общий хук `useInView()` на `IntersectionObserver` оборачивает контейнер — секция не рендерит `Card`-сетку, пока не попадёт во viewport хотя бы частично; после первого попадания — остаётся смонтированной (once-триггер, без повторных unmount/remount на скролле туда-обратно). Выигрыш здесь — только React-рендер и размер DOM (6 `Card`-узлов + 6 подписок `useFavorites`), **не сетевая загрузка изображений**: постеры внутри `Card`→`Poster` уже рендерятся с `loading='lazy'` независимо от этой задачи, так что offscreen-постеры браузер и без lazy-mount не качает. Делается по прямому указанию roadmap 2.7 («IntersectionObserver для lazy-mount тяжёлых секций») и решению пользователя при планировании — не ради заметного изменения Lighthouse-цифр.
- **Lighthouse:** ручной baseline/after замер, зафиксированный в этом файле и в PR — не автоматизация.

## Technical Details

### Маппинг на чекбоксы roadmap 2.7

После выполнения плана `plans/roadmap.md` 2.7 будет обновлён так:

```
- [ ] `@tanstack/react-virtual` (либо `react-window`) для rails на главной — не реализовано:
      demo-тариф API ограничивает rails ≤10 карточками (limit: 10), виртуализация списка
      такого размера не даёт измеримого выигрыша и конфликтует по сложности с hover-arrow
      `scrollBy`. Вместо этого — `content-visibility: auto` на rail-секциях. См.
      docs/plans/20260916-performance-virtualization-lazy-loading.md.
- [ ] Виртуализация грида `/search` при infinite scroll — не применимо: `/search` остаётся
      на нумерованной пагинации (1.4, MAX_PAGE=10), infinite scroll не внедрялся.
- [x] `<img loading="lazy" decoding="async" />` на постерах — постеры (`Poster.tsx`),
      аватары каста (`CastTab.tsx`), скриншоты (`MediaTab.tsx`).
- [x] Lighthouse Performance измерен до/после — см. Progress Tracking в плане.
```

### `useInView` — сигнатура

```ts
// src/shared/lib/inView/useInView.ts
export const useInView = <T extends Element = HTMLElement>(
  options?: IntersectionObserverInit,
): { ref: RefObject<T | null>; inView: boolean } => {
  /* ... */
}
```

Дефолт `<T extends Element = HTMLElement>` — без него на месте вызова `T` выводился бы в `Element`, а `ref` не подходил бы под `<div>` без явного `useInView<HTMLDivElement>()`; с дефолтом `useInView()` без параметра типа (как записано в чекбоксе Task 3 для `RelatedMovies`) уже типизируется под `HTMLElement`, которого достаточно для `ref` на `<div>`.

`rootMargin` по умолчанию `'200px'` — упреждающий маунт за 200px до фактического попадания в viewport, чтобы не было заметного pop-in контента и связанного с ним CLS-всплеска в момент, когда пользователь уже видит секцию.

**`useEffect`-зависимости:** `options` как единый объект **нельзя** класть в deps — инлайн-литерал (`useInView({ rootMargin: '0px' })`) пересоздаёт `IntersectionObserver` на каждом рендере, и `oxlint`'s `exhaustive-deps` (`.oxlintrc.json`, `"error"`) потребует его в массиве зависимостей, если он используется внутри эффекта напрямую. Деструктурировать примитивы внутри хука — `const { root = null, rootMargin = '200px', threshold } = options ?? {}` — и использовать `[root, rootMargin, threshold]` как deps эффекта (все три обычно примитивны/стабильны: `rootMargin` — строка, `threshold` — как правило не передаётся или число; массив-`threshold` — известное ограничение, требующее от вызывающего кода мемоизации, документировать в JSDoc хука, не решать в рамках этого плана). Отдельно — гард от повторного создания observer после срабатывания: `if (inView) return` в начале эффекта (иначе `inView` в deps вызовет пересоздание сразу после `setInView(true)`, до срабатывания `disconnect()` из предыдущего инстанса).

Once-триггер: после первого `entry.isIntersecting === true` — `observer.disconnect()`, `inView` остаётся `true` навсегда (осознанно не отслеживает повторный выход из viewport — секция не должна размонтироваться и терять состояние once замонтирована).

### Стаб `IntersectionObserver` в `src/test/setup.ts`

Дефолтное поведение — синхронно вызывать колбэк с `isIntersecting: true` при `observe()` (по аналогии с дефолтным `matches: false` у существующего `window.matchMedia`-стаба), чтобы все существующие тесты, монтирующие `Movie`/`MoviePage`/`RelatedMovies` и не готовящиеся специально к сценарию «вне вьюпорта», продолжали видеть контент сразу без правок. Тесты, которым нужен конкретный сценарий (`useInView.test.ts`, обновлённый кейс в `RelatedMovies.test.tsx`), переопределяют `window.IntersectionObserver` локально: сохраняют `const original = window.IntersectionObserver` в module scope теста **до** переопределения и восстанавливают его в `afterEach(() => { window.IntersectionObserver = original })` — Vitest уже изолирует `window`-глобалы между тестовыми **файлами** (`setupFiles` выполняется заново на файл), так что явный restore нужен только для изоляции между тест-кейсами **внутри одного файла**, а не как защита от межфайловой протечки. Это усиление сверх прецедента — `useTheme.test.tsx` (единственный существующий пример override глобала в проекте, `window.matchMedia`) restore в `afterEach` не делает, полагаясь на то, что каждый его тест-кейс переопределяет мок заново перед use; здесь restore добавляется отдельно, а не копируется оттуда.

## What Goes Where

- **Implementation Steps** — CSS-правка rails, атрибуты `<img>`, хук `useInView` + интеграция в `RelatedMovies`, тесты, обновление `AGENTS.md`/`roadmap.md`.
- **Post-Completion** — ручной прогон Lighthouse (браузер/CLI), ручной прогон E2E-сьюта (требует `VITE_API_KEY` и живой квоты API).

## Implementation Steps

### Task 1: Baseline Lighthouse + `content-visibility: auto` для rails главной

**Files:**

- Modify: `src/widgets/movie-rail/ui/MovieRail/MovieRail.module.css`
- Modify: `src/widgets/movie-rail/ui/MovieRail/MovieRailSkeleton.module.css`

- [ ] на текущем `main` (до изменений): `make build-only`, затем поднять preview в фоне на фиксированном порту (`pnpm exec vite preview --port 4173 --strictPort &`), проверить валидный movie id (`GET`-запросом), зафиксировать версию `npx lighthouse --version` — записать id и версию в Progress Tracking
- [ ] прогнать Lighthouse 3 раза для `/` и 3 раза для `/movie/<зафиксированный id>` по методологии из Progress Tracking (`--preset=desktop`, пиненная версия CLI), записать медианы **и min/max-разброс** (score/LCP/CLS/TBT) в секцию Progress Tracking этого файла (baseline); остановить preview-процесс после замера
- [ ] измерить в DevTools реальную высоту `.section` в `MovieRail.module.css` отдельно на мобильной раскладке (base) и на `@media (min-width: 720px)` — раскладки отличаются (типографика/отступы, см. комментарий в файле про mobile-first базу)
- [ ] добавить `content-visibility: auto;` и `contain-intrinsic-size: auto <base-height>px;` в базовый `.section`, и переопределить `contain-intrinsic-size: auto <desktop-height>px;` внутри существующего `@media (min-width: 720px)` блока — двумя разными числами, не одним на оба брейкпоинта; WHY-комментарий: однозначное `<length>` в `contain-intrinsic-size: auto <length>` применяется к обеим осям (ширина и высота), но для блочного `<section>` ширина всё равно берётся из layout контейнера, а не из intrinsic-size, так что практического эффекта на ширину нет
- [ ] **важно, отдельно от rails:** на холодной загрузке `/` все 4 rails на старте рендерят не `MovieRail`, а `MovieRailSkeleton` (`<AsyncBoundary fallback={<MovieRailSkeleton />}>`, свой CSS-модуль `MovieRailSkeleton.module.css`, `.section { margin-bottom: 64px }`, без `content-visibility`) — именно скелетоны занимают критический отрезок, который замеряет Lighthouse (LCP/TBT считаются до/около момента прихода данных), так что оптимизация `MovieRail.module.css` без изменений в `MovieRailSkeleton.module.css` не подействует в измеряемом окне. Измерить в DevTools реальную высоту `.section` в `MovieRailSkeleton.module.css` (она фиксирована — скелетон использует хардкод-пиксельные размеры `.scroll { height: 300px }`/`.poster { width: 200px; height: 300px }`, а не брейкпоинт-зависимую типографику, так что одного числа достаточно, брейкпоинт-развилки в этом модуле нет) и добавить туда `content-visibility: auto; contain-intrinsic-size: auto <measured-height>px;` тем же способом
- [ ] визуально проверить (`make dev`, DevTools → Rendering → "Layout Shift Regions" или Performance-панель) на обоих брейкпоинтах — при скролле вниз по `/` нет заметного CLS/дёрганья на появлении rails 2–4 (ни в состоянии skeleton, ни после загрузки данных)
- [ ] визуально проверить сохранение горизонтальной прокрутки: проскроллить любой rail стрелкой вправо (`ArrowBtn`), увести страницу вниз за пределы вьюпорта и вернуться — позиция `scrollLeft` внутри `.scroll`-контейнера сохранилась (`content-visibility: auto` пропускает рендер поддерева, это исторически проблемное место для вложенных скролл-контейнеров)
- [ ] убедиться, что `MovieRail.test.tsx` проходит без изменений (CSS-only правка не меняет поведение/DOM-структуру, новый юнит-тест не нужен — jsdom не считает `content-visibility`/layout)
- [ ] run tests — должны пройти (`make test`)

### Task 2: `loading='lazy' decoding='async'` на постерах, аватарах каста и скриншотах

**Files:**

- Modify: `src/entities/movie/ui/Poster/Poster.tsx`
- Modify: `src/entities/movie/ui/Poster/Poster.test.tsx`
- Modify: `src/pages/movie/ui/tabs/CastTab/CastTab.tsx`
- Create: `src/pages/movie/ui/tabs/CastTab/CastTab.test.tsx`
- Modify: `src/pages/movie/ui/tabs/MediaTab/MediaTab.tsx`
- Create: `src/pages/movie/ui/tabs/MediaTab/MediaTab.test.tsx`

- [ ] `Poster.tsx`: добавить `decoding='async'` к существующему `<img loading='lazy' .../>`
- [ ] `CastTab.tsx`: добавить `loading='lazy' decoding='async'` к `<img className={s.avatar} src={c.photo} alt={c.name} />` (fallback-градиент без `photo` не трогать — там нет `<img>`)
- [ ] `MediaTab.tsx`: добавить `loading='lazy' decoding='async'` к `<img>` в `.screenshotsGrid`
- [ ] обновить `Poster.test.tsx`: расширить существующий тест на `loading=lazy` проверкой `decoding=async` на том же элементе
- [ ] написать `CastTab.test.tsx`: рендер с `photo` → `img` с `loading=lazy`/`decoding=async` и корректным `alt`; рендер без `photo` → `img` отсутствует, рендерится fallback-градиент (`div` с `style.background`)
- [ ] написать `MediaTab.test.tsx`: непустые `images` → screenshot-`img`-элементы с `loading=lazy`/`decoding=async`; пустой `images` → секция "Screenshots" не рендерится; `trailerUrl` есть/нет → блок "Trailer" рендерится/не рендерится
- [ ] run tests — должны пройти (`make test`)

### Task 3: `useInView()` (`@shared/lib`) + lazy-mount `RelatedMovies`

**Files:**

- Create: `src/shared/lib/inView/useInView.ts`
- Create: `src/shared/lib/inView/index.ts`
- Create: `src/shared/lib/inView/useInView.test.ts`
- Modify: `src/shared/lib/index.ts`
- Modify: `src/test/setup.ts`
- Modify: `src/pages/movie/ui/RelatedMovies/RelatedMovies.tsx`
- Modify: `src/pages/movie/ui/RelatedMovies/RelatedMovies.module.css`
- Modify: `src/pages/movie/ui/RelatedMovies/RelatedMovies.test.tsx`

- [ ] `src/test/setup.ts`: добавить глобальный стаб `window.IntersectionObserver` (дефолт: `observe()` синхронно вызывает колбэк с `[{ isIntersecting: true, target }]`), по аналогии с существующим `window.matchMedia`-стабом — комментарий объясняет, зачем (jsdom не реализует API, `RelatedMovies` — первый потребитель)
- [ ] `useInView.ts`: реализовать хук в стиле `export const useInView = <T extends Element = HTMLElement>(options?: IntersectionObserverInit): { ref: RefObject<T | null>; inView: boolean } => ...` (arrow-const, как `useDebouncedValue`/`lazyNamed` — не `export function`, как устаревший `useViewport`; дефолт `= HTMLElement` у generic-параметра — см. Technical Details) — деструктурировать `options` на примитивы (`root`, `rootMargin = '200px'`, `threshold`) для exhaustive-deps-совместимого массива зависимостей эффекта (`.oxlintrc.json` требует `"exhaustive-deps": "error"` — объект `options` целиком в deps нельзя, пересоздаст observer на каждый рендер); в эффекте — ранний `if (inView) return`, иначе `observe(ref.current)`, при первом `isIntersecting: true` — `setInView(true)` + `observer.disconnect()`; cleanup — `disconnect()` при unmount, если ещё не сработал. Полное обоснование — в Technical Details.
- [ ] `src/shared/lib/inView/index.ts`: `export { useInView } from './useInView'` (по образцу `viewport/`, `debounce/`, `lazyNamed/` — barrel-файл на директорию, не прямой импорт файла)
- [ ] экспортировать `useInView` из `src/shared/lib/index.ts` (`export { useInView } from './inView'`) и добавить строку в таблицу «Key public APIs» в `AGENTS.md` (Task 5)
- [ ] `RelatedMovies.tsx`: вызвать `useInView()` рядом с существующим `useFavorites()`, **до** раннего `return null` на `movies.length === 0` (Rules of Hooks — как уже вызывается `useFavorites()`); повесить `ref` на уже существующий `<div className={s.section}>`; `header` (`.eyebrow`+`.heading`, чисто текстовый, дешёвый) рендерить всегда, без задержки; пока `!inView` — вместо реального `.grid` с `Card`-карточками рендерить **тот же контейнер `className={s.grid}`**, но заполненный `movies.length` (не хардкод — ровно столько, сколько реальных карточек будет) плейсхолдер-`div`ами (`s.placeholderCard`, `aria-hidden`) вместо `Card`
- [ ] `RelatedMovies.module.css`: добавить `.placeholderCard { aspect-ratio: 2/3; border-radius: <как у постера/карточки>; background: var(--bg-elevated); }` — **не** задавать фиксированный `min-height` на `.section` или на плейсхолдер: десктопная раскладка (`grid-template-columns: repeat(6, 1fr)` внутри `.section { max-width: 1440px; padding: 24px 40px 80px }`) флюидная — высота карточки (`Poster` с `aspect-ratio: 2/3`) масштабируется с шириной колонки, которая на десктопе варьируется от ~103px (vw=800) до ~210px (vw≥1440), то есть единое хардкод-число `min-height` было бы верным только на той ширине, на которой измерили, и создавало бы ровно тот layout shift, который призвано устранить, на любой другой. Используя тот же `.grid` (`grid-auto-flow: column`/`grid-template-columns: repeat(6, 1fr)` — те же классы, что и у реального контента) с `aspect-ratio: 2/3` на плейсхолдер-ячейках вместо хардкод-высоты, резервирование остаётся корректным на любой ширине без раздельных чисел на брейкпоинт — мобильная раскладка (`grid-auto-columns: 140px`, фиксированная ширина колонки) при этом тоже покрывается автоматически, без развилки. Плейсхолдер под текстовый блок `.info` (заголовок+год у `Card`) не резервируется отдельно — остаточный сдвиг на этот счёт остаётся, отметить как известное приближение при визуальной проверке в Task 4, не блокирующее
- [ ] написать `useInView.test.ts`: локально переопределить `window.IntersectionObserver` мок-классом, который сохраняет переданный колбэк и не вызывает его сразу — проверить (а) `inView` изначально `false`, становится `true` после ручного вызова сохранённого колбэка с `isIntersecting: true`, `disconnect` вызван один раз после этого; (б) unmount **до** срабатывания колбэка тоже вызывает `disconnect` (cleanup-кейс); сохранить `window.IntersectionObserver` в module-scope переменную до переопределения и восстановить в `afterEach` (механизм — см. Technical Details)
- [ ] обновить `RelatedMovies.test.tsx`: добавить кейс с локальным override `IntersectionObserver` (колбэк не вызывается) — `Card`-сетка отсутствует (проверить через `queryAllByRole('button', { name: /favorites/ })` — пусто, как и в существующих тестах этого файла), заголовок секции виден (`getByText('More like ...')`, header рендерится всегда) — селекторы по role/text, не по CSS-module-классу (в духе остальных тестов проекта); восстановить `window.IntersectionObserver` в `afterEach` этого кейса; существующие тесты (клик по сердечку) продолжают работать на дефолтном стабе из `setup.ts` (контент виден сразу)
- [ ] run tests — должны пройти (`make test`)

### Task 4: Verify acceptance criteria

- [ ] verify all requirements from Overview are implemented
- [ ] `make build-only`, снова поднять preview в фоне на том же порту 4173, повторно прогнать Lighthouse 3 раза для `/` и 3 раза для того же movie id — та же зафиксированная версия CLI и методология, что в Task 1 — записать в Progress Tracking ("После"); остановить preview-процесс после замера
- [ ] сравнить baseline/after медианы по критерию приёмки из Progress Tracking (ни одна из score/LCP/CLS/TBT не хуже более чем на 5%); при регрессии свыше порога — определить, какая задача (1/2/3) виновата, исправить или откатить именно её; зафиксировать итоговую дельту в описании PR
- [ ] `make test` — полный набор проходит
- [ ] `make check` (`format-check` + `lint` + `build`, т.е. `typecheck` через `build`) — чисто
- [ ] `make knip` — новые файлы `src/shared/lib/inView/*` и новые тестовые файлы не всплывают как unused (barrel-экспорт `useInView` из `@shared/lib` должен быть виден knip'у через публичное API, без добавления в `ignore`)
- [ ] `make size` — бюджет `shared` (лимит 22.6 KB gzip) не превышен новым экспортом `useInView` в `shared-*.js`
- [ ] проверить остаток суточной квоты demo-API перед `make e2e`: Task 1 (baseline) + этот шаг Task 4 (after) вместе уже потратили ~36 запросов на Lighthouse; если обе Lighthouse-фазы выполнялись в один день с этим шагом — либо убедиться, что оставшейся квоты хватает на `make e2e` (~40-50 запросов), либо перенести `make e2e` на следующий день (не блокирует завершение плана, см. Post-Completion)
- [ ] `make e2e` (если локально настроен `VITE_API_KEY` с доступной квотой) — существующие смоки по `/` и `/movie/:id` не сломаны (селекторы по role/label, не зависят от `content-visibility`/момента маунта `RelatedMovies`)
- [ ] визуально проверить `/movie/:id` в браузере — заголовок "More like ..." виден сразу, карточки в сетке подгружаются при скролле без заметного скачка layout, на обоих брейкпоинтах (мобильном и `≥720px`)

### Task 5: [Final] Update documentation

- [ ] обновить `AGENTS.md`: добавить заметку в раздел performance/roadmap о решении не виртуализировать rails главной (demo-лимит ≤10 карточек — **внешний факт, не читаемый из кода** для 3 из 4 rails, см. Context; конфликт с hover-arrow `scrollBy`) — по образцу существующих заметок «буквальная формулировка vs факт»; явно указать: пересмотреть при смене API-тарифа или добавлении явного `limit` в `getMovies.ts`
- [ ] в той же заметке — указать, что `content-visibility` (Task 1) поддерживается Safari только с версии 18: на более старых WebKit-браузерах эффект отсутствует (деградирует к обычному рендерингу, не ломается), это accepted limitation, не баг
- [ ] обновить `AGENTS.md`: задокументировать `useInView()` (`@shared/lib`) как reusable-паттерн для lazy-mount тяжёлых always-mounted секций, с уточнением про default-стаб в `src/test/setup.ts`; отдельно объяснить критерий выбора между этим хуком и CSS-`content-visibility` (Task 1) для будущих разработчиков — `content-visibility` для чисто визуального offscreen-контента (rails, где не нужен явный JS-сигнал), `useInView` там, где нужен собственно факт «замонтировано/не замонтировано» в React-дереве (здесь — по прямому указанию roadmap 2.7 и решению пользователя при планировании)
- [ ] обновить `@shared/lib` строку в таблице «Key public APIs» (`AGENTS.md`) — добавить `useInView()`
- [ ] обновить `plans/roadmap.md` 2.7 — проставить чекбоксы согласно маппингу из Technical Details, добавить ссылку на этот план
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

**Manual verification:**

- Ручной прогон Lighthouse (CLI/DevTools) против `make preview`-сборки — до (Task 1) и после (Task 4) всех изменений; числа фиксируются прямо в этом плане и в PR, не в CI.
- Визуальная проверка отсутствия layout shift на `/` (rails) и `/movie/:id` (`RelatedMovies`) при скролле — через Chrome DevTools Performance/Rendering панели.
- `make e2e` — требует валидный `VITE_API_KEY` и доступную суточную квоту demo-тарифа (200 запросов/сутки, см. AGENTS.md "E2E тесты") — не блокирует завершение плана, если квота исчерпана в моменте.

**External system updates:** нет (пункт не затрагивает CI/деплой-конфиги — Lighthouse CI остаётся отдельным roadmap-пунктом 2.5.6).
