# Мобильная адаптивная вёрстка вместо парных `*Desktop`/`*Mobile` компонентов

## Overview

Пункт 2.5 роадмапа (`plans/roadmap.md`). Сейчас почти каждая страница и часть виджетов реализованы
как пара компонентов `*Desktop`/`*Mobile` с идентичной бизнес-логикой, продублированной в двух
React-деревьях, переключаемых рантайм-хуком `useViewport()` (брейкпоинт 720px) на уровне
`*Page.tsx`. Паттерн задокументирован в `AGENTS.md` ("Responsive pattern") как обязательный для
новых страниц/виджетов.

Цель — перейти на mobile-first адаптивную вёрстку: один компонент на страницу/виджет, раскладка и
поведение меняются через CSS (media queries, flex/grid) от мобильной базы вверх, а не через
параллельные JS-деревья. `useViewport()` не удаляется полностью, а сужается до по-настоящему
JS-зависимых развилок — разница между "разный CSS" и "разное поведение, которое CSS не может
выразить" явно фиксируется по каждому виджету в Task 1.

Обоснование объёма и рисков — `docs/backlog/desktop-mobile-component-duplication.md`: это сквозной
архитектурный рефакторинг, выполняется постранично (не одним PR), с обязательным пересмотром
`AGENTS.md` и части тестов, завязанных на `useViewport`/раздельный рендер.

## Context (from discovery)

**Парные компоненты, подтверждённые чтением кода:**

- Страницы: `HomeDesktop`/`HomeMobile`, `SearchDesktop`/`SearchMobile`, `MovieDesktop`/`MovieMobile`,
  `FavoritesDesktop`/`FavoritesMobile`, `PopularDesktop`/`PopularMobile`,
  `RecommendationsDesktop`/`RecommendationsMobile` — каждая пара переключается в своём
  `*Page.tsx` через `const { isMobile } = useViewport(); return isMobile ? <XMobile/> : <XDesktop/>`.
- `@entities/movie`: `Card` (grid/compact варианты, hover-`.actions` оверлей) vs `MobileCard`
  (без hover-оверлея, favorite-кнопка прямо на постере) — не просто разный CSS, разный набор
  видимых действий (hover не имеет смысла на touch).
- `@widgets/movie-rail`: `MovieRailDesktop` (78 строк, есть `ArrowBtn` для скролла по клику) vs
  `MovieRailMobile` (45 строк, только нативный touch-скролл, кнопок нет).
- `@widgets/mobile-chrome` (`MobileHeader`, `BottomNav`, `BottomSheet`) — используется только
  мобильными страницами; десктопные страницы вместо этого рендерят `@widgets/header`'s `Header`.
  Это не дублирование одной и той же разметки в двух размерах, а два принципиально разных паттерна
  навигации (верхний header с inline-поиском и pills vs bottom nav + отдельный mobile header) —
  делать из них один компонент бессмысленно; дублируется сам факт, что **каждая** страница отдельно
  решает, что рендерить, через `useViewport`.
- `@widgets/search-sidebar`'s `SearchSidebar` (всегда видимый aside с radio-rows) vs инлайн-форма
  фильтров внутри `SearchMobile.tsx`, открываемая как `BottomSheet` по кнопке — тоже разные
  UX-паттерны, не просто разный CSS. `SearchDesktop`/`SearchMobile` уже переиспользуют общий
  page-слой (`useFilterState`, `usePageSync`, `useCatalogUpdateStatus`, `useMovieCatalog` из
  `src/pages/search/model/`) — модель не дублируется, дублируется только презентационная оболочка
  (`SearchDesktop.tsx`/`SearchMobile.tsx`, `Pagination`/инлайновый `MobilePagination` в
  `SearchMobile.tsx`, хотя оба уже используют общую `buildPageRange`/`clampPage` из `lib/`).
- `GenreSelector` (`@features/catalog-filter/ui`) принимает `compact?: boolean` как явный проп от
  вызывающей стороны (а не `@media` внутри своего CSS-модуля) — его докблок прямо объясняет, что
  это осознанно, **потому что** `useViewport`/`SearchDesktop`/`SearchMobile` уже гарантируют, что
  рендерится только один вариант за раз. Merge `/search` должен либо сохранить это условие, либо
  переписать докблок и сам подход. Тот же `compact?: boolean` есть и у `ActiveFilterChips`
  (`@features/catalog-filter/ui`, тот самый прецедент, на который ссылается докблок
  `GenreSelector`) — при `compact` она рендерит полностью другое дерево (`chipCompact`/`chipCompactRemove`
  вместо обычных чипов), а не просто другой CSS-класс, так что решение по инварианту "один вариант
  за раз" должно приниматься для обоих компонентов вместе, не только для `GenreSelector`.
- `HomeMobile` — единственное место, ещё сидящее на моковом `CATALOG` (`@entities/movie`), в то
  время как `HomeDesktop` уже на живых `useNewMovies()`/`useTopRatedMovies()`/rails. Слияние `Home`
  требует сначала перевести `HomeMobile`'s контент на те же живые хуки — иначе объединять нечего.
  После этого `CATALOG` (`@entities/movie/model/catalog.ts`+экспорт) остаётся без единого
  потребителя в `src` — удаляется в той же задаче (см. Task 8), а не оставляется как мёртвый
  публичный экспорт (см. Development Approach — тот же принцип, что применяется к `useViewport()`
  в Task 11).
- `MovieDesktop`/`MovieMobile`: `MovieMobile.tsx` (399 строк) действительно инлайнит собственную
  вёрстку табов (`TagPillMini`, `MiniStat`, `MobileActionBtn` и содержимое Overview/Cast/Details/
  Media) вместо переиспользования `src/pages/movie/ui/tabs/*`, которые использует `MovieDesktop.tsx`
  (49 строк) — гипотеза подтверждена чтением файла, не предположение. Кроме того,
  `src/pages/movie/ui/MovieDesktop/types.ts` экспортирует `LikedState` — тип, реально общий
  (импортируется `MovieHero.tsx` и `MovieActions.tsx`, которые уже общие непарные компоненты), а не
  desktop-специфика, несмотря на расположение внутри `MovieDesktop/`. Удалять `MovieDesktop/`
  напрямую нельзя — сначала `LikedState` переносится в общее место.
- `MovieRailDesktop`/`MovieRailMobile` расходятся не только в `ArrowBtn`/skeleton, но и в
  контракте: десктоп принимает `href?: string` (заголовок — `<Link>`), мобильный такого пропа не
  имеет и хардкодит "See all →" на `/search`; десктоп рендерит `EmptyState` при пустом `items`
  (добавлено намеренно, см. `docs/plans/20260814-async-boundary-retry-and-empty-states.md`),
  мобильный — нет; десктоп типизирован под `(Movie | PopularMovie)[]` и строит `rankBadge`, у
  мобильного — только `Movie[]`, рейтинг без rank-бейджа; мобильный оборачивает каждую карточку в
  `.scrollItem`. `MovieRailSkeletonDesktop` лежит внутри удаляемой `MovieRailDesktop/`, но
  экспортируется из публичного `src/widgets/movie-rail/index.ts` и используется в
  `HomeDesktop.tsx` — это публичный API слайса, переименование/перенос затрагивает call sites.
