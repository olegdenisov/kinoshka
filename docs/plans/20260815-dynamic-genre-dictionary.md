# Динамический справочник жанров + переработанный компонент выбора жанра

## Overview

Фильтр жанров на `/search` сейчас — захардкоженный английский список (`ALL_GENRES` в
`@entities/movie/model/catalog.ts`, 13 значений), переводимый на русский для API-запросов через
статический словарь `GENRE_MAP` (`@features/catalog-filter/lib/genreMap.ts`, 12 значений). Две
проблемы:

1. Список расходится с реальным справочником жанров Kinopoisk и незаметно ломается: жанры,
   которых нет в `GENRE_MAP` (например `'Slice of Life'`), выбираемы в UI, но молча отбрасываются
   при сборке API-запроса (`filtersToParams.ts`) — пользователь может «выбрать» жанр, который
   ничего не фильтрует.
2. После подключения реального справочника (в нём заметно больше значений, чем в текущих 13)
   плоский список чипов станет длинным и неудобным для сканирования в обеих версиях —
   `SearchSidebar` (desktop) и `SearchMobile.tsx` (отдельная задублированная инлайн-вёрстка).

Этот план:
- Загружает справочник жанров из живого API (`GET /v1.5/dictionary/genres`), кэширует его в
  `localStorage` (жанры меняются редко) через уже готовый примитив `createStorageSlot`
  (`@shared/lib`, реализован, но пока нигде не используется в реальном коде — и содержит баг,
  который эта работа вскрывает первой, см. Task 1).
- Делает русское `name` из API-справочника канонiческим значением фильтра целиком (это ровно то,
  что уже ожидает параметр запроса `genres.name` — шаг EN→RU маппинга/пропуска-неизвестных в
  `filtersToParams.ts` убирается полностью, что чинит проблему 1 конструктивно: любой выбираемый
  жанр гарантированно существует в справочнике).
- Сохраняет английские лейблы чипов через (теперь RU→EN, инвертированный) статический
  `GENRE_MAP`, с фолбэком на русское название для жанров справочника без известного английского
  лейбла.
- Заменяет плоский список чипов на общий компонент `GenreSelector`
  (`@features/catalog-filter/ui`, тот же паттерн «общий компонент, две responsive-точки
  использования», что и у `ActiveFilterChips`): показывает короткий статический шорт-лист сразу
  (плюс уже выбранные жанры, даже если их нет в шорт-листе), остальное — свёрнуто за «Показать
  все».

**Важное архитектурное решение по итогам ревью (см. историю правок ниже):** справочник **не**
блокирует рендер через Suspense/`use()`. Компонент всегда может отрисоваться синхронно —
статический шорт-лист служит начальным значением, а живой справочник из API подгружается в фоне
(`useEffect`) и подменяет список, когда (и если) успешно придёт. Это устраняет необходимость в
`AsyncBoundary`/skeleton/`onRetry` для этого конкретного куска UI и держит фильтр жанров рабочим
даже если demo-тариф API вернёт 403 по суточной квоте (см. `DictionaryControllerGetOneV15Errors`
в `types.gen.ts` и уже существующий 403-cooldown в `createCachedFetcher.ts` — это реальное,
известное в проекте ограничение, не гипотетическое).

## Context (from discovery)

