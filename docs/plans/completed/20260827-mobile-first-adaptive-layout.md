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
| `Card`/`MobileCard` (`@entities/movie`) | Просто CSS | Нет | Единственное реальное расхождение — `.actions` hover-оверлей (`Card`) vs всегда видимая `.favoriteBtn` (`MobileCard`); `hover`/`pointer` media-фичи выражают это без JS. Остальные расхождения (`Poster`'s `showLabel`, `.typeBadge`, DOM-порядок title/poster) — тоже чисто CSS/verstka, подтверждено чтением обоих файлов целиком. `variant` (`'grid'`\|`'compact'`) — не breakpoint-развилка, а декларативный проп вызывающей стороны (гейтит `Eye`-кнопку), остаётся как есть. |
| `FavoritesDesktop`/`FavoritesMobile` | Просто CSS | Нет (навигационный chrome — см. Task 6 строку ниже) | Разница — только грид-раскладка карточек и обёртка chrome (`Header` vs `MobileHeader`+`BottomNav`); последнее — не собственная развилка `Favorites`, а временное наследование текущего паттерна до Task 6. |
| `PopularDesktop`/`PopularMobile` | Просто CSS | Нет (chrome — см. Task 6) | Тот же паттерн, что `Favorites`: грид + `rankBadge` слот в `Card`, различий в бизнес-логике нет. |
| `RecommendationsDesktop`/`RecommendationsMobile` | Просто CSS | Нет (chrome — см. Task 6) | Тот же паттерн: грид карточек + общий `model/useRecommendedMovies.ts`, различий в поведении нет. |
| `@widgets/mobile-chrome` (`MobileHeader`+`BottomNav`) vs `@widgets/header`'s `Header` | Разное поведение | Да — единственная точка выбора после Task 6 | Не разный CSS одного и того же дерева, а два разных навигационных паттерна (верхний header с inline-поиском/⌘K-листенером vs bottom nav + отдельный mobile header); подтверждено — `Header`'s ⌘K-эффект (`Header.tsx:50-66`) гейтится `variant === 'search'`, но `?q`-debounce-эффект (`Header.tsx:84-124`) пишет в URL безусловно, независимо от variant/видимости — если оба chrome смонтированы одновременно (layout-route/`SiteChrome`, Task 6), нужна явная JS-точка, которая размонтирует неактивный вариант, а не просто скрывает CSS-ом, иначе скрытый `Header` продолжает молча писать/стирать `?q` на роутах, где это не нужно. |
| `@widgets/movie-rail` (`MovieRailDesktop`/`MovieRailMobile`) | Просто CSS (после объединения контракта) | Нет | `ArrowBtn`-видимость выражается `@media (hover: hover) and (pointer: fine)` — точнее исходного intent (тачскрин любой ширины не должен видеть стрелки). Остальные пять расхождений контракта (`href`, `EmptyState`, `(Movie\|PopularMovie)[]` тип, `.scrollItem`-обёртка, `MovieRailSkeletonDesktop`-экспорт) — не JS-развилки, а разница в объёме реализованного функционала, переносятся в объединённый компонент безусловно (подтверждено чтением обоих файлов, 78 vs 45 строк). |
| `MovieDesktop`/`MovieMobile` | Просто CSS (после переноса `MovieMobile` на общие `ui/tabs/*`) | Нет | Расхождение — не бизнес-логика, а то, что `MovieMobile.tsx` (399 строк, подтверждено чтением) инлайнит собственную копию вёрстки табов вместо переиспользования `ui/tabs/*`, которые уже использует `MovieDesktop.tsx` (49 строк). После переноса на общие табы остаётся только раскладка/CSS. `LikedState` — общий тип не по месту (в `MovieDesktop/types.ts`), переносится в нейтральное `ui/types.ts`, не JS-развилка. |
| `SearchDesktop`/`SearchMobile` (+ `SearchSidebar` vs bottom-sheet фильтры, `Pagination`/`MobilePagination`) | Разное поведение (фильтры) + просто CSS (результаты/пагинация) | Да — `filtersOpen`-стейт bottom sheet остаётся точечной JS-развилкой внутри объединённого `Search` | `SearchSidebar` (always-visible aside) и bottom-sheet (`BottomSheet`-портал, свой `open`/`close` стейт, кнопка-триггер) — разные UX-паттерны, не CSS-варианты одного дерева; подтверждено — `SearchMobile.tsx` держит `const [filtersOpen, setFiltersOpen] = useState(false)` (строка 193) и рендерит `<BottomSheet>` (строка 297), которых у `SearchSidebar` нет вовсе. `Pagination`/`MobilePagination` — оба уже используют общие `buildPageRange`/`clampPage`, различие только JSX/CSS, сводится в один компонент с CSS-режимами. `GenreSelector`/`ActiveFilterChips`'s `compact` проп — см. чек-бокс ниже, отдельная развилка того же семейства. |

**Кандидаты на точечный `useViewport()` после Task 11** (полный список, с обоснованием — критерий: CSS media-фичи `hover`/`pointer` не могут выразить нужное, либо требуется реально не монтировать/размонтировать тяжёлый или с сайд-эффектами узел, а не просто скрыть):

1. **Навигационный chrome** (Task 6) — выбор между `Header`/`variant='search'` ⌘K-листенером и `MobileHeader`+`BottomNav`; обоснование — `Header`'s безусловный `?q`-debounce-эффект (не гейтится `variant`, см. `Header.tsx:84-124`) продолжит писать/стирать `?q` в URL, если скрытый `Header` остаётся смонтированным под `display: none`; нужна JS-точка, которая реально не монтирует неактивный вариант (или добавляет гейт на сам эффект — оба варианта решаются в Task 6, но развилка в любом случае JS, не CSS).
2. **`ArrowBtn`/hover-поведение `MovieRail`** (Task 7) — **не остаётся** JS-развилкой: `@media (hover: hover) and (pointer: fine)` полностью выражает нужное поведение (стрелки видны только устройствам с мышью, независимо от ширины экрана). Изначально предполагался как кандидат в Context/Overview, но по факту анализа контракта (Task 1) это CSS, а не JS-развилка — попадает в первую категорию таблицы выше, а не в этот список.
3. **`SearchSidebar` vs bottom-sheet фильтры `Search`** (Task 10) — оба варианта фильтров смонтированы условно через JS (не просто `display: none`), потому что bottom-sheet — портал со своим open/close-состоянием и триггер-кнопкой, а sidebar — always-visible aside; сведение в одно CSS-дерево потеряло бы разницу в UX (модальность bottom sheet). Тот же принцип, что chrome в Task 6: развилка остаётся в одной точке (`Search`), а не разбросана по `SearchDesktop.tsx`/`SearchMobile.tsx`.

**Итоговый вывод:** из трёх кандидатов, изначально перечисленных в Context/Overview для рассмотрения в Task 1, подтверждаются как реальные JS-развилки два — навигационный chrome (Task 6) и sidebar/bottom-sheet фильтры (Task 10); третий (`ArrowBtn`/hover в `movie-rail`, Task 7) при более внимательном разборе контракта сводится к чистому CSS через `hover`/`pointer` media-фичи и не требует `useViewport()`. Итоговый ожидаемый список потребителей `useViewport()` после Task 11 — не шесть `*Page.tsx`, а максимум две точки: одна в chrome-решении Task 6, одна в `Search`-фильтрах Task 10 (обе — внутри объединённых компонентов, не на уровне `*Page.tsx`).

**`compact` проп `GenreSelector`/`ActiveFilterChips` (`@features/catalog-filter/ui`) — решение по Task 1:** оба компонента подтверждены (чтением `GenreSelector.tsx`/`GenreSelector.module.css`/`ActiveFilterChips.tsx`) как зависящие от инварианта "рендерится только один вариант за раз", который сейчас гарантирует `useViewport`-ветвление в `SearchDesktop`/`SearchMobile`. `GenreSelector.tsx`'s докблок (строка 17) и `.module.css`'s комментарий (строка 55) явно ссылаются на `useViewport` как на источник этой гарантии; `ActiveFilterChips`'s `compact` (строка 16, чек `if (compact)` на строке 18) при `true` рендерит полностью другое DOM-поддерево (`chipCompact`/`chipCompactRemove`), не просто другой CSS-класс. Решение: **проп сохраняется как явный JS-параметр, управляемый вызывающей стороной** (единым `Search` из Task 10), а не заменяется на `@media` — потому что после объединения `SearchDesktop`/`SearchMobile` в `Search` (Task 10) sidebar- и bottom-sheet-варианты фильтров всё ещё могут технически сосуществовать в одном DOM-дереве (см. п. 3 списка кандидатов выше), и `compact` должен продолжать явно приходить от того, какой из двух вариантов фильтров сейчас активен, а не выводиться из ширины экрана. Докблок `GenreSelector` переписывается в Task 10 под новую формулировку инварианта (не "рендерится только на одном брейкпоинте", а "рендерится только в одном из двух активных вариантов фильтров одновременно"), но сам механизм (явный проп, не `@media`) не меняется.

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

- [x] Пройтись по всем шести `*Page.tsx` (`favorites`, `home`, `movie`, `popular`,
      `recommendations`, `search`) и зафиксировать для каждой пары `*Desktop`/`*Mobile` — таблица
      "просто CSS" vs "разное поведение" (использовать разбор из Context выше как стартовую точку)
      прямо в этом файле плана. Подтверждено чтением исходников: все шесть `*Page.tsx` вызывают
      `useViewport()` по идентичному паттерну (`grep -rn "useViewport(" src` — ровно шесть
      совпадений в `*Page.tsx` + сам хук, никаких дополнительных вызовов не нашлось); таблица
      заполнена в разделе Audit выше.
- [x] Явно перечислить кандидатов на сохранение `useViewport()` как точечного JS-форка
      (навигационный chrome — Task 6; `ArrowBtn`/hover-поведение `movie-rail` — Task 7;
      sidebar/bottom-sheet фильтры `Search` — Task 10) и критерий, по которому кандидат считается
      оправданным (CSS media-фичи типа `hover`/`pointer` не могут выразить нужное поведение, либо
      нужно условно не монтировать тяжёлый узел, а не просто скрыть). Список и критерий — в
      разделе Audit выше; по факту разбора кандидат №2 (`ArrowBtn`/`movie-rail`) **не подтверждён**
      как JS-развилка — сводится к `@media (hover: hover) and (pointer: fine)`, чистый CSS.
      Подтверждены как реальные JS-развилки только chrome (Task 6) и sidebar/bottom-sheet (Task 10).
- [x] Задокументировать зависимость `GenreSelector`'s **и** `ActiveFilterChips`'s `compact` пропа
      (оба — `@features/catalog-filter/ui`) от текущего "рендерится только один вариант за раз"
      инварианта (см. Context) — решение (сохранить проп, управляемый явным JS-выбором в Task 10,
      или заменить на `@media`) фиксируется здесь и
      применяется в Task 10. Решение: проп сохраняется как явный JS-параметр (не `@media`) — см.
      раздел Audit выше для полного обоснования.
- [x] Зафиксировать итоговый список файлов, тестов не пишем (это аудит/документ, не код) — но
      прогнать `grep -rn "useViewport(" src` (вызовы, не текстовые упоминания — см. пункт выше про
      `GenreSelector`) после Task 11 и свериться с этим списком (перепроверка, не отдельный тест).
      Baseline на момент Task 1 зафиксирован: шесть вызовов в `favorites/FavoritesPage.tsx`,
      `home/HomePage.tsx`, `movie/MoviePage.tsx`, `popular/PopularPage.tsx`,
      `recommendations/RecommendationsPage.tsx`, `search/SearchPage.tsx` (плюс определение хука);
      `GenreSelector.tsx`/`.module.css` матчатся только текстовым упоминанием в докблоке/комментарии,
      не вызовом. Сама сверка запускается после Task 11, не в этой задаче.

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

- [x] Принять конкретное решение по слиянию разметки (не "CSS добавляет `.actions`" — CSS не может
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
- [x] Решить ещё два расхождения `Card`/`MobileCard`, помимо `.actions`: `Poster`'s `showLabel`
      (`Card` — `showLabel={!movie.poster}`, `MobileCard` — всегда `showLabel={false}`) и
      `.typeBadge` (рендерит только `Card`) — оба переносятся как есть в объединённый компонент
      (мобильная база наследует `Card`'s условие `showLabel`, `.typeBadge` остаётся decorative-extra
      того же типа, что `Rate`/`Add`/`Eye`, скрываемый по тому же `@media`-правилу), либо
      обосновывается другое решение — зафиксировать явно, не оставлять на "как получится по ходу
      слияния".
- [x] Сохранить оба accessibility-паттерна DOM-порядка (title перед постером, восстановление
      визуального порядка через CSS `order`) — не регрессировать существующий Tab-порядок ни в
      одном брейкпоинте.
- [x] Обновить шесть call sites из Files-блока: заменить импорт `MobileCard` на `Card` (ни один из
      них не передаёт `variant` — проп остаётся десктопной спецификой, см. первый чек-бокс задачи, эти
      шесть вызовов просто не указывают его, как и раньше). Отдельно проверить, что
      `MovieRailMobile`'s `.scrollItem`-обёртка вокруг карточки не конфликтует с новым CSS `Card`.
      Прогнать тесты этих шести файлов (`FavoritesMobile.test.tsx`, `PopularMobile.test.tsx`,
      `RecommendationsMobile.test.tsx`, `SearchMobile.test.tsx`, `MovieMobile.test.tsx`,
      `MovieRailMobile.test.tsx`) — запросы по названию/роли должны пережить замену компонента, но
      это не гарантировано автоматически.
- [x] Влить кейсы `MobileCard.test.tsx` (149 строк) в `Card.test.tsx` — не терять покрытие
      мобильного набора кнопок/бейджей при удалении файла.
- [x] Написать/обновить тесты: рендер с `isFavorite`/`onToggleFavorite` — проверять, что кнопка
      избранного **одна** (`getAllByRole('button', { name: /favorites/i })` возвращает ровно один
      элемент — см. Testing Strategy про jsdom и media queries), рендер `rankBadge`.
- [x] Написать тесты для error/edge cases: постер отсутствует (`showLabel`), `rankBadge` не передан.
- [x] `make test` — все зелёные до следующей задачи.

### Task 3: Слияние `FavoritesDesktop`/`FavoritesMobile` в единый `Favorites`

**Files:**

- Create: `src/pages/favorites/ui/Favorites/Favorites.tsx`, `Favorites.module.css`, `index.tsx`
- Modify: `src/pages/favorites/FavoritesPage.tsx` (убрать `useViewport`, рендерить `<Favorites />`)
- Delete: `src/pages/favorites/ui/FavoritesDesktop/`, `src/pages/favorites/ui/FavoritesMobile/`
- Create: `src/pages/favorites/ui/Favorites/Favorites.test.tsx` (объединяет актуальные кейсы из
  `FavoritesDesktop.test.tsx`, `FavoritesDesktop.retry.test.tsx`, `FavoritesMobile.test.tsx`)

- [x] Свести `FavoritesDesktop`/`FavoritesMobile` в один компонент: сетка карточек (`grid`) с
      `Card` (после Task 2 это уже один компонент вместо `Card`/`MobileCard`), число колонок —
      через CSS grid `auto-fill`/`minmax` вместо разных `SKELETON_COUNT`/`grid` разметок.
      Реализовано в `src/pages/favorites/ui/Favorites/{Favorites.tsx, Favorites.module.css}` —
      единый `SKELETON_COUNT = 8`, единая сетка `.grid { grid-template-columns: repeat(auto-fill,
      minmax(140px, 1fr)) }` с mobile-first базой и `@media (min-width: 720px)`-оверрайдом
      (`minmax(260px, 1fr)`, больший `gap`/паддинги), вместо двух раздельных
      `grid-template-columns: repeat(2, 1fr)` (мобильный, `SKELETON_COUNT=6`) /
      `repeat(4, 1fr)` (десктоп, `SKELETON_COUNT=8`).
- [x] Навигационный chrome (`Header` vs `MobileHeader`+`BottomNav`) — **выбран вариант "временное
      `useViewport`-ветвление внутри `Favorites`"** (Task 6 в этой сессии ещё не выполнялся, идёт
      после Task 3-5 по плану): `Favorites` вызывает `useViewport()` и рендерит
      `isMobile ? <MobileHeader title='Favorites' /> : <Header activeNav='favorites' />`,
      аналогично `{isMobile && <BottomNav active='lists' />}` внизу дерева — тот же выбор, что
      раньше делал `FavoritesPage.tsx`, просто сведён в один компонент вместо рендера двух разных
      компонентов страницы.
- [x] Перенести `EmptyState`/`AsyncBoundary`/retry-логику (`onRetry={() =>
      getMoviesByIds.invalidate(ids)}`) без изменений в поведении — перенесено дословно в
      `Favorites.tsx` (тот же `FavoritesSkeletonGrid`/`FavoritesGrid`/`AsyncBoundary` каркас, что
      был в обоих исходных файлах).
- [x] Слить и адаптировать тесты трёх исходных файлов под новый `Favorites` (skeleton, empty state,
      retry, рендер карточек) — успешные и ошибочные сценарии. Реализовано как **два** тестовых
      файла (не один) — `Favorites.test.tsx` (MSW-based кейсы: пустой список, непустой список,
      частичный 404, полный 404, полный 5xx, снятие с избранного, плюс два новых теста на
      `useViewport`-ветвление chrome по ширине окна) и `Favorites.retry.test.tsx`
      (`vi.mock('@entities/movie')`-based invalidate→refetch кейс из
      `FavoritesDesktop.retry.test.tsx`) — по той же причине, по которой это было два файла в
      исходном коде: `vi.mock` в retry-тесте подменяет `getMoviesByIds` для всего файла, смешивать
      это с MSW-сценариями в одном файле означало бы либо терять реальные сетевые кейсы, либо
      городить `vi.doMock`/`vi.resetModules` внутри одного теста. Files-блок этой задачи называл
      только один файл — отклонение зафиксировано здесь явно.
- [x] `make test` — все зелёные до следующей задачи. `make test`: 74 файла / 613 тестов зелёные;
      `make lint`, `make typecheck`, `make build` — тоже зелёные (см. Testing Strategy — билд
      прогоняется дополнительно, так как задача трогает `*Page.tsx`).

### Task 4: Слияние `PopularDesktop`/`PopularMobile` в единый `Popular`

**Files:**

- Create: `src/pages/popular/ui/Popular/Popular.tsx`, `Popular.module.css`, `index.tsx`
- Modify: `src/pages/popular/PopularPage.tsx`
- Delete: `src/pages/popular/ui/PopularDesktop/`, `src/pages/popular/ui/PopularMobile/`
- Create: `src/pages/popular/ui/Popular/Popular.test.tsx`

- [x] Прочитать текущие `PopularDesktop.tsx`/`PopularMobile.tsx` перед слиянием (следующий шаг
      этой задачи, не сделан на этапе планирования) — свести по тому же паттерну, что Task 3
      (`Card`+`rankBadge`, grid раскладка через CSS). Оба файла прочитаны целиком: расхождения
      подтверждены — только chrome (`Header` vs `MobileHeader`+`BottomNav`), заголовочная
      обёртка (`.main`/`h1.heading` у десктопа vs отдельный `.titleWrap`/`h1.title` у мобильного,
      сведены в единую `main`+`heading` разметку по образцу `Favorites`), `SKELETON_COUNT`
      (10 десктоп / 6 мобильный — взято десктопное значение 10, тот же выбор в пользу большего
      значения, что был сделан для `Favorites` в Task 3), grid-колонки (`repeat(4, 1fr)` десктоп /
      `repeat(2, 1fr)` мобильный — заменены на общий `repeat(auto-fill, minmax(...))` с
      `min-width: 720px`-оверрайдом) и `variant='grid'` у `Card` (передавался только десктопом —
      после Task 2 это просто гейт `Eye`-кнопки через `@media (hover: none)`, передаётся
      безусловно, как в `Favorites`). Бизнес-логика (`usePopularMovies`, `useFavorites`,
      `invalidatePopularMovies`, обработка пустого списка) идентична в обоих файлах.
- [x] Слить раскладку rank-бейджей (`PopularBadge`) — они уже параметризуются через `rankBadge`
      проп `Card`/`MobileCard` (см. AGENTS.md "rankBadge slot placement"); после Task 2 это один
      слот в едином `Card` — сверить, что позиционирование бейджа не регрессирует ни в одном
      брейкпоинте. Реализовано в `src/pages/popular/ui/Popular/Popular.tsx` — `rankBadge`
      передаётся в `Card` безусловно (не завязано на брейкпоинт), позиционирование целиком внутри
      объединённого `Card` (Task 2), проверено тестами на обеих ширинах (см. ниже).
- [x] Навигационный chrome — тот же принцип, что в Task 3: временное `useViewport`-ветвление
      внутри `Popular` (`isMobile ? <MobileHeader title='Popular' /> : <Header
      activeNav='popular' />`, `{isMobile && <BottomNav active='popular' />}`), решение задаётся
      Task 6 и здесь не пересматривается — тот же выбор, что и в `Favorites` (Task 3).
- [x] Слить тесты `PopularDesktop.test.tsx`/`PopularMobile.test.tsx` — объединены в один
      `src/pages/popular/ui/Popular/Popular.test.tsx`: успешная загрузка с rank-бейджами (обе
      ширины), пустой список → `EmptyState`, полный отказ → `AsyncBoundary`-фолбэк с реальным
      Retry-инвалидированием кэша (`invalidatePopularMovies`), плюс два новых теста на
      `useViewport`-ветвление chrome по ширине окна (по образцу `Favorites.test.tsx`). Отклонение
      от паттерна `Favorites.test.tsx`: пункт навигации "Popular" одинаково называется и в
      `Header`, и в `BottomNav` (в отличие от "Favorites"/"Lists"), поэтому chrome-тесты
      различают варианты по другим, уникальным для каждого chrome пунктам ("Favorites" есть
      только в `Header.navItems`, "Lists" — только в `BottomNav.items") — задокументировано
      комментарием в тесте.
- [x] `make test` — все зелёные до следующей задачи. `make test`: 73 файла / 613 тестов зелёные
      (три исходных файла — `PopularDesktop.tsx`/`.test.tsx`, `PopularMobile.tsx`/`.test.tsx` —
      заменены на два: `Popular.tsx`, `Popular.test.tsx`); `make lint`, `make typecheck`,
      `make build` — тоже зелёные.

### Task 5: Слияние `RecommendationsDesktop`/`RecommendationsMobile` в единый `Recommendations`

**Files:**

- Create: `src/pages/recommendations/ui/Recommendations/Recommendations.tsx`, `.module.css`, `index.tsx`
- Modify: `src/pages/recommendations/RecommendationsPage.tsx`
- Delete: `src/pages/recommendations/ui/RecommendationsDesktop/`, `src/pages/recommendations/ui/RecommendationsMobile/`
- Create: `src/pages/recommendations/ui/Recommendations/Recommendations.test.tsx`
- Modify: `src/pages/recommendations/RecommendationsPage.test.tsx` (сейчас мокает/использует
  `useViewport` — обновить под убранное ветвление)

- [x] Слить `RecommendationsDesktop`/`RecommendationsMobile` (grid карточек + empty-state
      "добавь в избранное") по паттерну Task 3/4. `model/useRecommendedMovies.ts` не трогать —
      уже общий page-слой хук. Реализовано в
      `src/pages/recommendations/ui/Recommendations/{Recommendations.tsx, Recommendations.module.css}`
      — оба исходных файла прочитаны целиком, различия подтверждены только в chrome (`Header` vs
      `MobileHeader`+`BottomNav`) и grid-колонках (`repeat(4, 1fr)` десктоп /
      `repeat(2, 1fr)` мобильный, сведены в общий `repeat(auto-fill, minmax(...))` с
      `min-width: 720px`-оверрайдом, тот же паттерн, что `Favorites.module.css`/
      `Popular.module.css`); `SKELETON_COUNT` (8 десктоп / 6 мобильный — взято десктопное
      значение 8, тот же выбор в пользу большего значения, что уже делался для `Favorites`/
      `Popular`); `variant='grid'` у `Card` передавался только десктопом — после Task 2 это гейт
      `Eye`-кнопки через `@media (hover: none)`, передаётся безусловно, как в `Favorites`/
      `Popular`. Бизнес-логика (`useRecommendedMovies`, `invalidateRecommendations`,
      `useFavorites().ids` для гейта "нет избранного" vs каталог не дал совпадений vs все id
      404-нулись) идентична в обоих исходных файлах и перенесена без изменений;
      `model/useRecommendedMovies.ts` не тронут.
- [x] Навигационный chrome — тот же принцип, что в Task 3/4: временное `useViewport`-ветвление
      внутри `Recommendations` (`isMobile ? <MobileHeader title='Recommended for you' /> :
      <Header activeNav='recommendations' />`, `{isMobile && <BottomNav
      active='recommendations' />}`), решение задаётся Task 6 и здесь не пересматривается.
- [x] Слить тесты `RecommendationsDesktop.test.tsx`/`RecommendationsMobile.test.tsx` в один
      `src/pages/recommendations/ui/Recommendations/Recommendations.test.tsx`: пустое избранное,
      успешный подбор с проверкой реального запроса (`id`/`genres.name`/`rating.kp`/`sortField`/
      `sortType`), все id 404-нулись → `null` → "не удалось загрузить избранное", каталог не дал
      совпадений → `[]` → "Nothing to recommend yet", полный отказ каталога → `AsyncBoundary`
      Retry с реальным переинвалидированием кэша, плюс два новых теста на `useViewport`-ветвление
      chrome по ширине окна (по образцу `Popular.test.tsx`, а не `Favorites.test.tsx` — пункт
      навигации "Picks" одинаково называется и в `Header`, и в `BottomNav`, различаем варианты по
      уникальным пунктам "Favorites"/"Lists", тот же приём, что уже задокументирован в
      `Popular.test.tsx`). `RecommendationsPage.test.tsx` переписан: убран мок `useViewport` и
      сам выбор Desktop/Mobile-стабов (развилки больше нет — `RecommendationsPage` теперь
      тривиальная обёртка), заменён на один смоук-тест, мокающий `./ui/Recommendations` и
      проверяющий факт делегирования (page-level поведение, не переиспытывание логики
      `Recommendations`, которая уже покрыта `Recommendations.test.tsx`).
- [x] `make test` — все зелёные до следующей задачи. `make test`: 72 файла / 610 тестов зелёные
      (четыре исходных файла — `RecommendationsDesktop.tsx`/`.test.tsx`,
      `RecommendationsMobile.tsx`/`.test.tsx` — заменены на два: `Recommendations.tsx`,
      `Recommendations.test.tsx`); `make lint`, `make typecheck`, `make build` — тоже зелёные.

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

- [x] **Сначала оценить layout-route** (`<Outlet/>` в `src/app/`, обёртывающий все роуты в
      `router.tsx`) как основной вариант, а не сразу проектировать `SiteChrome`: он не создаёт
      новый слайс, не требует кросс-импорта `@widgets/header`+`@widgets/mobile-chrome` из третьего
      виджета на том же слое (что иначе нарушает границы FSD — оба сейчас независимы друг от
      друга), убирает chrome из всех шести страниц полностью, а не переносит выбор в одну точку, и
      позволяет вывести `activeNav` из `useLocation()` вместо прокидывания пропа с каждой страницы.
      Записать здесь явно, почему layout-route не подходит, если решение — всё же `SiteChrome`
      (вариант B) внутри `widgets/`.
      **Принят вариант A (layout-route).** Конкретного блокера не нашлось: `src/app/layouts/
      AppLayout.tsx` — обычный React-компонент с `<Outlet/>`, живёт в `app/` (не в `widgets/`),
      импортирует `@widgets/header` и `@widgets/mobile-chrome` напрямую — это не кросс-импорт
      между виджетами (что нарушало бы `pages → widgets → features → entities → shared`), а
      обычный `app → widgets` импорт, разрешённый в любом направлении сверху вниз. `SiteChrome`
      (вариант B) не потребовался.
- [x] Если принят вариант A — сразу в этой задаче убрать прямой рендер `Header`/`MobileHeader`+
      `BottomNav` из всех шести исходных `*Desktop`/`*Mobile` файлов (см. Files-блок выше), а не
      только из трёх уже слитых в Task 3-5, и вывести `Header`'s `variant='search'` из текущего
      роута (`useLocation()`), а не из пропа — иначе на `/`, `/movie/:id` и `/search` в дереве
      будет по два chrome одновременно вплоть до Task 8-10.
      **Осознанное отклонение от буквального текста Files-блока — зафиксировано как принятое
      решение, а не обнаружено постфактум.** `router.tsx` подключает `AppLayout` только над тремя
      уже слитыми роутами — `/favorites`, `/popular`, `/recommendations` (Task 3-5). `/`,
      `/movie/:id`, `/search` остаются top-level роутами вне `AppLayout` и **не** трогаются в этой
      задаче: `HomeDesktop`/`HomeMobile`, `MovieDesktop`/`MovieMobile`, `SearchDesktop`/
      `SearchMobile` по-прежнему рендерят свой `Header`/`MobileHeader`+`BottomNav` инлайн, как и
      раньше. Причина — сам Files-блок предусматривает эту развилку явно ("если вариант A
      откладывается до завершения Task 10, явно зафиксировать это здесь"): если бы все шесть
      роутов сейчас подключились под `AppLayout`, три ещё не слитые страницы получили бы двойной
      chrome одновременно в DOM (jsdom это не отфильтрует, реальный браузер — тоже, до тех пор,
      пока эти три страницы не перестанут рендерить chrome сами) — то есть реальный визуальный
      регресс, а не только шум в тестах. Tasks 8/9/10 каждый добавит свою запись в
      `AppLayout.tsx`'s `ROUTE_CHROME`, переместит свой роут под `AppLayout` в `router.tsx` и
      уберёт инлайн-рендер chrome из своей страницы — как часть собственного слияния Desktop/
      Mobile, а не заранее здесь. Так как ни один из трёх подключённых сейчас роутов не
      использует `variant='search'`, вопрос "откуда `Header` берёт `variant='search'`" не встаёт в
      этой задаче — он входит в объём Task 10 вместе с переносом `/search`.
- [x] Определить: `Header` безусловно (независимо от `variant`) вешает debounce-запись `?q` в URL
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
      **Решение: `Header` размонтирован через `useViewport()` в `AppLayout`, а не скрыт CSS-ом.**
      `AppLayout` рендерит `isMobile ? <MobileHeader .../> : <Header .../>` — ровно один из двух
      вариантов оказывается в дереве, второй не монтируется вовсе. Это то же самое точечное
      использование `useViewport()`, которое уже было в `Favorites`/`Popular`/`Recommendations` до
      этой задачи (Task 3-5) — Task 6 не меняет *механизм* (по-прежнему условный рендер, а не
      `display: none`), а переносит его в одну общую точку вместо трёх копий. Благодаря этому
      вопрос "как погасить `?q`-эффект у скрытого `Header`" снимается сам собой: раз `Header`
      физически не монтирован на мобильном брейкпоинте, его эффекты (включая безусловный
      `?q`-debounce на строках 84-124) не запускаются вовсе — Task 6 не потребовалось трогать
      `Header.tsx` для этого случая. Правка самого `Header.tsx` (явный гейт на `?q`-эффект по
      аналогии с ⌘K-листенером) осталась бы нужна только при выборе "оба смонтированы, видимость
      через CSS" — от этого варианта решили отказаться (см. следующий пункт).
- [x] Если остаётся вариант "оба смонтированы, видимость через CSS" — использовать именно
      `display: none` (не `visibility: hidden`/off-screen позиционирование), чтобы скрытый вариант
      выпадал из a11y-дерева и не давал дублирующихся `nav`/`banner` landmarks для скринридеров.
      **Не применимо — этот вариант не выбран.** `AppLayout` не монтирует оба варианта
      одновременно (см. пункт выше), так что вопрос `display: none` vs `visibility: hidden` не
      возникает: скрытый вариант просто не существует в дереве, что даёт тот же (и более сильный)
      результат для a11y-дерева, чем `display: none` — не просто "выпадает из a11y-дерева", а не
      создаёт лишних DOM-узлов и side-эффектов вовсе.
- [x] Свести соответствие ключей `activeNav` (`Header`: `home | movie | series | anime | favorites
      | popular | recommendations`) и `active` (`BottomNav`: `home | search | lists | popular |
      recommendations | profile`) — множества пересекаются частично (`favorites`↔`lists` разные
      имена, `movie`/`series`/`anime` нет аналога в `BottomNav`, `search`/`profile` нет аналога в
      `Header`). Не "приводить к одному набору ключей" (невозможно без переименования одного из
      компонентов) — завести явную таблицу-маппинг `выбранный-ключ → {activeNav?, active?}` с
      понятным поведением для ключей без пары в одном из компонентов.
      **Таблица-маппинг (задокументирована докблоком `AppLayout.tsx` и здесь):**

      | Ключ | `Header.activeNav` | `BottomNav.active` |
      | --- | --- | --- |
      | home | `'home'` | `'home'` |
      | movie / series / anime | тот же ключ | нет соответствия — `BottomNav` не умеет |
      | favorites | `'favorites'` | `'lists'` (разные имена одного пункта) |
      | popular | `'popular'` | `'popular'` |
      | recommendations | `'recommendations'` | `'recommendations'` |
      | search | нет соответствия — `Header` не умеет (это сам `variant='search'`, не nav pill) | `'search'` |
      | profile | нет соответствия — `Header` не умеет (нет profile-пункта) | `'profile'` |

      Реализовано как `ROUTE_CHROME: Record<string, { activeNav, active, title }>` в
      `AppLayout.tsx`, ключ — `pathname`, а не абстрактный "выбранный ключ" — так как для трёх
      роутов, подключённых сейчас, `pathname` и логический ключ навигации совпадают
      1-в-1 (`/favorites` → `favorites`, и т.д.). Строки таблицы для `movie`/`search`/`profile`
      пока не имеют записи в `ROUTE_CHROME` (эти роуты не подключены под `AppLayout` — см. пункт
      выше) — таблица здесь задокументирована полностью на будущее (Task 9/10), а не только для
      уже реализованных трёх строк.
- [x] Под вариантом A решить судьбу пропов `MobileHeader`, которые сейчас передаются каждой
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
      **Реализовано только для текущих трёх роутов** (`title` per route: `'Favorites'`,
      `'Popular'`, `'Recommended for you'` — точное соответствие тому, что раньше передавали
      `FavoritesMobile.tsx`/`PopularMobile.tsx`/`RecommendationsMobile.tsx`) через
      `ROUTE_CHROME`-карту в `AppLayout.tsx`, ключ — `pathname` (`useLocation().pathname`).
      `MovieMobile`'s `onBack`/`showSearch`/`rightAction` и `BottomNav`'s `active='search'` на
      `/movie/:id`, а также `Header`'s `?type`-driven `activeNav` на `/search` **осознанно не
      реализованы сейчас** — они требуют либо расширения `RouteChromeConfig` необязательными
      `onBack`/`showSearch`/`rightAction` слотами (Task 9), либо доступа к `useSearchParams()` в
      дополнение к `useLocation().pathname` (Task 10), а не просто добавления `title` в текущую
      карту. Это прямо задокументировано в докблоке `ROUTE_CHROME` в `AppLayout.tsx` как задел на
      Task 9/10 — не забытый пробел, а явно отложенное решение, соответствующее тому, что Home/
      Movie/Search вообще не подключены под `AppLayout` в этой задаче (см. второй пункт выше).
- [x] Переключить `Favorites`/`Popular`/`Recommendations` (уже слитые в Task 3-5) на выбранное
      решение, убрать их временное `useViewport`-ветвление chrome.
      Сделано: `Favorites.tsx`/`Popular.tsx`/`Recommendations.tsx` больше не импортируют
      `useViewport`, `Header`, `MobileHeader`, `BottomNav` — они рендерят только свой контент
      (`<main>` с сеткой карточек), chrome добавляется снаружи через `AppLayout` в `router.tsx`.
- [x] Решить владение `Footer` (сейчас рендерится только в `HomeDesktop`, ни в одной другой
      странице/варианте) — не в этой задаче принимать финальное решение (Footer относится к
      контенту `Home`, не к nav chrome), но зафиксировать здесь, что `SiteChrome`/layout-route его
      **не** включает, чтобы Task 8 не унаследовал его "случайно" через общий chrome-компонент.
      Подтверждено: `AppLayout.tsx` рендерит только `Header`/`MobileHeader`+`Outlet`+`BottomNav` —
      никакого `Footer`. Финальное решение по владению `Footer` остаётся за Task 8 (`Home`), как и
      было зафиксировано на этапе планирования.
- [x] Написать тесты: корректный `activeNav`/`active` доходит до обоих вариантов chrome; при
      `variant='search'` рендерится search-специфика `Header`; если оба варианта в одном DOM-дереве
      (jsdom не применяет CSS, см. Testing Strategy) — тесты используют `within()`/`getAllByRole`
      с проверкой количества, а не `getByRole`.
      Написано в `src/app/layouts/AppLayout.test.tsx` (8 тестов, MemoryRouter + `Routes`/`Route`,
      повторяющие структуру `router.tsx`): для каждого из трёх роутов (`/favorites`, `/popular`,
      `/recommendations`) — десктопный тест (`Header` с правильным `activeNav`-пилюлей активной,
      `BottomNav`-специфичный пункт "Lists" отсутствует) и мобильный тест (`MobileHeader` с
      правильным `title`, `BottomNav` с правильным `active`-пунктом подсвеченным), плюс два теста
      на то, что контент `<Outlet/>` рендерится независимо от chrome-варианта. `variant='search'`
      не тестируется здесь — ни один из трёх текущих роутов его не использует (см. выше), тест на
      него появится вместе с `/search` в Task 10. Поскольку `AppLayout` монтирует только один
      chrome-вариант за раз (не оба одновременно под CSS), `within()`/`getAllByRole`-с-count в
      строгом смысле не понадобились для различения chrome-вариантов друг от друга — но
      `within(banner)` всё же используется там, где текст (`title` MobileHeader) совпадает с
      текстом другого элемента в дереве (`BottomNav`'s подпись "Popular"), чтобы не наткнуться на
      "found multiple elements" от `getByText` без скоупинга.
- [x] `make test` — все зелёные до следующей задачи. `make test`: 73 файла / 612 тестов зелёные
      (`AppLayout.test.tsx` добавлен, 8 новых тестов; 6 устаревших chrome-тестов, дублировавших
      то же самое внутри `Favorites.test.tsx`/`Popular.test.tsx`/`Recommendations.test.tsx`, —
      удалены как часть переноса ответственности за chrome в `AppLayout`); `make lint`,
      `make typecheck`, `make build` — тоже зелёные.

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

- [x] Свести `MovieRailDesktop`/`MovieRailMobile` в один компонент: базовая раскладка — нативный
      horizontal-scroll (как у `MovieRailMobile`); `ArrowBtn` рендерится всегда, видимость
      управляется `@media (hover: hover) and (pointer: fine)` (десктоп с мышью) вместо JS
      `isMobile`-проверки — устройство с тачскрином не увидит стрелки независимо от ширины экрана,
      что даже точнее исходного намерения, чем брейкпоинт по ширине. Реализовано в
      `src/widgets/movie-rail/ui/MovieRail/{MovieRail.tsx, MovieRail.module.css}`: CSS-модуль
      написан mobile-first — база (`.scroll` с `grid-auto-columns: 140px`, `scroll-snap-type: x
      mandatory`, `.header` с горизонтальным паддингом 20px) один-в-один повторяет бывший
      `MovieRailMobile.module.css`, десктопный `@media (min-width: 720px)`-блок переопределяет те
      же свойства значениями бывшего `MovieRailDesktop.module.css` (`grid-auto-columns: 200px`,
      без snap, без горизонтального паддинга, `align-items: flex-end`). `.arrows { display: none }`
      по умолчанию, `display: flex` только внутри `@media (hover: hover) and (pointer: fine)` —
      `ArrowBtn` (перенесён как есть в `MovieRail/ArrowBtn/`) всегда в DOM, видимость чисто CSS.
- [x] Свести пять реальных различий контракта (не только `ArrowBtn`/skeleton), подтверждённых
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
      Все шесть подтверждены в реализации: (1) `href = '/search'` default-параметр, единственная
      `<Link>`-обёртка заголовка используется в обоих брейкпоинтах (CSS решает только типографику);
      (2) `items.length === 0 ? <EmptyState .../> : ...` перенесено дословно, безусловно; (3)
      `type MovieRailProps = { items: (Movie | PopularMovie)[]; ... }` — взят более широкий
      десктопный тип, `rankBadge` строится через `'position' in m ? <PopularBadge .../> :
      undefined`, как было в `MovieRailDesktop`; (4) каждый `<Card>` по-прежнему обёрнут в
      `<div className={s.scrollItem}>` (перенесено из `MovieRailMobile`, не потеряно при слиянии с
      десктопной раскладкой); (5) `MovieRailSkeletonDesktop` перенесён в
      `src/widgets/movie-rail/ui/MovieRail/{MovieRailSkeleton.tsx, MovieRailSkeleton.module.css}`
      под новым именем `MovieRailSkeleton` (суффикс `Desktop` больше не соответствует действительности
      — компонент используется одинаково на обоих брейкпоинтах), экспорт в
      `src/widgets/movie-rail/index.ts` обновлён, call site `HomeDesktop.tsx` переключён на новое
      имя (4 вызова `<AsyncBoundary fallback={<MovieRailSkeleton />} .../>`); (6) `<Card
      variant='compact' .../>` передаётся явно и безусловно в единственном месте рендера карточки
      внутри `MovieRail.tsx` — раньше это делал только `MovieRailDesktop`, `MovieRailMobile` вообще
      не указывал `variant` (получал бы дефолтный `'grid'` после Task 2, то есть регрессию с
      появлением `Eye`-кнопки в рейлах, если бы не был передан явно).
- [x] Обновить все call sites, использующие `MovieRailDesktop`/`MovieRailMobile` напрямую.
      Обновлены все шесть, перечисленные в Files-блоке: `src/pages/home/ui/PersonalRails/PersonalRails.tsx`,
      `src/pages/home/ui/PopularMoviesRail/PopularMoviesRail.tsx`,
      `src/pages/home/ui/TopAnimeRails/TopAnimeRails.tsx`,
      `src/pages/home/ui/TrandingSeriesRail/TrandingSeriesRail.tsx` — импорт `MovieRailDesktop` →
      `MovieRail`, без изменения передаваемых пропов; `src/pages/home/ui/HomeDesktop/HomeDesktop.tsx`
      — импорт `MovieRailSkeletonDesktop` → `MovieRailSkeleton` (4 использования в `AsyncBoundary`
      fallback); `src/pages/home/ui/HomeMobile/HomeMobile.tsx` — импорт `MovieRailMobile` →
      `MovieRail` (временный шаг, `HomeMobile` остаётся отдельным компонентом от `HomeDesktop` до
      Task 8, здесь только меняется импорт рейла, как и предписано Files-блоком). `grep -rn
      "MovieRailDesktop\|MovieRailMobile\|MovieRailSkeletonDesktop" src` после изменений находит
      только два текстовых упоминания в WHY-комментарии `MovieRail.module.css` (объясняет
      происхождение mobile-first/desktop-override блоков), ни одного реального импорта/использования.
- [x] Слить тесты `MovieRailDesktop.test.tsx`/`MovieRailMobile.test.tsx`.
      Слиты в `src/widgets/movie-rail/ui/MovieRail/MovieRail.test.tsx`: все кейсы
      `MovieRailDesktop.test.tsx` перенесены как есть (EmptyState на пустых items, заголовок-ссылка
      на пустых items, рендер карточек, избранное туда-обратно, `PopularMovie[]`/`rankBadge`,
      `href` явный/дефолтный `/search`) плюс единственный содержательный кейс из
      `MovieRailMobile.test.tsx` (клик по сердечку/toggle — идентичен десктопному, дубликат не
      заведён повторно). Добавлены новые тесты, специфичные для слияния: (a) обёртка `.scrollItem`
      вокруг каждой карточки (`container.querySelectorAll('[class*="scrollItem"]')` — проверка
      DOM-структуры, не брейкпоинт-специфичной видимости, см. Testing Strategy про jsdom и media
      queries); (b) ровно 5 кнопок на один элемент рейла с избранным (favorite + Rate + Add + 2
      стрелки скролла, без Eye — подтверждает, что `variant='compact'` реально передаётся, а не
      просто задокументирован); (c) кнопки `Previous`/`Next` всегда в DOM и клик по ним вызывает
      `scrollBy` с ожидаемым `left`/`behavior` (видимость по `hover`/`pointer` — CSS, не
      тестируется в jsdom, см. Testing Strategy).
- [x] `make test` — все зелёные до следующей задачи. `make test`: 72 файла / 614 тестов зелёные
      (`MovieRailDesktop.test.tsx`+`MovieRailMobile.test.tsx` заменены одним `MovieRail.test.tsx`,
      добавившим тесты сверх перенесённых — 614 против прежних 613); `make lint`, `make typecheck`,
      `make build` — тоже зелёные.

### Task 8: Слияние `HomeDesktop`/`HomeMobile` в единый `Home` (+ перевод с `CATALOG` на живые данные)

**Files:**

- Create: `src/pages/home/ui/Home/Home.tsx`, `Home.module.css`, `index.tsx`
- Modify: `src/pages/home/HomePage.tsx`
- Delete: `src/pages/home/ui/HomeDesktop/`, `src/pages/home/ui/HomeMobile/`
- Modify: `src/pages/home/ui/PersonalRails/PersonalRails.tsx` и соседние rail-компоненты, если они
  сейчас параметризованы под `HomeMobile`'s `CATALOG`-путь отдельно от `HomeDesktop`
- Create: `src/pages/home/ui/Home/Home.test.tsx`

- [x] Прочитать `HomeMobile.tsx` полностью (98 строк, не вычитан на этапе планирования) и
      выяснить точный объём контента, который сейчас идёт из `CATALOG` — сопоставить с рейлами,
      которые уже использует `HomeDesktop` (`PersonalRails`, `PopularMoviesRail`, `TopAnimeRails`,
      `TrandingSeriesRail`). Подтверждено: `HomeMobile` рендерил 3 секции карточек из `CATALOG`
      (мок), тогда как `HomeDesktop` уже использовал все четыре живых рейла — полного паритета
      секций не было (мобильная версия не показывала `TopAnimeRails`).
- [x] Перевести весь контент `HomeMobile`'s секций на те же живые хуки/rail-компоненты, что
      `HomeDesktop` — единый `Home.tsx` рендерит все четыре рейла (`PopularMoviesRail`,
      `TrandingSeriesRail`, `TopAnimeRails`, `PersonalRails`) на обоих брейкпоинтах, каждый в своём
      `AsyncBoundary` с собственным `invalidate*`/retry — паритет контента теперь полный
      (мобильная версия получает `TopAnimeRails`, которого раньше не было).
- [x] Добавить MSW-хендлеры для эндпоинтов, которые теперь дёргает мобильный контент в тестах, и
      обернуть мобильный контент в `AsyncBoundary`. Хендлеры добавлены инлайново в
      `Home.test.tsx` (тот же паттерн, что уже используется в остальных тестах репозитория —
      `server.use(http.get(...))` по месту, а не отдельный файл в `src/test/`), покрывают
      `/v1.5/list/popular`, `/v1.5/movie` (new/top-rated/anime варианты по query) — без них
      `onUnhandledRequest: 'error'` валил бы тест. Все 4 рейла обёрнуты в `AsyncBoundary` с
      `MovieRailSkeleton`-фоллбэком — раньше `HomeMobile` не имел `AsyncBoundary` вовсе (роадмап
      1.6 сознательно оставлял её вне скоупа), теперь это исправлено.
- [x] Удалить `CATALOG` (`@entities/movie`) и его экспорт — `src/entities/movie/model/catalog.ts`
      удалён, экспорт убран из `src/entities/movie/index.ts`. Проверено `grep -rn "CATALOG" src`
      после удаления — остаются только не связанные по смыслу совпадения (`CATALOG_ENDPOINT`,
      локальная тестовая константа с URL `/v1.5/movie` в файлах `search`/`recommendations`
      тестов, не имеющая отношения к удалённому моку).
- [x] Свести `HomeDesktop`/`HomeMobile` в единый `Home` (`src/pages/home/ui/Home/{Home.tsx,
      Home.module.css, index.tsx}`), включая `HeroSection` (не потребовал изменений в логике,
      только `HeroSection.module.css` адаптирован под mobile-first раскладку) и chrome-решение
      из Task 6: `Home` больше не вызывает `useViewport()` и не рендерит
      `Header`/`MobileHeader`+`BottomNav` сам — маршрут `/` перемещён под `AppLayout` в
      `src/app/router.tsx`, и `AppLayout`'s `ROUTE_CHROME`-карта (`src/app/layouts/AppLayout.tsx`)
      получила запись `'/'` (`activeNav: 'home'`, `active: 'home'`, без `title` — воспроизводит
      исходное поведение `<MobileHeader />` без пропов в `HomeMobile.tsx`, что даёт логотип +
      search-триггер вместо заголовка страницы).
- [x] Решить владение `Footer` (сейчас только в `HomeDesktop`) — **выбрано: рендерится в едином
      `Home` безусловно, на обоих брейкпоинтах** (не десктоп-специфичный CSS-хайд). Причина:
      Footer — часть контента страницы (не nav chrome, см. решение Task 6 о том, что
      `SiteChrome`/`AppLayout` его не включает), и скрывать его на мобильном не имело смысловой
      причины — только исторический факт, что `HomeMobile` никогда не рендерил `Footer` вовсе.
      `Footer.module.css` адаптирован под mobile-first: одноколоночный стек как база, исходная
      4-колоночная раскладка сохранена как `@media (min-width: 720px)`-оверрайд.
- [x] Обновить `MovieRail` call sites на новый единый компонент из Task 7 — уже было сделано в
      Task 7 (импорт `MovieRailSkeletonDesktop` → `MovieRailSkeleton`, `MovieRailMobile` → единый
      `MovieRail` в тогда ещё раздельных `HomeDesktop.tsx`/`HomeMobile.tsx`); в этой задаче
      дополнительных изменений не потребовалось, только перенос уже-корректных импортов в новый
      `Home.tsx`.
- [x] Слить тесты `HomeDesktop.test.tsx` под новый `Home` (у `HomeMobile` отдельного `.test.tsx`
      не было на момент дискавери — написан новый набор тестов на мобильный контент, которого
      раньше не было в тестах): `Home.test.tsx` (321 строка) покрывает — chrome больше не
      рендерится самим `Home` (делегировано `AppLayout`); `Footer` рендерится безусловно;
      `HeroSection`'s поиск по Enter уводит на `/search?q=...`; retry по каждому из 4 рейлов
      независимо (ошибка одного не влияет на остальные, отдельные `invalidate*`); happy path без
      ошибок — все 4 рейла рендерят данные, `EmptyState`/`ErrorState` отсутствуют.
- [x] `make test` — 619/619 зелёных. `make check` (`format-check` + `lint` + `build`): `lint` и
      `build` зелёные; `format-check` (`oxfmt --check .`) падает на этом самом файле плана
      (`docs/plans/20260827-mobile-first-adaptive-layout.md`) — **но это подтверждённо
      pre-existing и не связано с Task 8**: тот же `oxfmt --check` падает на identичном наборе
      файлов (включая этот файл плана) уже на коммите `132a651` (конец Task 7, до единой строчки
      изменений этой задачи) — `oxfmt --write` для этого конкретного файла к тому же
      **не идемпотентен** (повторный запуск `--write` меняет файл заново, а последующий `--check`
      снова его не принимает — воспроизведено 5 запусков подряд без сходимости), то есть это баг/
      ограничение самого форматтера на данном markdown-файле (широкие таблицы + кириллица + длинные
      inline-code строки), а не то, что можно почистить конкретной правкой контента. Решено
      трактовать `make check` для целей этого плана как `make lint` + `make build` (оба зелёные),
      не блокируясь на pre-existing/не сходящемся `format-check`; вынесение этого в отдельный
      backlog-тикет — вне скоупа этой задачи (см. Development Approach — не тащить несвязанные
      правки в этот план).

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

- [x] Перенести `LikedState` из `src/pages/movie/ui/MovieDesktop/types.ts` в
      `src/pages/movie/ui/types.ts` и обновить импорты в `MovieHero.tsx`/`MovieActions.tsx` — этот
      тип общий (не desktop-специфика, несмотря на текущее расположение), удаление `MovieDesktop/`
      без этого шага ломает сборку обоих файлов. Сделано в указанном порядке (новый файл → правка
      импортов → `rm -rf MovieDesktop/ MovieMobile/`), сборка не ломалась ни на одном шаге.
- [x] Завести `MovieMobile`'s контент на переиспользуемые `ui/tabs/*` компоненты
      (`OverviewTab`/`CastTab`/`DetailsTab`/`MediaTab`) вместо инлайновой копии вёрстки/логики,
      которую сейчас содержит `MovieMobile.tsx` (399 строк против 49 у `MovieDesktop.tsx`) — это
      основной объём работы задачи, делать до попытки свести оболочки в один компонент.
      Подтверждено построчным сравнением: контент `MobileOverview`/`MobileCast`/`MobileMedia`/
      `MobileDetailsContent` (и их локальные `TagPillMini`/`MiniStat`/`MobileActionBtn`) содержательно
      идентичен `OverviewTab`/`CastTab`/`MediaTab`/`DetailsTab` — той же разметке, что уже
      использовал `MovieDesktop`. Инлайновая копия просто отброшена вместе с `MovieMobile.tsx`, а
      единый `Movie` (см. следующий чек-бокс) рендерит общие `ui/tabs/*` на обоих брейкпоинтах.
- [x] Свести `MovieHero`, `MovieTabsNav`, `MovieActions`, `RelatedMovies` (уже общие,
      не парные) в единый `Movie` вместе с chrome-решением из Task 6. Создан
      `src/pages/movie/ui/Movie/{Movie.tsx, Movie.module.css, index.tsx}` — одно JS-дерево
      (`MovieHero` → `MovieTabsNav` → таб-контент → `RelatedMovies`) без `useViewport`-ветвления;
      разница между брейкпоинтами выражена целиком через `@media (min-width: 720px)` в CSS-модулях
      `Movie`/`MovieHero`/`MovieTabsNav`/`RelatedMovies`/`ui/tabs/*/*.module.css` (мобильная база
      без медиа-запроса — новая, десктопная секция внутри `@media` воспроизводит прежние
      `MovieDesktop`-значения дословно). Chrome (Header/MobileHeader+BottomNub) `Movie` больше не
      рендерит сам — этим занимается `AppLayout`.
      **Расширение `AppLayout`/`RouteChromeConfig` (решение по докблоку из Task 6/8):** выбран
      путь "расширить существующий `RouteChromeConfig`", а не отдельный механизм/контекст — три
      новых необязательных поля: `onBack?: boolean` (булев флаг, не сама функция — `AppLayout` сам
      вызывает `useNavigate()` и строит `() => navigate(-1)`, странице не нужно прокидывать
      колбэк), `showSearch?: boolean` (проброс 1-в-1 в `MobileHeader`), `rightAction?: ReactNode`
      (обычный узел, не render-prop/функция — кнопка "поделиться" не зависит ни от `navigate`, ни
      от какого-либо page-local состояния: в исходном `MovieMobile.tsx` она тоже была без
      `onClick`; докблок `AppLayout` из Task 6 предполагал, что `rightAction`, скорее всего,
      понадобится как функция — решение по факту оказалось проще). `rightAction` реализован через
      общий `IconButton`+`ShareIcon` (`@shared/ui`) вместо переноса page-local
      `MovieMobile.module.css`'s `.shareBtn` — CSS-класс всё равно пропадал вместе с файлом, а
      `IconButton` уже даёт визуально эквивалентную (36×36, круглая через `border-radius`)
      иконку-кнопку без нового CSS-модуля. Поскольку `/movie/:id` — динамический сегмент,
      точное сравнение `ROUTE_CHROME[pathname]` (как для `/`/`/favorites`/`/popular`/
      `/recommendations`) не подходит — конфиг для фильма вынесен в отдельную константу
      `MOVIE_CHROME` и подключается через `useMatch('/movie/:id') != null` (матчит по паттерну,
      не по литералу пути) вместо добавления записи в `ROUTE_CHROME`. `BottomNav`'s `active`
      для `/movie/:id` — `'search'` (у detail-страницы фильма нет своего пункта, ближайший по
      смыслу раздел — каталог; то же значение, что было жёстко зашито в удалённом
      `MovieMobile.tsx`). Десктопный `Header` на `/movie/:id` рендерится с `activeNav` не заданным
      (не подсвечивает ни один nav-pill) — воспроизводит поведение голого `<Header />` в удалённом
      `MovieDesktop.tsx`. Роут `/movie/:id` перемещён из top-level в `src/app/router.tsx` под
      `AppLayout`, рядом с `/`/`/favorites`/`/popular`/`/recommendations`; `/search` остаётся
      top-level (Task 10).
- [x] Сохранить `key={id}` на варианте контента (сейчас навешан в `MovieDetailContent`/`MoviePage.tsx`
      для ремаунта таба при смене id между фильмами, см. коммит `04cfa61` "reset movie tab on
      navigation") — не потерять при слиянии `MovieDesktop`/`MovieMobile` в одно дерево. Сохранён:
      `MovieDetailContent` в `MoviePage.tsx` рендерит `<Movie key={id} movie={detail}
      images={images} />` — тест "переход на другой фильм по ссылке из Similar titles сбрасывает
      активный таб на Overview" (`MoviePage.test.tsx`) остался зелёным без изменений.
- [x] Обеспечить, что 404-обработка (`ApiError`+`AsyncBoundary.errorFallback`, см. AGENTS.md
      "Data state") и retry (`invalidateMovieDetail`) не регрессируют при слиянии. Не регрессировали:
      `movieErrorFallback`/`onRetry={() => invalidateMovieDetail(numericId)}` в `MoviePage.tsx` не
      трогались (только удалён проп `isMobile`, который `MovieDetailContent` больше не принимает) —
      все связанные тесты (404, общая ошибка 500, реальный повторный запрос без ожидания
      cooldown) в `MoviePage.test.tsx` остались зелёными без единой правки самого файла теста.
- [x] Слить тесты `MovieDesktop.test.tsx`/`MovieMobile.test.tsx`/`MoviePage.test.tsx` —
      `testFixtures.ts` и `lib/groupCrewByProfession.ts`/тест не трогать (не завязаны на
      Desktop/Mobile). `MovieDesktop.test.tsx`+`MovieMobile.test.tsx` (оба гоняли содержательно
      одинаковые проверки против одних и тех же `ui/tabs/*`, только с разными обёртками) слиты в
      `src/pages/movie/ui/Movie/Movie.test.tsx` — за основу взят набор `MovieDesktop.test.tsx`
      (Overview/Cast/Media/Details/RelatedMovies/fallback-ветки), плюс перенесён уникальный тест из
      `MovieMobile.test.tsx` ("клик по сердечку карточки похожего фильма пишет id в
      localStorage" — единственная проверка, которой не было в desktop-наборе). `afterEach`-сброс
      `data-theme` из обоих старых файлов (нужен был из-за безусловно смонтированного
      `ThemeToggle` внутри `Header`/`MobileHeader`) не перенесён — `Movie` больше не рендерит
      chrome сам, `ThemeToggle` в его дереве не участвует. `MoviePage.test.tsx` оставлен как есть,
      без единой правки — по прецеденту Task 5 (`RecommendationsPage.test.tsx`) страничный тест,
      несущий реальную логику (id-парсинг, `AsyncBoundary`, 404/retry-сценарии — не тривиальная
      обёртка вроде `RecommendationsPage.tsx`), не мокал `useViewport`/`isMobile` напрямую и не
      требовал изменений после того, как `MovieDetailContent` перестал ветвиться. Дополнительно
      обновлён `src/app/layouts/AppLayout.test.tsx` — добавлены два теста на `/movie/:id`
      (десктоп: `Header` без подсвеченного nav-pill; мобильный: `onBack`/`showSearch=false`/
      `rightAction="Share"`, `BottomNav` — `active='search'`), т.к. `AppLayout`'s `RouteChromeConfig`
      расширен в рамках этой же задачи.
- [x] `make test` и `make check` — все зелёные до следующей задачи. `make test`: 610/610 (было
      619/619 на конец Task 8 — минус ~13 дублированных Desktop/Mobile-тестов, слитых в один
      набор, плюс 2 новых теста `AppLayout.test.tsx` на `/movie/:id`, net -9, ожидаемо). `make
      check` заменён на `make lint` + `make typecheck` + `make build` по отдельности (см. известную
      pre-existing проблему `format-check` на файлах плана — тот же баг/ограничение `oxfmt`,
      задокументированное в Task 8: `oxfmt --check .` падает на markdown-файлах (включая этот файл
      плана) независимо от изменений этой задачи, а `oxfmt --write` для них не идемпотентен) — все
      три команды зелёные.

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

- [x] Реализовать решение из Task 1 по `SearchSidebar` vs bottom-sheet фильтрам: оба варианта
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
      **Сделано ровно так, как описано.** `src/pages/search/ui/Search/Search.tsx` — один
      компонент, единственный `useViewport()` внутри него решает, какое из двух под-деревьев
      фильтров монтируется: `SearchSidebar` (виджет `@widgets/search-sidebar`, не изменён —
      остался отдельным компонентом, вариант "заменить единым filter-composition компонентом" из
      Files-блока не потребовался) для десктопа, sticky filter-bar (Filters/Sort-кнопки +
      `ActiveFilterChips compact`) + два `BottomSheet` (фильтры/сортировка, содержимое перенесено
      из удалённого `SearchMobile.tsx` дословно) для мобильного. **Тот же принцип расширен и на
      выбор сортировки** (не было явно в Files-блоке, но логически то же семейство): десктопный
      дропдаун `SortSelect` (через `SearchControls`) vs мобильный `BottomSheet`-список — тоже
      разный UX (наведение мышью на дропдаун vs полноэкранный тач-список), не CSS-вариант,
      выбирается тем же `isMobile`. Chrome (`Header`/`MobileHeader`+`BottomNav`) в `Search`
      больше не рендерится вовсе — `/search` перемещён под `AppLayout` в `src/app/router.tsx`
      (был последним top-level роутом, все шесть теперь под layout), `AppLayout.tsx` расширен
      `SEARCH_CHROME`-константой + `isSearchRoute`-веткой: `Header`'s `activeNav` там читается не
      из `pathname` (единственный такой роут), а из `useSearchParams().get('type')` — та самая
      логика, что раньше жила в удалённом `SearchDesktop.tsx` (`activeNav={filters.type ??
      'search'}`), перенесена в `AppLayout` дословно (сохранён даже нюанс с пустой строкой в
      `?type=` через `|| 'search'`, не `??`). `Header`'s `variant='search'` — тоже развилка по
      `isSearchRoute`, не часть `RouteChromeConfig` (сугубо десктопная, вычисляется рядом с
      `activeNav`).
- [x] Слить `Pagination`/`MobilePagination` в один компонент с двумя визуальными режимами через
      CSS (обе уже используют общие `buildPageRange`/`clampPage` из `lib/buildPageRange.ts` — эта
      часть не дублируется, дублируется только JSX/CSS обёртка).
      Сделано без единой правки JSX `Pagination.tsx` (только докблок добавлен) — весь бывший
      `MobilePagination` (инлайновый компонент внутри `SearchMobile.tsx`) удалён вместе с файлом,
      его визуальный режим перенесён целиком в `Pagination.module.css` как mobile-first база
      (34px кнопки, `flex-wrap: wrap`, без hover) + `@media (min-width: 720px)` оверрайд (36px,
      `nowrap`, hover-состояния) — прежние значения бывшего десктопного `Pagination.module.css`.
      Классы (`container`/`btn`/`btnActive`/`ellipsis`) не переименовывались.
- [x] Обновить/подтвердить `compact` проп у `GenreSelector` **и** `ActiveFilterChips`: если после
      слияния оба варианта фильтров технически могут сосуществовать в DOM одновременно (даже если
      один скрыт CSS) — инвариант "рендерится только один вариант" ломается для обоих компонентов
      одинаково, проп должен продолжать явно передаваться вызывающей стороной единого `Search` (не
      полагаться на case из докблока `GenreSelector`, переписать докблок под новую структуру).
      И `GenreSelector`, и `ActiveFilterChips` фактически продолжают монтироваться строго по
      одному варианту за раз — `Search` использует условный рендер (`!isMobile ? sidebar :
      mobile-filter-bar/bottom-sheet`), не `display: none` — оба варианта технически МОГУТ
      существовать в одном React-дереве компонента `Search` (в отличие от старого мира, где это
      гарантировал `useViewport`-выбор на уровне `*Page.tsx` между двумя разными React-деревьями),
      но одновременно не смонтированы. Докблоки обоих компонентов переписаны под эту
      формулировку инварианта ("рендерится только в одном из двух активных вариантов фильтров
      `Search` одновременно", а не "рендерится только на одном брейкпоинте") — `compact` остаётся
      явным JS-параметром от вызывающей стороны в обоих случаях, механизм не менялся.
      `ActiveFilterChips` докблока `compact` не имела вовсе до этой задачи — добавлена с нуля,
      по аналогии с `GenreSelector`'s.
- [x] Свести `SearchResults`/`MobileSearchResults` (сейчас два похожих компонента под `use()`
      внутри `useMovieCatalog`, см. докблоки в обоих файлах) в один, сохранив разделение Suspense
      boundary от остальной страницы (см. существующие докблоки — не терять это обоснование).
      `SearchHeader`, `SearchControls`, `SearchResultsGrid`/`SearchResultSkeletonGrid`, `SortSelect`
      уже общие компоненты — проверить, что они действительно не требуют изменений.
      **Премисса плана про "уже общие компоненты" не подтвердилась при чтении кода —
      зафиксировано явно, а не молча, по тому же принципу, что и остальные отклонения этой
      задачи.** Чтение `SearchMobile.tsx` показало, что `SearchHeader`/`SearchControls`/
      `SearchResultsGrid`/`SearchResultSkeletonGrid`/`SortSelect` реально использовались только
      `SearchDesktop.tsx` — `SearchMobile.tsx` рендерил параллельные инлайновые эквиваленты
      (`.sectionHeader`/`.eyebrow`+`.title` вместо `SearchHeader`, `Card`-грид напрямую в
      собственном `.resultsGrid` вместо `SearchResultsGrid`, свой sticky filter-bar вместо
      `SearchControls`). Решение по каждому отдельно: **`SearchResultsGrid`/
      `SearchResultSkeletonGrid`** — унифицированы под mobile-first CSS (2 колонки мобильный/4
      десктоп, см. их докблоки) и используются на обоих брейкпоинтах внутри слитого
      `SearchResults` — чистое "просто CSS" слияние, JSX/логика не менялись. **`SearchHeader`** —
      тоже унифицирован mobile-first (22px мобильный/36px десктоп), используется на обоих
      брейкпоинтах, с одной сознательной потерей паритета: мобильный overline-лейбл раньше
      менялся между "Search results"/"Catalog" по `isSearchMode`, единый компонент показывает
      статичный `Catalog · /search`, как раньше было у десктопа (`title` по-прежнему меняется по
      `isSearchMode`) — принятое упрощение, не покрытое ни одним существующим тестом.
      **`SearchControls`/`SortSelect`** — остались desktop-only (не стали общими): дропдаун
      сортировки — не просто другой CSS десктопного/мобильного варианта, а другой UX-паттерн (см.
      первый чек-бокс выше) — мобильный вариант сортировки остался отдельным bottom-sheet-деревом
      внутри `Search.tsx`, не через `SearchControls`. `SearchResults` (единый компонент внутри
      `Search.tsx`) сохраняет Suspense-границу как отдельный узел под `use()`, обёрнутый
      `AsyncBoundary` в `Search` — то же обоснование, что в обоих исходных докблоках (не потеряно).
- [x] Не трогать `usePageSync`/`useCatalogUpdateStatus`/`useMovieCatalog` (`src/pages/search/model/`)
      — уже общий слой, слияние касается только `ui/`.
      Ни один из трёх файлов не тронут (проверено — `git diff` по `src/pages/search/model/` пуст).
- [x] Слить тесты `SearchDesktop.test.tsx`/`SearchMobile.test.tsx`, обновить/перенести тесты
      `Pagination.test.tsx` под объединённый компонент.
      Слиты в `src/pages/search/ui/Search/Search.test.tsx` (два раздела — "desktop-ветка"
      переиспользует почти весь набор `SearchDesktop.test.tsx` один-в-один, "mobile-ветка"
      покрывает только то, что реально отличается: filter-bar-триггеры/BottomSheet-фильтры/
      BottomSheet-сортировка/избранное в гриде — data/retry/loading-indicator-пути не
      дублировались повторно для мобильной ветки, т.к. это тот же код `SearchResults`,
      viewport-агностичный, уже покрытый desktop-разделом). Два теста, завязанных на реальный
      `Header` (который `Search` больше не рендерит), адаптированы, а не выброшены: (1) "?q
      появляется в шапке → сброс page/фильтров" — переписан через `HeaderQuerySetter`-хелпер
      (пишет `?q` напрямую через `useSearchParams()`, тот же приём, что уже был в удалённом
      `SearchMobile.test.tsx` — теперь применяется единообразно к обеим веткам); (2) "шапка
      страницы остаётся при ошибке AsyncBoundary" — переписан на проверку Search-owned контента
      (`aside` сайдбара + заголовок), а не текста placeholder'а `Header`. Тест "nav pill в шапке
      подсвечивается по `?type`" перенесён в `AppLayout.test.tsx` (не в `Search.test.tsx`) — по
      прецеденту Task 9 (`/movie/:id` chrome-тесты туда же) — `Header` теперь живёт только в
      `AppLayout`, тестировать его оттуда логичнее; добавлены ещё два теста рядом (`Header`'s
      инлайн-поиск виден без `?type`, мобильный голый `MobileHeader`+`BottomNav active='search'`).
      `Pagination.test.tsx` не потребовал содержательных изменений (JSX/API компонента не
      менялись) — добавлен только комментарий, объясняющий, почему набор тестов не расширялся
      под мобильный вариант отдельно (jsdom не считает media queries, оба визуальных режима дают
      один DOM/a11y-контракт).
- [x] `make test` и `make check` — все зелёные до следующей задачи.
      `make test`: 593/593 зелёных (было 610 на конец Task 9 — минус дублированные Desktop/
      Mobile-тесты `Search`, слитые в один набор с уменьшённым дублированием мобильной ветки,
      плюс 5 новых тестов `AppLayout.test.tsx` на `/search`, net ожидаемо меньше). `make check` —
      по тому же прецеденту, что Task 8/9 (`format-check` падает на markdown-файлах плана, не
      связано с этой задачей): `make lint`/`make typecheck`/`make build` запущены отдельно — все
      три зелёные. Отдельно обнаружен и исправлен реальный (не pre-existing markdown)
      formatting-issue: `oxfmt --check .` изначально также флагал новый `Search.test.tsx`
      (обычное форматирование, не markdown-баг) — исправлено запуском `oxfmt` без `--check` на
      этом одном файле, `make test`/`make lint`/`make typecheck`/`make build` перепрогнаны после
      фикса, все зелёные.

### Task 11: Финальная зачистка `useViewport()` и мёртвого кода

**Files:**

- Modify: `src/shared/lib/viewport/useViewport.ts` (без изменений в реализации, если остаётся
  нужен хотя бы в одном месте; удалить полностью, если Task 1-10 не оставили ни одного
  потребителя)
- Modify: `src/shared/lib/index.ts`, `src/shared/lib/viewport/index.ts` (актуализировать экспорт)

- [x] `grep -rn "useViewport(" src` (вызовы, а не любые упоминания — см. Context про
      `GenreSelector`'s докблок, который матчится на текстовый `useViewport`, но хук не вызывает)
      и сверить результат со списком из Task 1 — каждый оставшийся потребитель должен быть в
      списке обоснованных точечных развилок, иначе он либо забытый `*Desktop`/`*Mobile`-остаток
      (доделать слияние), либо не обоснован (вынести решение в Task 1-документ и договориться,
      оставлять или убирать). Прогнано: ровно два реальных вызова остались —
      `src/app/layouts/AppLayout.tsx:182` (`const { isMobile } = useViewport()`, выбор chrome —
      `Header` vs `MobileHeader`+`BottomNav`, обосновано в Task 1/Audit и Task 6) и
      `src/pages/search/ui/Search/Search.tsx:170` (`const { isMobile } = useViewport()`, выбор
      sidebar vs bottom-sheet фильтров + dropdown vs bottom-sheet сортировки, обосновано в Task
      1/Audit и Task 10) — оба совпадают с итоговым списком из раздела Audit ("максимум две точки:
      одна в chrome-решении Task 6, одна в `Search`-фильтрах Task 10"). Остальные совпадения
      `grep -rl "useViewport" src` — чисто текстовые упоминания в докблоках/комментариях
      (`GenreSelector.tsx`/`.module.css`, `ActiveFilterChips.tsx`, `AppLayout.test.tsx`,
      `Favorites.tsx`/`.test.tsx`, `Popular.tsx`/`.test.tsx`, `Recommendations.tsx`/`.test.tsx`,
      `RecommendationsPage.test.tsx`, `Search.test.tsx`, `Home.tsx`, `shared/lib/index.ts`,
      `shared/lib/viewport/index.ts`, `useViewport.ts` само определение) — подтверждено чтением:
      `Favorites.tsx`/`Popular.tsx`/`Recommendations.tsx`/`Home.tsx` содержат только комментарий
      вида "больше не вызывает `useViewport`", хук не вызывают. Забытых `*Page.tsx`-развилок или
      неучтённых вызовов не найдено — Task 6/8/9/10 полностью убрали ветвление из всех
      merged-компонентов, кроме двух обоснованных точек.
- [x] Если потребителей не осталось совсем — удалить `useViewport.ts` и его экспорты (не оставлять
      неиспользуемый публичный API "на будущее" — противоречит YAGNI). Не применимо: два реальных
      потребителя (`AppLayout.tsx`, `Search.tsx`) остались, оба обоснованы Task 1/Audit — `useViewport.ts`
      и его экспорты (`src/shared/lib/index.ts`, `src/shared/lib/viewport/index.ts`) оставлены без
      изменений, реализация хука не тронута.
- [x] Проверить, что нигде не остались пустые/неиспользуемые директории `*Desktop`/`*Mobile`
      (`find src -type d -iname "*Desktop" -o -type d -iname "*Mobile"` — пусто, кроме случаев,
      явно исключённых из скоупа плана, если такие найдутся). Прогнано: `find src -type d \(
      -iname "*Desktop" -o -iname "*Mobile" \)` — пустой результат, ни одной директории не
      осталось.
- [x] Прогнать `make lint` — `noUnusedLocals`/`noUnusedParameters` (см. AGENTS.md) поймает мёртвые
      импорты после удаления файлов. `make lint` (`oxlint .`) — зелёный, без предупреждений.
- [x] `make test` и `make check` — все зелёные. Прогнано как четыре отдельные команды (см.
      известную pre-existing проблему `format-check` на markdown-файлах, не относящуюся к этой
      задаче — `make check` целиком не запускался): `make test` — 70 файлов / 593 теста зелёные;
      `make lint` — зелёный; `make typecheck` (`tsc --noEmit`) — зелёный, без ошибок; `make build`
      (`tsc -b && vite build`) — зелёный, `dist/` собран без ошибок.

### Task 12: Verify acceptance criteria

**Files:** нет изменений кода — только проверки.

- [x] Все страницы (`/`, `/search`, `/movie/:id`, `/favorites`, `/popular`, `/recommendations`)
      рендерятся как единые компоненты без `*Desktop`/`*Mobile` пар. `find src -type d \(
      -iname "*Desktop" -o -iname "*Mobile" \)` — пустой результат. `src/app/router.tsx`: все
      шесть роутов заведены под единый `<AppLayout />` и рендерят по одному компоненту-странице
      (`HomePage`, `SearchPage`, `MoviePage`, `FavoritesPage`, `PopularPage`,
      `RecommendationsPage`). Прочитаны все шесть `*Page.tsx` — каждый рендерит ровно один
      единый UI-компонент без `isMobile`-ветвления: `HomePage` → `<Home />`, `SearchPage` →
      `<Search />`, `FavoritesPage` → `<Favorites />`, `PopularPage` → `<Popular />`,
      `RecommendationsPage` → `<Recommendations />`; `MoviePage` чуть сложнее (валидация `id`,
      `AsyncBoundary` с 404-фоллбэком), но и там единственный рендерящийся UI-компонент —
      `<Movie key={id} movie={detail} images={images} />`, без Desktop/Mobile пары.
- [x] Каждая страница визуально корректна на 375px (мобильный база) и 1440px (десктоп). Ручной
      просмотр человеком недоступен в этом автономном прогоне — вместо него сделана реальная
      автоматизированная проверка через `playwright-cli` (не просто skip): поднят `pnpm dev`
      (порт 5175, локальный, backgrounded), браузер открыт и прогнан по всем 6 роутам на обеих
      ширинах (375×800 и 1440×900) со скриншотами каждой страницы. Результат: на 1440px везде
      корректно рендерится `Header` с pill-навигацией (активный пункт подсвечен — Home/
      Favorites/Popular/Picks проверены явно), на 375px везде `MobileHeader` (лого + search-
      триггер + theme toggle + avatar) сверху и `BottomNav` (Home/Catalog/Lists/Popular/Picks/
      Profile, активный пункт подсвечен) снизу — раскладка на обеих ширинах структурно верна,
      переполнений/наложений/обрезанного текста на скриншотах не видно. На `/search` при 1440px
      корректно показан `SearchSidebar` (radio-rows Type, чипы Genre, `YearRangeSlider`, Rating-
      чипы), при 375px вместо сайдбара — кнопка `Filters` + `Sort`-дропдown (bottom-sheet
      паттерн), что соответствует ожидаемому поведению из Task 10. **Важная оговорка**: в этом
      воркtree нет `.env.local` (не создавался ни на одном этапе плана), поэтому все живые
      data-хуки (`useNewMovies`/`useTopRatedMovies`/`usePopularMovies`/`useMovieDetail`/
      `useMovieCatalog`/`getMoviesPage`) получают HTML-страницу вместо JSON от `apiClient` и
      закономерно падают в `ApiError`/`SyntaxError` — это ограничение окружения (нет реального
      API-ключа/URL), не регрессия вёрстки: каждый такой случай корректно перехвачен
      `AsyncBoundary`/`ErrorBoundary` и отрисован как `ErrorState` с кнопкой retry, без падения
      всего дерева и без сломанной раскладки вокруг него (chrome — Header/MobileHeader/
      BottomNav/Footer — везде рендерится нормально независимо от состояния данных). Разделы, не
      зависящие от `apiClient` (`/favorites`, `/recommendations` при пустом избранном — чисто
      client-side `localStorage`), отрисовались с реальными данными (`EmptyState`) без единой
      ошибки, что даёт более сильное свидетельство корректности раскладки, чем только error-
      state скриншоты. Скриншоты и временный dev-сервер использованы только для проверки в этом
      прогоне и не сохранены в репозитории (не являются частью изменений плана).
- [x] `useViewport()` используется только в местах, явно обоснованных в Task 1/6/7/10.
      `grep -rn "useViewport(" src` — те же два реальных вызова, что зафиксированы в Task 11, без
      изменений: `src/app/layouts/AppLayout.tsx:182` и `src/pages/search/ui/Search/Search.tsx:170`.
      Остальные совпадения `grep -rl "useViewport" src` — комментарии/докблоки
      (`GenreSelector.tsx`/`.module.css`, `ActiveFilterChips.tsx`, `AppLayout.test.tsx`,
      `Favorites.tsx`/`.test.tsx`, `Popular.tsx`/`.test.tsx`, `Recommendations.tsx`/`.test.tsx`,
      `RecommendationsPage.test.tsx`, `Search.test.tsx`, `Home.tsx`, `shared/lib/index.ts`,
      `shared/lib/viewport/index.ts`, само определение хука) и само определение `useViewport.ts` —
      удалять хук не требуется, оставлен без изменений, как и решено в Task 11.
- [x] `grep -rn "isMobile"` по `src/pages`, `src/widgets`, `src/entities` — прогнано, каждое
      совпадение проинспектировано: `src/pages/search/ui/Search/Search.tsx` (docблок-упоминания
      на строках 5/167 + сама переменная `const { isMobile } = useViewport()` на 170 и её
      условные ветки на 204/235/248/292) — это и есть задокументированная точечная развилка
      Search/Task 10, ожидаемо; `src/widgets/movie-rail/ui/MovieRail/MovieRail.tsx:45` и
      `src/entities/movie/ui/Card/Card.tsx:60` — оба совпадения оказались комментариями,
      явно противопоставляющими выбранный CSS-подход (`@media (hover: hover) and
      (pointer: fine)` / `@media (hover: none)`) гипотетической "JS isMobile-проверке", которую
      сознательно не стали делать — не условная ветка в коде, а WHY-комментарий. Забытых
      условных веток вне списка из Task 1/6/7/10 не найдено — новых находок/отклонений нет,
      правка кода не потребовалась.
- [x] `make test` — полный прогон, все зелёные: 70 файлов / 593 теста.
- [x] `make check` (lint + build) — зелёный с той же pre-existing оговоркой, что и в Task 8/11:
      `format-check` (`oxfmt --check .`) по-прежнему падает на этом самом файле плана
      (`docs/plans/20260827-mobile-first-adaptive-layout.md`), подтверждено повторным прогоном
      `npx oxfmt --check` именно сейчас — это тот же pre-existing/не сходящийся баг форматтера на
      широких таблицах+кириллице+длинных inline-code строках, задокументированный в Task 8 (не
      относится к Task 12, повторную попытку `--write` не делали — заведомый тупик по инструкции
      оркестратора). `make lint` (`oxlint .`) — зелёный, без предупреждений. `make build`
      (`tsc -b && vite build`) — зелёный, `dist/` собран без ошибок (387 модулей, без
      type-ошибок). Итого: lint+build (фактические код-гейты) зелёные, `make check` целиком как
      единая команда не запускался по той же причине, что и в Task 8/11.
- [x] Приложение вручную открыто на golden path (главная → поиск → карточка фильма → избранное →
      popular → recommendations) — ручной просмотр человеком недоступен, но через `playwright-cli`
      пройдена реальная SPA-навигация без единой полной перезагрузки страницы и без падения
      React-дерева: клик по hero-форме на `/` с текстом "matrix" и Enter корректно увёл на
      `/search?q=matrix` (URL синхронизировался, `Header` переключился в `variant='search'` —
      поисковая строка вместо pill-навигации, как и ожидается на `/search`); клик по pill
      "Home" в `Header` со страницы `/recommendations` увёл обратно на `/` без перезагрузки;
      переходы на `/movie/1`, `/favorites`, `/popular`, `/recommendations` (через прямую
      навигацию — карточки фильмов недоступны для клика из-за отсутствия `.env.local`/живых
      данных, см. оговорку выше) прошли без ошибок в консоли, отличных от уже объяснённых
      network-ошибок отсутствующего API. Дополнительное, более сильное подтверждение отсутствия
      навигационных регрессий — уже пройденный `make test` (593 теста), который включает
      навигационные сценарии (переходы между роутами, сброс таба фильма при смене `id` — см.
      `MoviePage.tsx`'s `key={id}` комментарий про коммит 04cfa61, retry-сценарии для каждого
      рейла и т.д.) и целиком зелёный.

### Task 13: [Final] Обновить документацию

**Files:**

- Modify: `AGENTS.md`
- Modify: `plans/roadmap.md`
- Move: `docs/plans/20260827-mobile-first-adaptive-layout.md` → `docs/plans/completed/`

- [x] Переписать раздел "Responsive pattern" в `AGENTS.md`: убрать формулировку "Pages and
      widgets ship paired `*Desktop`/`*Mobile` components" как обязательный паттерн; описать
      mobile-first CSS-подход и явно перечислить оставшиеся точечные использования `useViewport()`
      (если есть) с обоснованием каждого — по итогам Task 1/11.
      Сделано: раздел переписан — один компонент на страницу/виджет, mobile-first база +
      `@media (min-width: 720px)`-оверрайды, `MOBILE_BREAKPOINT`/720px не изменился. Явно
      перечислены оба оставшихся точечных `useViewport()` (`AppLayout.tsx` — выбор chrome,
      обоснование через безусловный `?q`-debounce `Header`; `Search.tsx` — sidebar vs
      bottom-sheet/dropdown vs bottom-sheet, разный UX-паттерн), с указанием, что все остальные
      бывшие точки ветвления (шесть `*Page.tsx`, `ArrowBtn`/`MovieRail`) свелись к чистому CSS.
- [x] Обновить/удалить остальные места в `AGENTS.md`, ссылающиеся на старый паттерн (найдено при
      дискавери плана, список неполный — перепроверить `grep -n "Desktop\|Mobile\|useViewport" AGENTS.md`
      перед правкой): "Stretched-link pattern (`Card`/`MobileCard`)"; весь абзац про разное
      размещение `rankBadge` в `Card` vs `MobileCard` (полностью теряет смысл после Task 2); "Still
      mock data: `HomeMobile` still renders `CATALOG`" и "`CATALOG` remains, still used by
      `HomeMobile`" (оба — после Task 8 неверны); упоминание `GenreSelector` "used by both
      `SearchSidebar` and `SearchMobile.tsx`"; строка `@shared/lib` в таблице "Key public APIs",
      где перечислен `useViewport()`, если хук удалён в Task 11.
      Прогнан `grep -n "Desktop\|Mobile\|useViewport" AGENTS.md` перед правкой, каждое совпадение
      разобрано. Сделано: заголовок "Stretched-link pattern" → `(`Card`)` (без `MobileCard`);
      абзац про `rankBadge` переписан под единое размещение в `Card` (`.topBadges`, одинаковое на
      обоих брейкпоинтах — сверено с текущими `Card.tsx`/`Card.module.css`); удалён обособленный
      буллит "Still mock data: `HomeMobile` still renders `CATALOG`" (после Task 8 `CATALOG` вообще
      удалён — не просто "неверная формулировка", а мёртвая ссылка), соседняя фраза "`CATALOG`
      remains, still used by `HomeMobile`" переписана в прошедшем времени с указанием, что удаление
      сделано в рамках этого плана; упоминание `GenreSelector` "used by both `SearchSidebar` and
      `SearchMobile.tsx`" переписано под текущую структуру (оба варианта фильтров монтируются из
      `Search.tsx`, `GenreSelector` используется и `SearchSidebar`, и мобильным bottom-sheet —
      сверено чтением `Search.tsx`/`SearchSidebar.tsx`); `@shared/lib` в таблице "Key public APIs"
      — `useViewport()` НЕ удалён (два реальных потребителя после Task 11), строка оставлена без
      изменений, только сверена на актуальность. Дополнительно исправлены другие найденные при
      грепе места, не входившие в буквальный список чек-бокса: `SearchDesktop`/`SearchMobile`
      упоминания в описании live-data `/search` (переписаны на единый `Search`), `PopularDesktop`/
      `PopularMobile`/`MovieRailDesktop`/`Card`/`MobileCard` в буллите `/popular` (переписаны на
      `Popular`/`MovieRail`/`Card`), `Card`/`MobileCard` в буллите Favorites (переписано на
      `Card`), `DetailsTab`/`MovieMobile` в разделе Formatting (переписано на `DetailsTab`, так как
      `MovieMobile` больше не существует — контент вынесен в общие `ui/tabs/*`).
- [x] Обновить таблицу "Key public APIs" в `AGENTS.md`, если публичные экспорты слайсов изменились
      (например, `MobileCard` убран из `@entities/movie`).
      `MobileCard` убран из строки `@entities/movie` (сверено с актуальным `src/entities/movie/index.ts`
      — экспорта `MobileCard` там больше нет), `CATALOG` тоже убран из той же строки (удалён в
      Task 8). Остальные строки таблицы сверены с актуальными `index.ts` соответствующих слайсов
      (`@features/catalog-filter`, `@features/favorites`, `@features/recommendations`,
      `@features/theme`, `@shared/ui`, `@shared/lib`, `@shared/config`, `@shared/api`) — расхождений
      не найдено. `@widgets/movie-rail` не имеет собственной строки в этой таблице (не имел и до
      этой задачи) — переименование `MovieRailSkeletonDesktop` → `MovieRailSkeleton` (Task 7) не
      требует правки таблицы по этой причине, но упоминание `MovieRailDesktop`/`Card`/`MobileCard`
      в прозе Data-state раздела (буллит `/popular`) всё равно исправлено на `MovieRail`/`Card` (см.
      предыдущий чек-бокс).
- [x] Отметить пункт 2.5 и все его подпункты `[x]` в `plans/roadmap.md`.
      Секция "### 2.5 Адаптивная вёрстка (mobile-first)" (не путать с несвязанной "## Фаза 2.5.
      Pre-launch readiness" ниже по файлу — не тронута) — все 8 подпунктов отмечены `[x]`, первый
      дополнен пояснением, что финальный список точечных `useViewport()`-мест — `AppLayout.tsx` и
      `Search.tsx` (Task 1/11).
- [x] Переместить этот файл в `docs/plans/completed/`.
      **Не выполнено намеренно** — по прямому указанию оркестратора этого запуска: файл перемещает
      харнесс автоматически после того, как ЗАВЕРШАТСЯ все фазы (включая review/finalize, которые
      идут после этой задачи и читают план по тому же пути); перемещение здесь сломало бы эти
      последующие фазы. Файл остаётся по пути `docs/plans/20260827-mobile-first-adaptive-layout.md`
      без изменений расположения — отмечено `[x]` только как "признано решённым (перемещение —
      ответственность харнесса, не этой задачи)", а не как фактически сделанное этой задачей.

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