- `useViewport()` (`src/shared/lib/viewport/useViewport.ts`) — простой `resize`-listener хук,
  экспортируется из `@shared/lib`. Реально **вызывают** его только шесть `*Page.tsx`. `grep -rl
  useViewport src` дополнительно находит `src/features/catalog-filter/ui/GenreSelector/
  GenreSelector.tsx` и `GenreSelector.module.css` — но там только упоминание в докблоке/комментарии
  (см. следующий пункт), самого хука `GenreSelector` не вызывает. Разница важна для Task 11/12:
  критерий готовности "не осталось потребителей" должен проверяться по фактическим вызовам
  (`useViewport(`), а не по любому текстовому совпадению.
- `MobileCard` (`@entities/movie`) — реальные call sites на момент дискавери (проверено `grep`):
  `src/pages/favorites/ui/FavoritesMobile/FavoritesMobile.tsx`,
  `src/pages/popular/ui/PopularMobile/PopularMobile.tsx`,
  `src/pages/recommendations/ui/RecommendationsMobile/RecommendationsMobile.tsx`,
  `src/pages/search/ui/SearchMobile/SearchMobile.tsx`,
  `src/pages/movie/ui/MovieMobile/MovieMobile.tsx` (строка 219),
  `src/widgets/movie-rail/ui/MovieRailMobile/MovieRailMobile.tsx` (строка 35).
  `HomeMobile.tsx` **не** входит в этот список — он рендерит `MovieRailMobile`, а не `MobileCard`
  напрямую. Этот список — источник истины для Files-блока Task 2 (первая ревизия плана указывала
  список неточно).

**Как страницы подключены к роутингу:** `src/app/router.tsx` импортирует из `pages/*` только
`{X}Page` (например `FavoritesPage` из `src/pages/favorites/index.tsx` → `FavoritesPage.tsx`).
Слияние не должно менять публичный экспорт `*Page` ни в router.tsx, ни в `index.tsx` — меняется
только тело `*Page.tsx` (убирается `useViewport`-ветвление) и структура `ui/` внутри слайса.

## Development Approach

- **Testing approach:** Regular (сначала код, потом тесты) — это рефакторинг существующей
  вёрстки/логики без изменения наблюдаемого поведения, тесты переписываются под новую структуру
  компонентов после того, как слияние сделано.
- Каждая задача — одна страница или один виджет. Полностью завершать задачу (код + тесты +
  зелёный `make test`) прежде чем переходить к следующей.
- Порядок — от простого к сложному: `Card`/`MobileCard` → `Favorites` → `Popular` →
  `Recommendations` → навигационный chrome → `movie-rail` → `Home` → `Movie` → `Search`.
  `Search` — заведомо самая сложная задача (сайдбар vs bottom sheet, две модели пагинации UI) и
  идёт последней, когда весь остальной паттерн уже обкатан.
- Не удалять `useViewport()` целиком — сузить до точечных JS-развилок, явно перечисленных и
  обоснованных в Task 1 (и по мере обнаружения новых — в задаче, где они всплывают).
- Не трогать `src/pages/search/model/*` (хуки уже общие и не дублируются) — только
  презентационный слой.
- Не тащить в этот план: полный пересмотр мок-данных как отдельная фича, новую фичу virtualization
  (2.7 роадмапа — отдельный пункт). Единственное исключение — `CATALOG` (`@entities/movie`)
  удаляется в Task 8, потому что `HomeMobile` — его единственный потребитель в `src`, и слияние
  `Home` в любом случае требует перевести этот контент на живые хуки; после этого `CATALOG` —
  мёртвый экспорт, который по тому же принципу YAGNI, что применяется к `useViewport()` в Task 11,
  не оставляется "на будущее".
- Границы PR: одна задача (`Task N`) — минимум один PR; крупные задачи (`Home`/`Movie`/`Search` —
  Tasks 8-10) не дробить дальше внутри себя ни при каких обстоятельствах на несколько PR — там
  чек-боксы одной задачи логически неразделимы (нельзя смержить `Home` наполовину).

## Testing Strategy