- **Затронутые файлы/компоненты:**
  - `src/entities/movie/model/catalog.ts` — `ALL_GENRES` (удаляется, станет неиспользуемым после этого изменения)
  - `src/features/catalog-filter/lib/genreMap.ts` — `GENRE_MAP`/`toApiGenre` (EN→RU; инвертируется в RU→EN только для отображения)
  - `src/features/catalog-filter/lib/genreMap.test.ts` — импортирует `ALL_GENRES` (`import { ALL_GENRES } from '@entities/movie'`) и держит тест «все значения `ALL_GENRES` покрыты словарём» — эта инвариантa теряет смысл после инверсии словаря и удаления `ALL_GENRES`, тест переписывается, а не просто обновляется
  - `src/features/catalog-filter/lib/filtersToParams.ts` — сборка параметра запроса `genres.name`
  - `src/features/catalog-filter/model/useFilterState.ts` — `FilterState.genres`, `toggleGenre`, лейблы active-filter чипов
  - `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx` — desktop-список чипов жанров, включая локальный компонент `GenreChip`/тип `GenreChipProps` (строки 59-66), единственный потребитель которых — этот блок
  - `src/pages/search/ui/SearchMobile.tsx` — мобильный инлайн-список чипов жанров (~строки 516-554), инлайн-стилизация (height 34, fontSize 12.5 — заметно крупнее desktop-чипов)
  - `src/shared/lib/storage/storage.ts` — `createStorageSlot` (Zod-валидированный слот localStorage, cross-tab синхронизация через событие `storage`) — **требует точечного фикса перед использованием** (см. Task 1)
  - `src/shared/lib/storage/useStorageSlot.ts` — `useSyncExternalStore(slot.subscribe, slot.get)`
  - `src/entities/movie/api/createCachedFetcher.ts` — существующий паттерн in-memory/session кэша с `ERROR_CACHE_TTL_MS`-кулдауном на ошибки (не переиспользуется напрямую: его sessionStorage-персист доступен только в DEV и живёт 5 минут — не та семантика для долгоживущего localStorage-кэша; но паттерн error-cooldown воспроизводится в упрощённом виде, см. Task 3)
  - `src/shared/api/types.gen.ts` — `DictionaryDto`/`DictionaryItemDto`, типы `DictionaryControllerGetOneV15*`
  - `src/shared/api/instance.gen.ts` — `apiClient.getV15DictionaryByType({ path: { type } })`
  - `src/test/setup.ts` — глобальный MSW-сервер с `onUnhandledRequest: 'error'` и глобальный `afterEach(() => resetAllCachedFetchers())`; после этого плана сюда добавляется дефолтный хендлер справочника жанров + сброс нового кэша (см. Task 3) — иначе падают все существующие тесты, рендерящие `/search`
- **Найденные паттерны:**
  - `ActiveFilterChips` — прецедент общего UI-компонента на уровне фичи, переиспользуемого между desktop и mobile; файловая структура — `ActiveFilterChips.tsx` + `index.tsx`-барель (не сам компонент прямо в `index.tsx`) — используем ту же структуру для `GenreSelector`.
  - `createCachedFetcher.ts` — error-cooldown как защита от повторных сетевых запросов при недоступном эндпоинте.
- **Выявленные зависимости:** URL — единственный источник истины для фильтров (`searchParams.ts`); смена канонического значения жанра с английского на русское — осознанный breaking change для уже существующих `?genres=Drama`-ссылок, миграция намеренно не делается (см. Technical Details).

## Development Approach

- **Подход к тестам:** Regular (сначала реализация, потом тесты/обновление тестов в каждой задаче)
- Полностью завершать каждую задачу перед переходом к следующей
- Делать небольшие, точечные изменения
- Каждая задача включает новые/обновлённые тесты для затронутого кода; перед переходом к следующей задаче — `make test`
- Обновлять этот файл плана, если объём работ меняется в процессе реализации

## Solution Overview

- **Канонiческое значение жанра = `name` из API-справочника (на русском).** Ровно то, что ожидает `genres.name` — `filtersToParams.ts` больше не нужен шаг перевода/пропуска, а класс бага «в фильтре жанр, который ничего не фильтрует» исчезает конструктивно для любого жанра, выбранного через новый `GenreSelector` (для legacy-URL с английскими значениями — см. явную оговорку ниже).
- **Лейбл отображения = RU→EN через инвертированный `GENRE_MAP`, с фолбэком на RU-название** для жанров справочника без известного английского лейбла (по требованию).
- **Кэширование = один `createStorageSlot` (после точечного фикса на референциальную стабильность, Task 1) под ключом `kinoshka:genres`.** Хранит `{ items: string[], fetchedAt: number }`. Никакого TTL-блокирования: если в кэше что-то есть — используем как есть; если кэш пуст **или** устарел (>7 дней) — фоновым (не блокирующим рендер) запросом обновляем.
- **Никакого Suspense/`use()`/`AsyncBoundary` для этого хука.** `useGenreDictionary()` — обычный синхронный хук: сразу возвращает либо закэшированный список, либо статический фолбэк (те же значения, что сейчас в `GENRE_MAP`), и в `useEffect` при необходимости запускает фоновый фетч, который при успехе обновляет localStorage-кэш (реактивно подхватывается через `useStorageSlot`, компонент перерисуется с полным списком). Неудачный фетч не ретраится чаще, чем раз в `BACKGROUND_RETRY_COOLDOWN_MS` (in-memory, не персистится) — защита от эндпоинта, стабильно отдающего 403/500.
- **UI:** один компонент `GenreSelector` (`@features/catalog-filter/ui`) заменяет и desktop-блок жанров в `SearchSidebar`, и мобильный инлайн-блок. Видимый по умолчанию набор = статический шорт-лист (6 самых ходовых жанров) ∪ уже выбранные (`selected`) жанры — так уже применённый фильтр всегда виден и снимаем прямо из селектора, даже если он не входит в шорт-лист. «Показать все» раскрывает остальные жанры из справочника (или из фолбэка, пока справочник не подгрузился).

## Technical Details

- Тип `Genre`: `{ name: string }`. Не заводим `id`/`slug` — ни один сценарий плана их не использует (YAGNI); при появлении реального потребителя тип расширяется отдельным изменением.
- Маппинг `DictionaryItemDto[]` → `Genre[]`: `items.map(i => ({ name: i.name }))`, без защитной фильтрации на пустое имя — `name` в сгенерированном типе обязательное, а AGENTS.md фиксирует политику доверия к API-ответам против сгенерированных типов без Zod-границы (Zod — только на границе localStorage/sessionStorage).
- TTL кэша справочника: 7 дней (`GENRE_DICTIONARY_TTL_MS`) — если `fetchedAt` старше, при следующем маунте `useGenreDictionary` запускает фоновое обновление (но всё равно сразу отдаёт то, что уже есть в кэше/фолбэке).
- Cooldown фоновых ретраев при ошибке: отдельная in-memory (не в localStorage) метка `lastAttemptAt` в модуле кэша, минимальный интервал между попытками — 60 секунд. Не персистится специально: рестарт вкладки/страницы — приемлемая точка сброса кулдауна.
- Статический шорт-лист (используется и как «featured» набор по умолчанию, и как фолбэк до первой успешной загрузки справочника): 6 русских названий — `боевик` (Action), `драма` (Drama), `триллер` (Thriller), `ужасы` (Horror), `фэнтези` (Fantasy), `приключения` (Adventure).
- `filtersToParams.ts`: `params['genres.name'] = filters.genres` напрямую (без шага `toApiGenre`/пропуска неизвестных).
- Active-filter чипы в `useFilterState.ts`: лейбл чипа жанра идёт через `getGenreLabel(g)` вместо сырого хранимого значения.
- **Явная оговорка про legacy-URL:** до этого плана канонические значения жанра в URL — английские (`?genres=Drama`). После перехода на русские значения такие старые ссылки перестанут находить совпадение в справочнике (фильтр останется формально «активным», но ничего не отфильтрует — тот же класс проблемы, что план чинит для новых выборов, только для уже существующих ссылок). Миграция сознательно не делается: проект в активной разработке без внешних пользователей с закладками, `?genres=` короткоживущий query-параметр, а не долгоживущий контракт — тот же принцип, что уже применён к `Movie.genre` (см. AGENTS.md, «no reverse RU→EN mapping on display — accepted default»). Если это неприемлемо — решение стоит пересмотреть перед реализацией.
- `ALL_GENRES` (`entities/movie/model/catalog.ts`) становится неиспользуемым после переключения обеих точек использования — удаляем его и экспорт из `index.ts`. Единственные реальные потребители: `SearchSidebar.tsx`, `SearchMobile.tsx`, `genreMap.test.ts` (в самом `genreMap.ts` — только в комментарии, не импорт).
- `GenreSelector.module.css` учитывает разницу в размерах чипов между текущим desktop- (`height: 28px`, `fontSize: 12px`) и mobile- (`height: 34px`, `fontSize: 12.5px`) вариантами через медиа-запрос на `MOBILE_BREAKPOINT` (720px, как везде в проекте), чтобы переход `SearchMobile.tsx` на общий компонент не давал визуальной регрессии.
- Справочник жанров остаётся частью `@entities/movie` (не выносится в отдельный `@entities/genre`) — по аналогии с тем, что `ALL_GENRES` уже жил там; жанр как отдельная сущность нигде в проекте не используется вне контекста фильтрации фильмов.