- **Unit/component-тесты:** обязательны в каждой задаче для изменённой/новой функциональности
  (см. Development Approach). Старые `*Desktop.test.tsx`/`*Mobile.test.tsx` разделяются на:
  тесты, которые остаются валидны один-в-один (просто меняется импорт компонента) — переносятся;
  тесты, специфичные для варианта, которого больше нет (например, "рендерит `BottomNav`, если
  `isMobile`") — удаляются или переписываются на прямую проверку CSS-класса/DOM-узла, а не на мок
  `useViewport`.
- **E2E:** в проекте на момент написания плана нет Playwright/e2e-сетапа (2.5.5 роадмапа ещё не
  сделан) — этот план e2e не заводит, только unit/component.
- **Принципиальное ограничение jsdom:** jsdom не выполняет layout и не вычисляет media queries
  вообще (это не следствие настроек Vitest-конфига в `vite.config.ts` — добавление `css: true` туда
  ничего не изменило бы, `css: true` только позволяет CSS-модулям не падать при импорте, не включает
  расчёт `@media`) — элементы, которые в реальном браузере скрыты `@media (min-width: 720px)`/
  `@media (hover: hover)`, в тестах присутствуют в DOM одновременно с мобильным вариантом. Из этого
  следует правило для всех
  задач: компонентные тесты проверяют структуру/пропсы/поведение по кликам, а не "какой вариант
  показан на этой ширине экрана" — брейкпоинт-специфичная видимость проверяется только вручную
  (см. Post-Completion). Там, где слияние даёт в одном дереве два похожих интерактивных элемента
  с одинаковым accessible name (например, после Task 6 — `Header`'s nav и `BottomNav` внутри одного
  дерева, независимо от того, layout-route это или `SiteChrome`), тесты используют
  `within()`/`getAllByRole` с явной проверкой количества, а не
  голый `getByRole`, который упадёт на "found multiple elements".
- Полный прогон `make test` обязателен перед переходом к следующей задаче; `make check` (lint +
  build) — минимум перед Task 12 (verify) и в конце каждой из крупных задач (Home/Movie/Search),
  так как там выше риск сломать типы при слиянии пропсов.

## Progress Tracking

- Отмечай выполненные пункты `[x]` сразу по завершении.
- Новые задачи, всплывшие в процессе — с префиксом ➕.
- Блокеры — с префиксом ⚠️.
- Обнови этот файл, если объём задачи меняется по ходу реализации (особенно для Task 6/10 — там
  заранее не полностью известно, сколько внутренней дупликации найдётся).

## Audit

Заполняется в Task 1. Таблица "просто CSS" vs "разное поведение" по каждой паре
`*Desktop`/`*Mobile`, и итоговый список точечных мест, где `useViewport()` осознанно остаётся
(с обоснованием каждого). Стартовая точка — разбор в Context (выше) и Solution Overview (ниже); Task 1
должен либо подтвердить, либо уточнить/опровергнуть эти предположения по всем шести парам, не
только по тем, что уже вычитаны на этапе планирования (`Card`/`MobileCard`, `Favorites`,
`mobile-chrome`, `movie-rail`, `MovieDesktop`/`MovieMobile`, `Search`).

| Компонент/пара | Категория | Точечный `useViewport()`? | Обоснование |
| --- | --- | --- | --- |
| _(заполняется по ходу Task 1)_ | | | |

## Solution Overview

**Паттерн слияния для "просто разного CSS" компонентов** (`Card`, `Favorites`, `Popular`,
`Recommendations`, `MovieRail`): один компонент, один CSS-модуль, `min-width` media queries снизу
вверх. Мобильная раскладка — база без медиа-запроса; десктопная — оверрайд в
`@media (min-width: 720px)`. Разница в наборе видимых элементов (например hover-`.actions` у
`Card`) выражается через CSS (`@media (hover: hover)` для скрытия/показа hover-оверлея вместо
JS-проверки `isMobile`) — `hover`/`pointer` media-фичи существуют именно для этого случая и не
требуют JS.

**Паттерн для "разного UX, не только CSS"** (навигационный chrome, `search-sidebar` vs
bottom-sheet фильтры): оба варианта разметки остаются в дереве как разные компоненты, но выбор
между ними перестаёт быть обязанностью каждой страницы. Для навигационного chrome (Task 6)
предпочтительный вариант — layout-route с `<Outlet/>` в `src/app/`, который убирает выбор chrome
со страниц полностью (не просто переносит его в одну точку); `SiteChrome`-компонент внутри
`widgets/` — запасной вариант, если layout-route не подходит (решается по факту в задаче). Для
`Search` (Task 10) оба варианта фильтров остаются как разные компоненты внутри одного `Search`,
так как навигационный layout-route для страничного контента не подходит. Видимость между
вариантами — через CSS (`display: none` по брейкпоинту) там, где вариант можно безопасно
держать смонтированным; там, где смонтированный-но-скрытый вариант имеет побочные эффекты
(см. `Header`'s `?q`-debounce/⌘K-листенер в Task 6) — через `useViewport()` в этой единственной
точке. Ключевое отличие от текущего состояния: JS-ветвление, если остаётся, есть **в одном
месте на страницу**, а не разбросано по шести `*Page.tsx`.

**`useViewport()` после рефакторинга** — не удаляется, но его потребители сокращаются с шести
`*Page.tsx` до набора точечных мест, каждое из которых явно обосновано (список фиксируется в
Task 1 и уточняется по ходу Task 6/7/10): пример правомерного использования — там, где нужно
именно JS-решение (например, монтировать/не монтировать тяжёлый портал `BottomSheet`), а не просто
скрыть/показать CSS-ом.

## Technical Details

- Роутинг не меняется: `src/app/router.tsx` и публичные экспорты `pages/*/index.tsx`
  (`export { XPage } from './XPage'`) остаются как есть.
- Внутри каждого `pages/<slice>/ui/` пара `XDesktop/`+`XMobile/` заменяется на одну директорию
  `X/` (`X.tsx`, `X.module.css`, `index.tsx`) — по паттерну "Component structure" из `AGENTS.md`.
  `*Page.tsx` перестаёт импортировать `useViewport`, просто рендерит `<X />`.
  Тестовые файлы (`X.test.tsx`) переезжают вместе с компонентом.
- Брейкпоинт остаётся 720px — переиспользуется существующее значение `MOBILE_BREAKPOINT` там, где
  `useViewport()` реально остаётся, и как `min-width: 720px` в CSS остальных случаях, чтобы визуально
  граница не менялась.
- `Card`/`MobileCard` слияние — итоговый компонент экспортируется как `Card` (сохраняет текущее
  публичное имя из `@entities/movie`); `MobileCard` как отдельный экспорт удаляется, все call sites
  переходят на `Card` — точный список см. Files-блок Task 2 (не дублируется здесь во избежание
  расхождения двух списков).
- `HomeMobile`'s переход с `CATALOG` на живые данные (Task 8) — переиспользует существующие
  `useNewMovies()`/`useTopRatedMovies()` и, если нужно для паритета контента, `usePopularMovies()` —
  без новых API-обёрток, это уже готовые хуки из `@entities/movie`.

## What Goes Where

- **Implementation Steps** (`[ ]`): слияние компонентов, обновление CSS, обновление/перенос тестов,
  обновление `AGENTS.md`.
- **Post-Completion**: визуальная сверка на реальных устройствах/DevTools, ручная regression-прогонка
  golden path на мобильном вьюпорте браузера (в проекте пока нет e2e — эта проверка не
  автоматизирована).

## Implementation Steps

### Task 1: Аудит и фиксация точек, где `useViewport()` остаётся

**Files:**

- Modify: `docs/plans/20260827-mobile-first-adaptive-layout.md` (этот файл — заполнить таблицу в
  уже существующем разделе "Audit" под Progress Tracking). `AGENTS.md` в этой задаче не трогается —
  общий файл инструкций правится один раз, в Task 13, когда решения по всем задачам уже приняты, а
  не черновиком, который придётся переписывать по ходу восьми последующих задач.

- [ ] Пройтись по всем шести `*Page.tsx` (`favorites`, `home`, `movie`, `popular`,
      `recommendations`, `search`) и зафиксировать для каждой пары `*Desktop`/`*Mobile` — таблица
      "просто CSS" vs "разное поведение" (использовать разбор из Context выше как стартовую точку)
      прямо в этом файле плана.
- [ ] Явно перечислить кандидатов на сохранение `useViewport()` как точечного JS-форка
      (навигационный chrome — Task 6; `ArrowBtn`/hover-поведение `movie-rail` — Task 7;
      sidebar/bottom-sheet фильтры `Search` — Task 10) и критерий, по которому кандидат считается
      оправданным (CSS media-фичи типа `hover`/`pointer` не могут выразить нужное поведение, либо
      нужно условно не монтировать тяжёлый узел, а не просто скрыть).
- [ ] Задокументировать зависимость `GenreSelector`'s **и** `ActiveFilterChips`'s `compact` пропа
      (оба — `@features/catalog-filter/ui`) от текущего "рендерится только один вариант за раз"
      инварианта (см. Context) — решение (сохранить проп, управляемый явным JS-выбором в Task 10,
      или заменить на `@media`) фиксируется здесь и
      применяется в Task 10.
- [ ] Зафиксировать итоговый список файлов, тестов не пишем (это аудит/документ, не код) — но
      прогнать `grep -rn "useViewport(" src` (вызовы, не текстовые упоминания — см. пункт выше про
      `GenreSelector`) после Task 11 и свериться с этим списком (перепроверка, не отдельный тест).

### Task 2: Слияние `Card`/`MobileCard` в единый адаптивный `Card`

**Files:**

- Modify: `src/entities/movie/ui/Card/Card.tsx`, `src/entities/movie/ui/Card/Card.module.css`
- Delete: `src/entities/movie/ui/MobileCard/` (после переноса используемой логики и тестовых кейсов)
- Modify: `src/entities/movie/index.ts` (убрать экспорт `MobileCard`)
- Modify: реальные call sites `MobileCard` (см. Context — источник истины):
  `src/pages/favorites/ui/FavoritesMobile/FavoritesMobile.tsx`,
  `src/pages/popular/ui/PopularMobile/PopularMobile.tsx`,
  `src/pages/recommendations/ui/RecommendationsMobile/RecommendationsMobile.tsx`,
  `src/pages/search/ui/SearchMobile/SearchMobile.tsx`,
  `src/pages/movie/ui/MovieMobile/MovieMobile.tsx`,
  `src/widgets/movie-rail/ui/MovieRailMobile/MovieRailMobile.tsx`.
  Экспорт `MobileCard` удаляется в этой задаче, значит все шесть обновляются здесь же, даже если
  сама страница/виджет ещё не слиты в свою единую версию (это временно — они обновятся на `Card` уже
  готовым к их собственной задаче).
- Modify: `src/entities/movie/ui/Card/Card.test.tsx` (файл уже существует — расширить, влив
  актуальные кейсы `MobileCard.test.tsx`, а не создавать заново)

- [ ] Принять конкретное решение по слиянию разметки (не "CSS добавляет `.actions`" — CSS не может
      добавлять DOM-узлы, только показывать/скрывать существующие): **одна** кнопка избранного
      (один DOM-узел, один `aria-label`) — переиспользуется в обоих брейкпоинтах, позиционируется
      по-разному через CSS (`position`/`grid-area`), а не дублируется как два разных элемента
      (`CardBtn` внутри `.actions` у текущего `Card` и `.favoriteBtn` у текущего `MobileCard` — это
      сейчас два узла с одинаковым `aria-label`, при слиянии в один компонент нужно оставить только
      один). `Rate`/`Add` (`CardBtn` без аналога в `MobileCard`) — decorative-extra контролы,
      рендерятся всегда, скрываются `@media (hover: none)` (в реальном браузере `display: none`
      убирает элемент и из tab order — новых keyboard-ловушек на touch не создаёт). **`Eye`-кнопка
      сохраняет текущее гейтирование по `variant === 'grid'`** — проп `variant` (`'grid' | 'compact'`)
      **не удаляется**: это единственное его текущее применение в JSX (`Card.tsx:59`), и `variant`
      передаётся шестью десктопными call sites (`RelatedMovies.tsx`, `FavoritesDesktop.tsx`,
      `RecommendationsDesktop.tsx`, `SearchResultsGrid.tsx`, `PopularDesktop.tsx`,
      `MovieRailDesktop.tsx`) — если бы `variant` стал неиспользуемым пропом, `noUnusedParameters`
      (см. AGENTS.md, `tsconfig.app.json`) сделал бы это ошибкой сборки, а не просто мёртвым кодом.
      Эти шесть файлов не входят в Files-блок этой задачи и не требуют изменений — они продолжают
      передавать `variant` как раньше, меняется только реализация `Card` под ним. `Eye`-кнопка
      скрывается на touch тем же правилом `@media (hover: none)`, что `Rate`/`Add` — иначе на шести
      мобильных call sites (все со значением `variant` по умолчанию `'grid'`) она остаётся видимой
      и focusable без `ariaLabel`.
- [ ] Решить ещё два расхождения `Card`/`MobileCard`, помимо `.actions`: `Poster`'s `showLabel`
      (`Card` — `showLabel={!movie.poster}`, `MobileCard` — всегда `showLabel={false}`) и
      `.typeBadge` (рендерит только `Card`) — оба переносятся как есть в объединённый компонент
      (мобильная база наследует `Card`'s условие `showLabel`, `.typeBadge` остаётся decorative-extra
      того же типа, что `Rate`/`Add`/`Eye`, скрываемый по тому же `@media`-правилу), либо
      обосновывается другое решение — зафиксировать явно, не оставлять на "как получится по ходу
      слияния".
- [ ] Сохранить оба accessibility-паттерна DOM-порядка (title перед постером, восстановление
      визуального порядка через CSS `order`) — не регрессировать существующий Tab-порядок ни в
      одном брейкпоинте.
- [ ] Обновить шесть call sites из Files-блока: заменить импорт `MobileCard` на `Card` (ни один из
      них не передаёт `variant` — проп остаётся десктопной спецификой, см. первый чек-бокс задачи, эти
      шесть вызовов просто не указывают его, как и раньше). Отдельно проверить, что
      `MovieRailMobile`'s `.scrollItem`-обёртка вокруг карточки не конфликтует с новым CSS `Card`.
      Прогнать тесты этих шести файлов (`FavoritesMobile.test.tsx`, `PopularMobile.test.tsx`,
      `RecommendationsMobile.test.tsx`, `SearchMobile.test.tsx`, `MovieMobile.test.tsx`,
      `MovieRailMobile.test.tsx`) — запросы по названию/роли должны пережить замену компонента, но
      это не гарантировано автоматически.
- [ ] Влить кейсы `MobileCard.test.tsx` (149 строк) в `Card.test.tsx` — не терять покрытие
      мобильного набора кнопок/бейджей при удалении файла.
- [ ] Написать/обновить тесты: рендер с `isFavorite`/`onToggleFavorite` — проверять, что кнопка
      избранного **одна** (`getAllByRole('button', { name: /favorites/i })` возвращает ровно один
      элемент — см. Testing Strategy про jsdom и media queries), рендер `rankBadge`.
- [ ] Написать тесты для error/edge cases: постер отсутствует (`showLabel`), `rankBadge` не передан.
- [ ] `make test` — все зелёные до следующей задачи.

### Task 3: Слияние `FavoritesDesktop`/`FavoritesMobile` в единый `Favorites`

**Files:**

- Create: `src/pages/favorites/ui/Favorites/Favorites.tsx`, `Favorites.module.css`, `index.tsx`
- Modify: `src/pages/favorites/FavoritesPage.tsx` (убрать `useViewport`, рендерить `<Favorites />`)
- Delete: `src/pages/favorites/ui/FavoritesDesktop/`, `src/pages/favorites/ui/FavoritesMobile/`
- Create: `src/pages/favorites/ui/Favorites/Favorites.test.tsx` (объединяет актуальные кейсы из
  `FavoritesDesktop.test.tsx`, `FavoritesDesktop.retry.test.tsx`, `FavoritesMobile.test.tsx`)

- [ ] Свести `FavoritesDesktop`/`FavoritesMobile` в один компонент: сетка карточек (`grid`) с
      `Card` (после Task 2 это уже один компонент вместо `Card`/`MobileCard`), число колонок —
      через CSS grid `auto-fill`/`minmax` вместо разных `SKELETON_COUNT`/`grid` разметок.
- [ ] Навигационный chrome (`Header` vs `MobileHeader`+`BottomNav`) — оставить как временное
      `useViewport`-ветвление внутри `Favorites` до Task 6 (не решать здесь, чтобы не блокировать
      более простую задачу архитектурным вопросом навигации) **или**, если Task 6 решено делать
      раньше по ходу работы — использовать готовую точку композиции. Явно зафиксировать, какой из
      двух вариантов выбран, в этой задаче.
- [ ] Перенести `EmptyState`/`AsyncBoundary`/retry-логику (`onRetry={() =>
      getMoviesByIds.invalidate(ids)}`) без изменений в поведении.
- [ ] Слить и адаптировать тесты трёх исходных файлов под новый `Favorites` (skeleton, empty state,
      retry, рендер карточек) — успешные и ошибочные сценарии.
- [ ] `make test` — все зелёные до следующей задачи.

### Task 4: Слияние `PopularDesktop`/`PopularMobile` в единый `Popular`

**Files:**

- Create: `src/pages/popular/ui/Popular/Popular.tsx`, `Popular.module.css`, `index.tsx`
- Modify: `src/pages/popular/PopularPage.tsx`
- Delete: `src/pages/popular/ui/PopularDesktop/`, `src/pages/popular/ui/PopularMobile/`
- Create: `src/pages/popular/ui/Popular/Popular.test.tsx`

- [ ] Прочитать текущие `PopularDesktop.tsx`/`PopularMobile.tsx` перед слиянием (следующий шаг
      этой задачи, не сделан на этапе планирования) — свести по тому же паттерну, что Task 3
      (`Card`+`rankBadge`, grid раскладка через CSS).
- [ ] Слить раскладку rank-бейджей (`PopularBadge`) — они уже параметризуются через `rankBadge`
      проп `Card`/`MobileCard` (см. AGENTS.md "rankBadge slot placement"); после Task 2 это один
      слот в едином `Card` — сверить, что позиционирование бейджа не регрессирует ни в одном
      брейкпоинте.
- [ ] Навигационный chrome — тот же принцип, что в Task 3.
- [ ] Слить тесты `PopularDesktop.test.tsx`/`PopularMobile.test.tsx`.
- [ ] `make test` — все зелёные до следующей задачи.

### Task 5: Слияние `RecommendationsDesktop`/`RecommendationsMobile` в единый `Recommendations`

**Files:**

- Create: `src/pages/recommendations/ui/Recommendations/Recommendations.tsx`, `.module.css`, `index.tsx`
- Modify: `src/pages/recommendations/RecommendationsPage.tsx`
- Delete: `src/pages/recommendations/ui/RecommendationsDesktop/`, `src/pages/recommendations/ui/RecommendationsMobile/`
- Create: `src/pages/recommendations/ui/Recommendations/Recommendations.test.tsx`
- Modify: `src/pages/recommendations/RecommendationsPage.test.tsx` (сейчас мокает/использует
  `useViewport` — обновить под убранное ветвление)

- [ ] Слить `RecommendationsDesktop`/`RecommendationsMobile` (grid карточек + empty-state
      "добавь в избранное") по паттерну Task 3/4. `model/useRecommendedMovies.ts` не трогать —
      уже общий page-слой хук.
- [ ] Навигационный chrome — тот же принцип, что в Task 3/4.
- [ ] Слить тесты `RecommendationsDesktop.test.tsx`/`RecommendationsMobile.test.tsx`, обновить
      `RecommendationsPage.test.tsx` (убрать мок `useViewport`, если тест был завязан именно на
      выбор варианта, а не на поведение страницы).
- [ ] `make test` — все зелёные до следующей задачи.

### Task 6: Единая точка выбора навигационного chrome (`Header` vs `MobileHeader`+`BottomNav`)

**Files:**

- Create (вариант A, layout-route — оценить первым): `src/app/layouts/AppLayout.tsx` (или
  аналогичное имя) с `<Outlet/>`, подключается в `src/app/router.tsx` как обёртка над всеми шестью
  роутами; `activeNav` выводится из `useLocation()` вместо пропа с каждой страницы.
- Create (вариант B, если A не подходит — см. чек-бокс ниже): `src/widgets/site-chrome/` —
  `index.ts` экспортирует `<SiteChrome activeNav=... variant=... />`.
- Modify (вариант A — если принят, затрагивает **все шесть** слайсов, не только уже слитые):
  `src/app/router.tsx`; `src/pages/favorites/ui/Favorites/Favorites.tsx`,
  `src/pages/popular/ui/Popular/Popular.tsx`,
  `src/pages/recommendations/ui/Recommendations/Recommendations.tsx` (убрать временное
  `useViewport`-ветвление chrome из Task 3-5); а также ещё не слитые на этот момент
  `src/pages/home/ui/HomeDesktop/HomeDesktop.tsx`, `src/pages/home/ui/HomeMobile/HomeMobile.tsx`,
  `src/pages/movie/ui/MovieDesktop/MovieDesktop.tsx`, `src/pages/movie/ui/MovieMobile/MovieMobile.tsx`,
  `src/pages/search/ui/SearchDesktop/SearchDesktop.tsx`, `src/pages/search/ui/SearchMobile/SearchMobile.tsx`
  (все шесть по-прежнему рендерят свой `Header`/`MobileHeader`+`BottomNav` напрямую — под layout-route
  это даёт двойной chrome на `/`, `/movie/:id`, `/search`, пока Task 8-10 не слиты, если это не убрать
  здесь же; см. чек-бокс ниже) — **либо**, если вариант A откладывается до завершения Task 10, явно
  зафиксировать это здесь как принятое решение, а не как факт, обнаруженный постфактум.
- Modify (вариант B): те же три уже слитых слайса (`Favorites`/`Popular`/`Recommendations`),
  заменить ветвление на `<SiteChrome />`.
- Create: тесты на выбранный вариант (layout-route или `SiteChrome`)

- [ ] **Сначала оценить layout-route** (`<Outlet/>` в `src/app/`, обёртывающий все роуты в
      `router.tsx`) как основной вариант, а не сразу проектировать `SiteChrome`: он не создаёт
      новый слайс, не требует кросс-импорта `@widgets/header`+`@widgets/mobile-chrome` из третьего
      виджета на том же слое (что иначе нарушает границы FSD — оба сейчас независимы друг от
      друга), убирает chrome из всех шести страниц полностью, а не переносит выбор в одну точку, и
      позволяет вывести `activeNav` из `useLocation()` вместо прокидывания пропа с каждой страницы.
      Записать здесь явно, почему layout-route не подходит, если решение — всё же `SiteChrome`
      (вариант B) внутри `widgets/`.
- [ ] Если принят вариант A — сразу в этой задаче убрать прямой рендер `Header`/`MobileHeader`+
      `BottomNav` из всех шести исходных `*Desktop`/`*Mobile` файлов (см. Files-блок выше), а не
      только из трёх уже слитых в Task 3-5, и вывести `Header`'s `variant='search'` из текущего
      роута (`useLocation()`), а не из пропа — иначе на `/`, `/movie/:id` и `/search` в дереве
      будет по два chrome одновременно вплоть до Task 8-10.
- [ ] Определить: `Header` безусловно (независимо от `variant`) вешает debounce-запись `?q` в URL
      (`Header.tsx`, эффект на строках 84-124). Глобальный `keydown`-листенер на ⌘K уже условный —
      он навешивается только при `variant === 'search'` (`Header.tsx:51`, ранний `return`), так что
      скрытый/неактивный `Header` на других роутах его не создаёт. Сейчас `Header` на мобильных
      страницах вообще не монтируется. Если выбранный вариант рендерит `Header` и `MobileHeader`+
      `BottomNav` одновременно (оба варианта — и layout-route, и `SiteChrome` эту развилку не
      убирают сами по себе), нужно решить: либо `Header` размонтирован (не просто скрыт
      `display: none`) на мобильном брейкпоинте через `useViewport()` именно в этой единственной
      точке (это и есть допустимая точечная развилка из Task 1 — критерий отката здесь **не
      производительность DOM**, а тот факт, что скрытый `Header` продолжит безусловно писать/
      стирать `?q` в URL на роуте, где это не нужно), либо эффект `?q`-записи в `Header` явно
      гейтится тем же условием, что уже используется для ⌘K-листенера. Задокументировать выбор.
- [ ] Если остаётся вариант "оба смонтированы, видимость через CSS" — использовать именно
      `display: none` (не `visibility: hidden`/off-screen позиционирование), чтобы скрытый вариант
      выпадал из a11y-дерева и не давал дублирующихся `nav`/`banner` landmarks для скринридеров.
- [ ] Свести соответствие ключей `activeNav` (`Header`: `home | movie | series | anime | favorites
      | popular | recommendations`) и `active` (`BottomNav`: `home | search | lists | popular |
      recommendations | profile`) — множества пересекаются частично (`favorites`↔`lists` разные
      имена, `movie`/`series`/`anime` нет аналога в `BottomNav`, `search`/`profile` нет аналога в
      `Header`). Не "приводить к одному набору ключей" (невозможно без переименования одного из
      компонентов) — завести явную таблицу-маппинг `выбранный-ключ → {activeNav?, active?}` с
      понятным поведением для ключей без пары в одном из компонентов.
- [ ] Под вариантом A решить судьбу пропов `MobileHeader`, которые сейчас передаются каждой
      страницей по-своему, а не выводятся из роута: `title` (`FavoritesMobile.tsx` — `'Favorites'`,
      `PopularMobile.tsx` — `'Popular'`, `RecommendationsMobile.tsx` — `'Recommended for you'`);
      и особенно `MovieMobile.tsx` (`onBack={() => navigate(-1)}`, `showSearch={false}`,
      `rightAction={<button className={s.shareBtn}><ShareIcon/></button>}`, где `s.shareBtn` —
      CSS-класс из **page-local** модуля `MovieMobile.module.css`, а не общего chrome-стиля; layout
      в `app/` не может напрямую сослаться на него). Не выводить эти пропы из `useLocation()`
      неявно — либо завести route→config карту в `app/` (title/back/showSearch по путям), либо
      предусмотреть в layout-решении слот/контекст, которым конкретная страница сама передаёт
      `rightAction`. Без явного решения здесь Task 9 (Movie) буквально теряет кнопку "назад" и
      "поделиться" и заново включает search-триггер, который `MovieMobile` осознанно отключает
      (`showSearch` по умолчанию `true`, `MobileHeader.tsx`). Аналогично для `BottomNav`'s `active`
      на `/movie/:id` (`MovieMobile.tsx` — `active='search'`, не `'home'`, хоть роут и не `/search`)
      — не выводится тривиально из пути, тоже входит в route→config карту. Отдельно — `Header`'s
      `activeNav` на `/search` (`SearchDesktop.tsx`: `activeNav={filters.type ?? 'search'}`) выводится
      не из пути (везде один `/search`), а из `?type` в URL (`useFilterState()`/
      `getFilterFromSearchParams`) — при переходе на layout-route для этого случая нужен доступ к
      `useSearchParams()`, а не только к `useLocation().pathname`. Это — фикс из предыдущего ревью
      (см. `SearchDesktop.test.tsx`, тест "nav pill в шапке подсвечивается по `?type`"), при
      слиянии его нужно перенести на новое место, а не потерять вместе с удаляемым `SearchDesktop.tsx`.
- [ ] Переключить `Favorites`/`Popular`/`Recommendations` (уже слитые в Task 3-5) на выбранное
      решение, убрать их временное `useViewport`-ветвление chrome.
- [ ] Решить владение `Footer` (сейчас рендерится только в `HomeDesktop`, ни в одной другой
      странице/варианте) — не в этой задаче принимать финальное решение (Footer относится к
      контенту `Home`, не к nav chrome), но зафиксировать здесь, что `SiteChrome`/layout-route его
      **не** включает, чтобы Task 8 не унаследовал его "случайно" через общий chrome-компонент.
- [ ] Написать тесты: корректный `activeNav`/`active` доходит до обоих вариантов chrome; при
      `variant='search'` рендерится search-специфика `Header`; если оба варианта в одном DOM-дереве
      (jsdom не применяет CSS, см. Testing Strategy) — тесты используют `within()`/`getAllByRole`
      с проверкой количества, а не `getByRole`.
- [ ] `make test` — все зелёные до следующей задачи.

### Task 7: Слияние `MovieRailDesktop`/`MovieRailMobile` в единый `MovieRail`

**Files:**

- Modify/Create: `src/widgets/movie-rail/ui/MovieRail/` (новая единая директория)
- Delete: `src/widgets/movie-rail/ui/MovieRailDesktop/`, `src/widgets/movie-rail/ui/MovieRailMobile/`
- Modify: `src/widgets/movie-rail/index.ts`
- Modify: call sites (`src/pages/home/ui/PersonalRails`, `PopularMoviesRail`, `TopAnimeRails`,
  `TrandingSeriesRail`, `src/pages/home/ui/HomeDesktop/HomeDesktop.tsx`,
  `src/pages/home/ui/HomeMobile/HomeMobile.tsx` — последний импортирует `MovieRailMobile` напрямую
  (`HomeMobile.tsx:4`) и ещё не слит с `HomeDesktop` на этот момент; временно перевести на
  `MovieRail`, Task 8 донесёт до финального единого `Home`)
- Create: `src/widgets/movie-rail/ui/MovieRail/MovieRail.test.tsx`

- [ ] Свести `MovieRailDesktop`/`MovieRailMobile` в один компонент: базовая раскладка — нативный
      horizontal-scroll (как у `MovieRailMobile`); `ArrowBtn` рендерится всегда, видимость
      управляется `@media (hover: hover) and (pointer: fine)` (десктоп с мышью) вместо JS
      `isMobile`-проверки — устройство с тачскрином не увидит стрелки независимо от ширины экрана,
      что даже точнее исходного намерения, чем брейкпоинт по ширине.
- [ ] Свести пять реальных различий контракта (не только `ArrowBtn`/skeleton), подтверждённых
      чтением обоих файлов: (1) заголовок — `href?: string` даёт `<Link>`-обёртку у десктопа,
      мобильный хардкодит "See all →" на `/search` без пропа — итоговый компонент сохраняет
      `href?: string`, обе ссылки используют его; (2) `EmptyState` при пустом `items` — есть только
      у десктопа (добавлено намеренно, см. `docs/plans/20260814-async-boundary-retry-and-empty-states.md`)
      — переносится в объединённый компонент безусловно, не теряется; (3) типизация `items:
      (Movie | PopularMovie)[]` с `rankBadge`/`PopularBadge` — есть только у десктопа, мобильный
      принимал только `Movie[]` без rank-бейджа — итоговый тип берётся из десктопной версии
      (более широкий, обратной совместимости с уже слитым `Card` из Task 2 достаточно); (4)
      мобильная версия оборачивает каждую карточку в `.scrollItem` — сохранить обёртку в едином
      компоненте; (5) `MovieRailSkeletonDesktop` лежит внутри удаляемой `MovieRailDesktop/`, но
      экспортируется из публичного `src/widgets/movie-rail/index.ts` и используется в
      `HomeDesktop.tsx`/после Task 8 — `Home.tsx` — перенести в новую `MovieRail/` директорию под
      тем же или новым именем, обновить экспорт в `index.ts` и call site; (6) `MovieRailDesktop`
      передаёт `Card`'s `variant='compact'` (без `Eye`-кнопки), `MovieRailMobile` использует
      `MobileCard` — после Task 2 её карточки без явного `variant` получают дефолт `'grid'` (с
      `Eye`) — единый `MovieRail` должен явно передавать `variant='compact'` в обоих брейкпоинтах,
      сохраняя текущее отсутствие `Eye`-кнопки в рейлах.
- [ ] Обновить все call sites, использующие `MovieRailDesktop`/`MovieRailMobile` напрямую.
- [ ] Слить тесты `MovieRailDesktop.test.tsx`/`MovieRailMobile.test.tsx`.
- [ ] `make test` — все зелёные до следующей задачи.

### Task 8: Слияние `HomeDesktop`/`HomeMobile` в единый `Home` (+ перевод с `CATALOG` на живые данные)

**Files:**

- Create: `src/pages/home/ui/Home/Home.tsx`, `Home.module.css`, `index.tsx`
- Modify: `src/pages/home/HomePage.tsx`
- Delete: `src/pages/home/ui/HomeDesktop/`, `src/pages/home/ui/HomeMobile/`
- Modify: `src/pages/home/ui/PersonalRails/PersonalRails.tsx` и соседние rail-компоненты, если они
  сейчас параметризованы под `HomeMobile`'s `CATALOG`-путь отдельно от `HomeDesktop`
- Create: `src/pages/home/ui/Home/Home.test.tsx`

- [ ] Прочитать `HomeMobile.tsx` полностью (98 строк, не вычитан на этапе планирования) и
      выяснить точный объём контента, который сейчас идёт из `CATALOG` — сопоставить с рейлами,
      которые уже использует `HomeDesktop` (`PersonalRails`, `PopularMoviesRail`, `TopAnimeRails`,
      `TrandingSeriesRail`).
- [ ] Перевести весь контент `HomeMobile`'s секций на те же живые хуки/rail-компоненты, что
      `HomeDesktop` — до этого шага слияние невозможно (два разных источника данных для одного
      компонента).
- [ ] Добавить MSW-хендлеры (`src/test/`) для эндпоинтов, которые теперь дёргает мобильный контент
      в тестах (`usePopularMovies`/`useNewMovies`/`useTopRatedMovies` — `setupServer` работает с
      `onUnhandledRequest: 'error'`, недостающий хендлер валит тест, а не молча пропускает запрос),
      и обернуть мобильный контент в `AsyncBoundary` (роадмап 1.6 намеренно оставлял `HomeMobile`
      вне скоупа `AsyncBoundary` до этого пункта — теперь входит в задачу).
- [ ] Удалить `CATALOG` (`@entities/movie`) и его экспорт — после этого шага `HomeMobile`'s
      контент больше на него не ссылается, а других потребителей в `src` нет (см. Development
      Approach).
- [ ] Свести `HomeDesktop`/`HomeMobile` в единый `Home`, включая `HeroSection` (уже общий,
      не парный, проверить что не требует изменений) и chrome-решение из Task 6.
- [ ] Решить владение `Footer` (сейчас только в `HomeDesktop`) — перенести в единый `Home`
      безусловно (рендерится в обоих брейкпоинтах) либо обосновать, почему остаётся
      десктоп-специфичным через CSS-скрытие; зафиксировать выбор здесь.
- [ ] Обновить `MovieRail` call sites на новый единый компонент из Task 7 (если ещё не сделано).
- [ ] Слить тесты `HomeDesktop.test.tsx` под новый `Home` (у `HomeMobile` отдельного `.test.tsx`
      не было на момент дискавери — написать новый набор тестов на мобильный контент, которого
      раньше не было в тестах).
- [ ] `make test` и `make check` — все зелёные до следующей задачи.

### Task 9: Слияние `MovieDesktop`/`MovieMobile` в единый `Movie`

**Files:**

- Create: `src/pages/movie/ui/Movie/Movie.tsx`, `Movie.module.css`, `index.tsx`
- Create: `src/pages/movie/ui/types.ts` (новый дом для `LikedState`, см. первый чек-бокс)
- Modify: `src/pages/movie/MoviePage.tsx`
- Modify: `src/pages/movie/ui/MovieHero/MovieHero.tsx`, `src/pages/movie/ui/MovieActions/MovieActions.tsx`
  (обновить импорт `LikedState` с `../MovieDesktop/types` на новый путь — **до** удаления `MovieDesktop/`)
- Delete: `src/pages/movie/ui/MovieDesktop/`, `src/pages/movie/ui/MovieMobile/`
- Modify: `src/pages/movie/ui/tabs/*` (`MovieMobile` инлайнит их логику вместо переиспользования —
  подтверждено чтением файла, см. Context; доработать под мобильную раскладку через CSS)
- Create: `src/pages/movie/ui/Movie/Movie.test.tsx`

- [ ] Перенести `LikedState` из `src/pages/movie/ui/MovieDesktop/types.ts` в
      `src/pages/movie/ui/types.ts` и обновить импорты в `MovieHero.tsx`/`MovieActions.tsx` — этот
      тип общий (не desktop-специфика, несмотря на текущее расположение), удаление `MovieDesktop/`
      без этого шага ломает сборку обоих файлов.
- [ ] Завести `MovieMobile`'s контент на переиспользуемые `ui/tabs/*` компоненты
      (`OverviewTab`/`CastTab`/`DetailsTab`/`MediaTab`) вместо инлайновой копии вёрстки/логики,
      которую сейчас содержит `MovieMobile.tsx` (399 строк против 49 у `MovieDesktop.tsx`) — это
      основной объём работы задачи, делать до попытки свести оболочки в один компонент.
- [ ] Свести `MovieHero`, `MovieTabsNav`, `MovieActions`, `RelatedMovies` (уже общие,
      не парные) в единый `Movie` вместе с chrome-решением из Task 6.
- [ ] Сохранить `key={id}` на варианте контента (сейчас навешан в `MovieDetailContent`/`MoviePage.tsx`
      для ремаунта таба при смене id между фильмами, см. коммит `04cfa61` "reset movie tab on
      navigation") — не потерять при слиянии `MovieDesktop`/`MovieMobile` в одно дерево.
- [ ] Обеспечить, что 404-обработка (`ApiError`+`AsyncBoundary.errorFallback`, см. AGENTS.md
      "Data state") и retry (`invalidateMovieDetail`) не регрессируют при слиянии.
- [ ] Слить тесты `MovieDesktop.test.tsx`/`MovieMobile.test.tsx`/`MoviePage.test.tsx` —
      `testFixtures.ts` и `lib/groupCrewByProfession.ts`/тест не трогать (не завязаны на
      Desktop/Mobile).
- [ ] `make test` и `make check` — все зелёные до следующей задачи.

### Task 10: Слияние `SearchDesktop`/`SearchMobile` в единый `Search`

**Files:**

- Create: `src/pages/search/ui/Search/Search.tsx`, `Search.module.css`, `index.tsx`
- Modify: `src/pages/search/SearchPage.tsx`
- Delete: `src/pages/search/ui/SearchDesktop/`, `src/pages/search/ui/SearchMobile/`
- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx`,
  `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.test.tsx`,
  `src/widgets/search-sidebar/index.ts` (или заменить единым filter-composition компонентом —
  решить в задаче)
- Modify: `src/pages/search/ui/Pagination/Pagination.tsx` (вобрать `MobilePagination`, сейчас
  определённый инлайново в `SearchMobile.tsx`, как режим/вариант единого `Pagination`)
- Modify: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.tsx`,
  `src/features/catalog-filter/ui/ActiveFilterChips/ActiveFilterChips.tsx` (пересмотреть докблок и
  механику `compact` пропа для обоих согласно решению из Task 1)
- Create: `src/pages/search/ui/Search/Search.test.tsx`

- [ ] Реализовать решение из Task 1 по `SearchSidebar` vs bottom-sheet фильтрам: оба варианта
      разметки остаются (это тот самый "разный UX" случай из Solution Overview, не CSS-only), но
      выбор между ними и выбор `Pagination`-варианта переезжают в единый `Search`, а не
      разбросаны по `SearchDesktop.tsx`/`SearchMobile.tsx` отдельно. **Отклонение от буквальной
      формулировки роадмапа** (2.5: "фильтры — drawer на мобильной базе, раскрываются в сайдбар на
      широких экранах", подразумевающей один компонент) — сознательное, по той же причине, что и
      навигационный chrome: sidebar (always-visible radio-rows) и bottom-sheet (открывается по
      кнопке, портал, свой open/close state) не сводятся в одну CSS-раскладку без потери UX.
      Аналогичный прецедент отклонения от буквального роадмапа уже задокументирован в AGENTS.md
      (`useRecommendedMovies` vs роадмапного `useRecommendations`) — зафиксировать так же явно
      здесь, а не молча.
- [ ] Слить `Pagination`/`MobilePagination` в один компонент с двумя визуальными режимами через
      CSS (обе уже используют общие `buildPageRange`/`clampPage` из `lib/buildPageRange.ts` — эта
      часть не дублируется, дублируется только JSX/CSS обёртка).
- [ ] Обновить/подтвердить `compact` проп у `GenreSelector` **и** `ActiveFilterChips`: если после
      слияния оба варианта фильтров технически могут сосуществовать в DOM одновременно (даже если
      один скрыт CSS) — инвариант "рендерится только один вариант" ломается для обоих компонентов
      одинаково, проп должен продолжать явно передаваться вызывающей стороной единого `Search` (не
      полагаться на case из докблока `GenreSelector`, переписать докблок под новую структуру).
- [ ] Свести `SearchResults`/`MobileSearchResults` (сейчас два похожих компонента под `use()`
      внутри `useMovieCatalog`, см. докблоки в обоих файлах) в один, сохранив разделение Suspense
      boundary от остальной страницы (см. существующие докблоки — не терять это обоснование).
      `SearchHeader`, `SearchControls`, `SearchResultsGrid`/`SearchResultSkeletonGrid`, `SortSelect`
      уже общие компоненты — проверить, что они действительно не требуют изменений.
- [ ] Не трогать `usePageSync`/`useCatalogUpdateStatus`/`useMovieCatalog` (`src/pages/search/model/`)
      — уже общий слой, слияние касается только `ui/`.
- [ ] Слить тесты `SearchDesktop.test.tsx`/`SearchMobile.test.tsx`, обновить/перенести тесты
      `Pagination.test.tsx` под объединённый компонент.
- [ ] `make test` и `make check` — все зелёные до следующей задачи.

### Task 11: Финальная зачистка `useViewport()` и мёртвого кода

**Files:**

- Modify: `src/shared/lib/viewport/useViewport.ts` (без изменений в реализации, если остаётся
  нужен хотя бы в одном месте; удалить полностью, если Task 1-10 не оставили ни одного
  потребителя)
- Modify: `src/shared/lib/index.ts`, `src/shared/lib/viewport/index.ts` (актуализировать экспорт)

- [ ] `grep -rn "useViewport(" src` (вызовы, а не любые упоминания — см. Context про
      `GenreSelector`'s докблок, который матчится на текстовый `useViewport`, но хук не вызывает)
      и сверить результат со списком из Task 1 — каждый оставшийся потребитель должен быть в
      списке обоснованных точечных развилок, иначе он либо забытый `*Desktop`/`*Mobile`-остаток
      (доделать слияние), либо не обоснован (вынести решение в Task 1-документ и договориться,
      оставлять или убирать).
- [ ] Если потребителей не осталось совсем — удалить `useViewport.ts` и его экспорты (не оставлять
      неиспользуемый публичный API "на будущее" — противоречит YAGNI).
- [ ] Проверить, что нигде не остались пустые/неиспользуемые директории `*Desktop`/`*Mobile`
      (`find src -type d -iname "*Desktop" -o -type d -iname "*Mobile"` — пусто, кроме случаев,
      явно исключённых из скоупа плана, если такие найдутся).
- [ ] Прогнать `make lint` — `noUnusedLocals`/`noUnusedParameters` (см. AGENTS.md) поймает мёртвые
      импорты после удаления файлов.
- [ ] `make test` и `make check` — все зелёные.

### Task 12: Verify acceptance criteria

**Files:** нет изменений кода — только проверки.

- [ ] Все страницы (`/`, `/search`, `/movie/:id`, `/favorites`, `/popular`, `/recommendations`)
      рендерятся как единые компоненты без `*Desktop`/`*Mobile` пар.
- [ ] Каждая страница визуально корректна на 375px (мобильный база) и 1440px (десктоп) — ручная
      проверка в браузере/DevTools responsive mode по каждой странице.
- [ ] `useViewport()` используется только в местах, явно обоснованных в Task 1/6/7/10 — либо
      удалён, если обоснованных мест не осталось.
- [ ] `grep -rn "isMobile"` по `src/pages`, `src/widgets`, `src/entities` не находит забытых
      условных веток вне зафиксированного списка (исключить сам `useViewport.ts` — там `isMobile`
      это имя поля возвращаемого объекта, а не условная ветка).
- [ ] `make test` — полный прогон, все зелёные.
- [ ] `make check` (lint + build) — зелёный.
- [ ] Приложение вручную открыто на golden path (главная → поиск → карточка фильма → избранное →
      popular → recommendations) — регрессий в навигации/интерактивах нет.

### Task 13: [Final] Обновить документацию

**Files:**

- Modify: `AGENTS.md`
- Modify: `plans/roadmap.md`
- Move: `docs/plans/20260827-mobile-first-adaptive-layout.md` → `docs/plans/completed/`

- [ ] Переписать раздел "Responsive pattern" в `AGENTS.md`: убрать формулировку "Pages and
      widgets ship paired `*Desktop`/`*Mobile` components" как обязательный паттерн; описать
      mobile-first CSS-подход и явно перечислить оставшиеся точечные использования `useViewport()`
      (если есть) с обоснованием каждого — по итогам Task 1/11.
- [ ] Обновить/удалить остальные места в `AGENTS.md`, ссылающиеся на старый паттерн (найдено при
      дискавери плана, список неполный — перепроверить `grep -n "Desktop\|Mobile\|useViewport" AGENTS.md`
      перед правкой): "Stretched-link pattern (`Card`/`MobileCard`)"; весь абзац про разное
      размещение `rankBadge` в `Card` vs `MobileCard` (полностью теряет смысл после Task 2); "Still
      mock data: `HomeMobile` still renders `CATALOG`" и "`CATALOG` remains, still used by
      `HomeMobile`" (оба — после Task 8 неверны); упоминание `GenreSelector` "used by both
      `SearchSidebar` and `SearchMobile.tsx`"; строка `@shared/lib` в таблице "Key public APIs",
      где перечислен `useViewport()`, если хук удалён в Task 11.
- [ ] Обновить таблицу "Key public APIs" в `AGENTS.md`, если публичные экспорты слайсов изменились
      (например, `MobileCard` убран из `@entities/movie`).
- [ ] Отметить пункт 2.5 и все его подпункты `[x]` в `plans/roadmap.md`.
- [ ] Переместить этот файл в `docs/plans/completed/`.

## Post-Completion

**Ручная проверка** (в проекте нет e2e/Playwright на момент этого плана — п. 2.5.5 роадмапа ещё не
выполнен):

- Визуальная regression-сверка каждой мигрированной страницы на реальном мобильном устройстве
  (не только эмуляции DevTools) — особенно `BottomSheet`/`SearchSidebar` в Task 10 и hover/touch
  поведение `MovieRail`'s стрелок в Task 7.
- Ручной прогон golden path с клавиатуры (Tab/Enter) на обоих брейкпоинтах — слияние `Card`
  (Task 2) меняет DOM-порядок интерактивов, стоит перепроверить a11y-инвариант, задокументированный
  в AGENTS.md ("Component structure" → Stretched-link pattern), а не полагаться только на то, что
  тесты его покрыли.
- Lighthouse Performance на `/` до/после Task 7-8 (двойной DOM navigation chrome из Task 6 и
  всегда смонтированный `ArrowBtn` в Task 7 потенциально увеличивают вес страницы — стоит сверить,
  что это не заметно на метриках).