## What Goes Where

- **Implementation Steps** (чекбоксы `[ ]`): весь код/тесты ниже — полностью достижимо в этой кодовой базе, без внешних зависимостей сверх уже живого API.
- **Post-Completion**: ручная визуальная проверка переработанного селектора на обоих брейкпоинтах (в проекте нет Playwright/e2e-сьюта — см. список команд AGENTS.md, `make test` — только Vitest).

## Implementation Steps

### Task 1: Починить референциальную стабильность `createStorageSlot.get()`

**Files:**
- Modify: `src/shared/lib/storage/storage.ts`
- Modify: `src/shared/lib/storage/storage.test.ts`

- [x] `createStorageSlot`: замемоизировать распарсенное значение по сырой строке из `localStorage` — повторные вызовы `get()` без изменения `localStorage.getItem(key)` должны возвращать ту же ссылку (`Object.is`-равенство), а не парсить JSON заново на каждый вызов
- [x] инвалидировать мемо при `set()`/`remove()` (следующий `get()` обязан подхватить новое значение)
- [x] причина: `useStorageSlot` передаёт `slot.get` напрямую в `useSyncExternalStore` как `getSnapshot`; для объектных/массивных значений новая ссылка на каждый вызов означает, что React считает снапшот изменившимся при каждом рендере → бесконечный цикл ре-рендеров и dev-варнинг React про нестабильный `getSnapshot`. Примитив пока нигде не используется в реальном коде — баг не проявлялся, этот план становится первым потребителем
- [x] написать тест: `slot.get() === slot.get()` (та же ссылка) при отсутствии записей между вызовами
- [x] написать тест: после `slot.set(value)` следующий `slot.get()` возвращает новое значение (а не закэшированное старое)
- [x] прогнать тесты — должны пройти перед задачей 2

### Task 2: API-вызов справочника жанров + тип `Genre`

**Files:**
- Create: `src/entities/movie/model/genre.ts`
- Create: `src/entities/movie/api/getGenreDictionary.ts`
- Create: `src/entities/movie/api/getGenreDictionary.test.ts`
- Modify: `src/entities/movie/index.ts`

- [x] определить `Genre = { name: string }` в `genre.ts`
- [x] `getGenreDictionary()` в `getGenreDictionary.ts`: вызывает `apiClient.getV15DictionaryByType({ path: { type: 'genres' } })`, маппит `DictionaryDto.items` → `Genre[]` (`items.map(i => ({ name: i.name }))`)
- [x] экспортировать тип `Genre` из `src/entities/movie/index.ts` (публичное API слоя — `GenreSelector` в `@features/catalog-filter` обязан импортировать его оттуда, не из внутреннего пути)
- [x] написать тесты: успешный ответ корректно маппится `DictionaryItemDto[]` → `Genre[]`
- [x] написать тесты: ошибка API (например, замоканный 500/403 через MSW) реджектится и пробрасывается дальше (без проглатывания на этом уровне)
- [x] прогнать тесты — должны пройти перед задачей 3

### Task 3: localStorage-кэш + не блокирующий рендер хук для справочника жанров

**Files:**
- Create: `src/entities/movie/api/genreDictionaryCache.ts`
- Create: `src/entities/movie/api/genreDictionaryCache.test.ts`
- Create: `src/entities/movie/hooks/useGenreDictionary.ts`
- Create: `src/entities/movie/hooks/useGenreDictionary.test.tsx`
- Modify: `src/entities/movie/hooks/index.ts`
- Modify: `src/test/setup.ts`

- [x] `genreDictionaryCache.ts`: Zod-схема + `createStorageSlot('kinoshka:genres', schema, { items: [], fetchedAt: 0 })` (использует фикс из Task 1), `GENRE_DICTIONARY_TTL_MS = 7 * 24 * 60 * 60 * 1000`, `BACKGROUND_RETRY_COOLDOWN_MS = 60 * 1000`, `isGenreDictionaryStale(fetchedAt)`
- [x] `refreshGenreDictionary()`: module-level in-flight-деduped функция — вызывает `getGenreDictionary()`, при успехе пишет `{ items: names, fetchedAt: Date.now() }` в слот, при ошибке обновляет только in-memory `lastAttemptAt` (не трогает `fetchedAt`/сам кэш), в любом случае снимает in-flight флаг в `finally`; если с последней неудачной попытки прошло меньше `BACKGROUND_RETRY_COOLDOWN_MS` — вызов не делает сетевой запрос (no-op)
- [x] `invalidateGenreDictionary()`: чистит слот и сбрасывает `lastAttemptAt`/in-flight состояние (для ручного форс-рефреша, если понадобится)
- [x] `useGenreDictionary()` в `useGenreDictionary.ts`: читает слот через `useStorageSlot` (реактивно, синхронно, без `use()`); если `items.length === 0` — возвращает `STATIC_FALLBACK_GENRES` (см. Task 5) для текущего рендера; в `useEffect` (не в теле рендера — побочный эффект не должен жить в фазе рендера), если кэш пуст или устарел, вызывает `refreshGenreDictionary()` (fire-and-forget, ошибки проглатываются на этом уровне — они уже учтены в cooldown-логике модуля кэша); успешное обновление слота реактивно долетает до компонента через `useStorageSlot`
- [x] реэкспортировать `useGenreDictionary`/`invalidateGenreDictionary` из `hooks/index.ts`
- [x] в `src/test/setup.ts`: добавить дефолтный MSW-хендлер для `*/v1.5/dictionary/genres` (успешный ответ с небольшим фиксированным набором жанров) и глобальный `afterEach` с `localStorage.clear()` + сбросом in-memory состояния `genreDictionaryCache` (экспортировать тестовую утилиту вроде `resetGenreDictionaryState()`, вызываемую из `afterEach`, по аналогии с `resetAllCachedFetchers()`) — без этого все существующие тесты, рендерящие `SearchDesktop`/`SearchSidebar`/`SearchMobile`, упадут на `onUnhandledRequest: 'error'` после Task 6/7, а `localStorage`-кэш будет протекать между тестами одного файла
- [x] написать тесты для `genreDictionaryCache.ts`: TTL-граница устаревания; in-flight дедуп (параллельные вызовы `refreshGenreDictionary()` бьют в фетчер один раз); успешная запись обновляет `fetchedAt`; неудачная попытка не трогает существующий кэш и не ретраится до истечения `BACKGROUND_RETRY_COOLDOWN_MS` (с замоканным временем)
- [x] написать тесты для `useGenreDictionary.ts` (через `@testing-library/react` + MSW): пустой кэш — первый рендер сразу отдаёт статический фолбэк (без ожидания сети), после успешного фонового фетча перерисовывается с данными из API; свежий кэш — рендерится сразу из кэша, фонового запроса не происходит; устаревший кэш — рендерится сразу из кэша **и** происходит ровно один фоновый запрос (проверить счётчиком вызовов MSW-хендлера, не больше одного при повторных ре-рендерах); неудачный фоновый фетч не приводит к повторным запросам при последующих ре-рендерах в пределах cooldown
- [x] прогнать тесты — должны пройти перед задачей 4

### Task 4: Инвертировать `genreMap.ts` в RU→EN лейблы, упростить `filtersToParams.ts` и лейблы active-чипов

**Files:**
- Modify: `src/features/catalog-filter/lib/genreMap.ts`
- Modify: `src/features/catalog-filter/lib/genreMap.test.ts`
- Modify: `src/features/catalog-filter/lib/filtersToParams.ts`
- Modify: `src/features/catalog-filter/lib/filtersToParams.test.ts`
- Modify: `src/features/catalog-filter/model/useFilterState.ts`

- [x] инвертировать `GENRE_MAP` → `GENRE_LABELS: Record<string, string>` (RU-название → EN-лейбл, те же 12 пар, в обратную сторону); заменить `toApiGenre` на `getGenreLabel(ruName: string): string`, возвращающий `GENRE_LABELS[ruName] ?? ruName`
- [x] `filtersToParams.ts`: убрать шаг `toApiGenre`/фильтрации неизвестных, установить `params['genres.name'] = filters.genres` напрямую, если список непустой
- [x] `useFilterState.ts`: лейбл active-чипа жанра теперь через `getGenreLabel(g)` вместо сырого хранимого значения
- [x] переписать `genreMap.test.ts` под новую RU→EN форму: убрать тест «все значения `ALL_GENRES` покрыты словарём» (инвариантa теряет смысл — `ALL_GENRES` удаляется в Task 8, словарь больше не обязан покрывать весь справочник), добавить кейсы `getGenreLabel`: известное RU-название → EN-лейбл; неизвестное RU-название → возвращается как есть
- [x] обновить `filtersToParams.test.ts` — убрать кейсы, проверяющие пропуск немаппленных жанров (больше не актуально), добавить кейс, подтверждающий, что RU-названия проходят без изменений
- [x] прогнать тесты — должны пройти перед задачей 5

### Task 5: Компонент `GenreSelector` (шорт-лист + show-all, без Suspense)

**Files:**
- Create: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.tsx`
- Create: `src/features/catalog-filter/ui/GenreSelector/index.tsx`
- Create: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.module.css`
- Create: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.test.tsx`
- Modify: `src/features/catalog-filter/index.ts`

- [x] `GenreSelector({ selected, onToggle, disabled }: { selected: string[]; onToggle: (name: string) => void; disabled?: boolean })`: сам вызывает `useGenreDictionary()` внутри (обычный синхронный хук, никакого `AsyncBoundary`/Suspense на вызывающей стороне не требуется)
- [x] `STATIC_FALLBACK_GENRES` — 6 русских названий из Technical Details (`боевик`, `драма`, `триллер`, `ужасы`, `фэнтези`, `приключения`); используется и как дефолтный видимый набор, и как аргумент `useGenreDictionary`'s фолбэка (переиспользовать константу, не дублировать список)
- [x] видимый по умолчанию набор = `STATIC_FALLBACK_GENRES` ∪ `selected` (объединение — жанр, уже выбранный через URL/deep-link, но не входящий в шорт-лист, всё равно отрисован и подсвечен), пересечённое с реально доступными жанрами (справочник, если загрузился, иначе тот же фолбэк)
- [x] локальный стейт `showAll` (`useState(false)`): при `showAll` — дополнительно рендерятся остальные жанры из справочника/фолбэка, не входящие в набор по умолчанию, плюс кнопка-переключатель «Показать все (N)» / «Свернуть» (N = количество оставшихся жанров)
- [x] лейблы чипов через `getGenreLabel(genre.name)`
- [x] `GenreSelector.module.css`: чипы через медиа-запрос на 720px (`MOBILE_BREAKPOINT`) воспроизводят текущие desktop- и mobile-размеры (см. Technical Details), чтобы не было визуальной регрессии на мобиле после переноса из инлайн-стилей `SearchMobile.tsx`
- [x] экспортировать `GenreSelector` из `src/features/catalog-filter/index.ts`
- [x] написать тесты: по умолчанию рендерится статический шорт-лист (6 чипов); жанр из `selected`, не входящий в шорт-лист, тоже отрисован и подсвечен как активный; «Показать все» раскрывает остальное и сворачивает обратно; выбор чипа вызывает `onToggle`; `disabled` проп дизейблит все кнопки-чипы; после подгрузки справочника (MSW) список расширяется реальными данными
- [x] прогнать тесты — должны пройти перед задачей 6

### Task 6: Подключить `GenreSelector` в `SearchSidebar` (desktop)

**Files:**
- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx`
- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.module.css`
- Modify: существующие тесты, ссылающиеся на чипы жанров `SearchSidebar`/`SearchDesktop`

- [x] заменить блок `ALL_GENRES.map(...)` в `FilterGroup` «Genre» на `<GenreSelector selected={filters.genres} onToggle={onToggleGenre} disabled={disabled} />` (без обёртки в `AsyncBoundary` — хук синхронный)
- [x] удалить локальный компонент `GenreChip` и тип `GenreChipProps` из `SearchSidebar.tsx` (единственный потребитель — заменённый блок; иначе `noUnusedLocals` уронит `make typecheck`)
- [x] убрать теперь неиспользуемый импорт `ALL_GENRES`
- [x] убрать ставшие мёртвыми правила `.genreList`/`.genreChip`/`.genreChipActive` из `SearchSidebar.module.css`
- [x] обновить/заменить тесты `SearchDesktop`/`SearchSidebar`, проверяющие старый захардкоженный список чипов жанров (опираться на дефолтный MSW-хендлер справочника из `src/test/setup.ts`, Task 3) — существующие ассерты в `SearchDesktop.test.tsx` (`getAllByRole('button', { name: /Action|Drama|Sci-Fi/ })`) уже проходят без изменений: `GenreSelector` синхронно рендерит `STATIC_FALLBACK_GENRES` (боевик/драма/... → EN-лейблы через `getGenreLabel`) на первом рендере, так что Action/Drama-кнопки присутствуют и корректно наследуют `disabled`
- [x] прогнать тесты — должны пройти перед задачей 7

### Task 7: Подключить `GenreSelector` в `SearchMobile.tsx`, убрать старый инлайн-блок

**Files:**
- Modify: `src/pages/search/ui/SearchMobile.tsx`
- Modify: существующие ассерты на жанры в `SearchMobile.test.tsx`

- [x] заменить инлайновый блок `<div>` с `ALL_GENRES.map(...)` (~строки 516-554) на `<GenreSelector selected={filters.genres} onToggle={toggleGenre} disabled={isSearchMode} />` (тот же гейтинг disabled-в-режиме-поиска, что и у остальной мобильной панели фильтров; без `AsyncBoundary`)
- [x] убрать теперь неиспользуемый импорт `ALL_GENRES` из `SearchMobile.tsx`
- [x] обновить ассерты на чипы жанров в `SearchMobile.test.tsx` (опираться на дефолтный MSW-хендлер справочника из `src/test/setup.ts`) — существующие ассерты уже опираются только на URL-driven active-filter лейблы (`Drama`/`Action` через identity-фолбэк `getGenreLabel`), не на захардкоженный список чипов, поэтому все 21 тестов файла прошли без изменений после замены на `GenreSelector`
- [x] прогнать тесты — должны пройти перед задачей 8

### Task 8: Удалить ставший неиспользуемым `ALL_GENRES`

**Files:**
- Modify: `src/entities/movie/model/catalog.ts`
- Modify: `src/entities/movie/index.ts`

- [ ] удалить экспорт `ALL_GENRES` из `catalog.ts` (сначала убедиться, что оставшихся ссылок нет — `grep -rn ALL_GENRES src`)
- [ ] убрать `ALL_GENRES` из публичного API-экспорта `entities/movie/index.ts`
- [ ] прогнать `make typecheck` — убедиться, что нигде не осталось повисших импортов
- [ ] прогнать полный набор тестов — должен пройти перед задачей 9

### Task 9: Проверка критериев приёмки

- [ ] убедиться, что справочник жанров загружается из живого API и рендерится и в `SearchSidebar` (desktop), и в `SearchMobile`, без Suspense-фолбэка/мигания (первый рендер сразу со статическим шорт-листом)
- [ ] проверить кэширование в localStorage: перезагрузить страницу — справочник рендерится из кэша мгновенно, фонового обновления не происходит в рамках 7-дневного TTL
- [ ] проверить, что жанр, выбранный по deep-link и отсутствующий в шорт-листе, отрисован и подсвечен в `GenreSelector` без ручного «Показать все»
- [ ] проверить, что выбор жанра по-прежнему корректно фильтрует результаты поиска (сетевой запрос содержит правильное значение `genres.name`)
- [ ] проверить, что немаппленные жанры справочника (без английского лейбла) рендерятся с русским названием в качестве лейбла чипа и по-прежнему корректно фильтруют
- [ ] проверить сценарий недоступного эндпоинта справочника (замокать 403/500): фильтр жанров остаётся рабочим на статическом шорт-листе, консоль не заваливает повторными запросами/React-варнингами про нестабильный `getSnapshot`
- [ ] прогнать полный набор тестов: `make test`
- [ ] прогнать `make check` (lint + build) — подтвердить отсутствие регрессий по линту/типам
- [ ] проверить покрытие тестами новых модулей на уровне остального проекта (`make coverage`, выборочно)

### Task 10: [Final] Обновить документацию

- [ ] обновить раздел «Data state» в `AGENTS.md`: добавить пункт, документирующий справочник жанров как третью точку интеграции с живыми данными (эндпоинт-источник, localStorage-кэш с фоновым revalidate вместо блокирующего Suspense, паттерн `GenreSelector`/`useGenreDictionary`/`invalidateGenreDictionary`), в том же стиле, что и существующие пункты про домашние rails / search / movie-detail интеграции; явно отметить breaking change для legacy `?genres=`-ссылок (см. Technical Details)
- [ ] обновить таблицу «Key public APIs» в `AGENTS.md`: заменить удалённую запись `ALL_GENRES` для `@entities/movie` на `Genre`, `useGenreDictionary()`, `invalidateGenreDictionary()`; добавить `GenreSelector` в строку `@features/catalog-filter`
- [ ] упомянуть в `AGENTS.md` (или в докблоке `storage.ts`) фикс референциальной стабильности `createStorageSlot.get()` из Task 1 — следующий потребитель примитива не должен наступать на те же грабли
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка** (в проекте нет Playwright/e2e-сьюта — см. команды в AGENTS.md, `make test` — только Vitest):
- Визуальная проверка `GenreSelector` на обоих брейкпоинтах (desktop `SearchSidebar` и mobile `SearchMobile`, граница 720px, по `useViewport`) — перенос чипов по строкам, переключатель «Показать все», состояния active/selected, состояние disabled в режиме текстового поиска (Variant A), совпадение размеров чипов с текущим видом на каждом брейкпоинте.
- Ручная проверка через DevTools (сеть offline/эндпоинт 403): фильтр жанров остаётся функциональным на статическом шорт-листе, без зависаний/бесконечных ре-рендеров.
