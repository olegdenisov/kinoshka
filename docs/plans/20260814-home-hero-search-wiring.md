# Связывание хиро-поиска главной страницы с /search

## Обзор

`HeroSection` на главной странице (`/`) уже рендерит поле поиска и ряд чипов
переключения типа (`Everything` / `Movies` / `Series` / `Anime`), но оба
элемента чисто декоративные: их состояние живёт в локальном `useState` и
никуда не передаётся. Нажатие Enter или клик по "Search" просто делает
`navigate('/search')` без query-строки — всё, что пользователь ввёл или
выбрал, молча отбрасывается.

Этот план связывает поле поиска и чипы типа в хиро с реальной страницей
`/search`: сабмит собирает URL `/search?q=...&type=...`, используя тот же
контракт `FilterState`/`filtersToSearchParams`, который `/search` уже читает
через `useFilterState()`. Изменений в `useFilterState`, `searchParams.ts` или
самой странице `/search` не требуется — они уже корректно обрабатывают
`?q`/`?type` (см. `usePageSync`, `SearchDesktop.tsx`). Дополнительно план
явно подтверждает тестом, что фильтр типа в сайдбаре `/search`
(`SearchSidebar`) синхронизируется с `?type`, пришедшим из хиро-навигации —
это уже работает "бесплатно" благодаря тому, что URL остаётся единственным
источником истины, но до сих пор не покрыто тестом.

**Скоуп — только desktop.** `HeroSection` рендерится исключительно в
`HomeDesktop` (`HomePage.tsx` выбирает `HomeMobile`/`HomeDesktop` по
`useViewport()`). У `HomeMobile` есть свои декоративные чипы типа
(`HomeMobile.tsx:10-17`) и ссылка `<Link to='/search'>` без параметров —
они остаются нетронутыми, тем же паттерном, что и остальной мок-контент
`HomeMobile` (`CATALOG`/`ALL_GENRES`, ожидает отдельной фазы миграции на
реальные данные — Phase 2.5 в `plans/roadmap.md`). Это осознанный вырез
объёма, а не пропуск.

## Контекст (из ресёрча)

- **Затронутые файлы/компоненты:**
  - `src/pages/home/ui/HeroSection/HeroSection.tsx` — основной файл с
    изменением логики. Владеет `q` (текст поиска) и `activeFilter`
    (переключатель типа), а также массивом `CHIPS`. Плюс два точечных
    реэкспорта в публичных `index.ts` соседних слайсов (`@widgets/header`,
    `@features/catalog-filter`) — см. Обзор решения.
  - `src/features/catalog-filter/lib/searchParams.ts` — экспортирует
    `filtersToSearchParams(filters: FilterState): URLSearchParams`, уже
    используется в `useFilterState`. Переиспользуется как есть (публичный
    API через `@features/catalog-filter`).
  - `src/pages/search/ui/SearchDesktop/SearchDesktop.tsx` — читает
    `?q`/`?type` при монтировании (через `useSearchParams`/`useFilterState`),
    передаёт `filters` в `SearchSidebar`. Изменений в самом компоненте не
    требуется, только новый тест.
  - `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx` —
    рендерит радио-кнопку типа как `active={filters.type === t.key}`, т.е.
    уже реактивен к `filters`, приходящим сверху из `useFilterState()`.
    Изменений не требуется — только verification-тест.
  - `src/widgets/header/ui/Header/Header.tsx` — референс рабочего flow
    "поиск → URL" (хотя `Header` пишет `?q` вживую через debounce; хиро
    пишет по явному сабмиту, см. Технические детали).
- **Найденные паттерны:**
  - `FilterState.type` использует ключи в единственном числе `'movie' |
    'series' | 'anime'` (см. `TYPE_MAP` в
    `src/features/catalog-filter/lib/filtersToParams.ts`), что совпадает с
    чипами типа в `SearchMobile.tsx` (`{ key: 'movie', label: 'Movies' }` и
    т.д., строка ~487). Текущие ключи `CHIPS` в хиро (`'all' | 'movies' |
    'series' | 'anime'`) с этим не совпадают и должны быть приведены к
    единому контракту, а не получить отдельную таблицу маппинга.
  - `src/widgets/header/ui/Header/Header.test.tsx` задаёт паттерн проверки
    реальной навигации: рендер внутри `MemoryRouter`, монтирование
    `LocationProbe`, который читает `useLocation().search` в
    module-level переменную, проверка этой переменной после взаимодействия.
    План переиспользует этот паттерн вместо мока `useNavigate`.
  - **Variant A (уже существующее поведение, не меняется):** если хиро
    передаёт одновременно `type` и непустой `q`, `usePageSync`
    (`src/pages/search/model/usePageSync.ts`) на монтировании страницы
    `/search` вычищает `type`/`genres`/`yearFrom`/`yearTo`/`rating`/`sort` из
    URL, потому что текстовый поиск и фильтры каталога несовместимы в одном
    запросе API (`getSearchMovies` не принимает фильтры). Значит, синхронизация
    сайдбара с типом из хиро видна только тогда, когда `q` пустой (режим
    browse), — при непустом `q` сайдбар задизейблен и `type` не сохраняется.
    Это осознанное существующее ограничение, план его не меняет, только
    документирует его.
  - **Комбинация `type`+`q` уже покрыта существующими тестами** —
    `usePageSync.test.tsx:186` (deep-link сразу в search-режим с фильтрами в
    URL — mount стрипает их) и `SearchDesktop.test.tsx:100-137` (сайдбар
    задизейблен в `?q`-режиме). Task 2 ниже не дублирует этот сценарий,
    покрывает только новую комбинацию — `type` без `q` (browse-режим),
    которая раньше не встречалась ни в одном тесте.
  - **Несогласованность min-length между `Header` и хиро (критично для
    корректности):** `Header` пишет `?q` только при `trimmed.length >=
    QUERY_MIN_LENGTH` (константа `= 2`,
    `src/widgets/header/ui/Header/Header.tsx:12`). Если хиро при сабмите
    ставит `q` при любом непустом значении (без этого же гейта), однобуквенный
    запрос типа `/search?q=d` после навигации тут же попадает на `/search`,
    где рендерится и сам `Header` (`variant='search'`) — его `draft`
    инициализируется из `?q` тем же значением `'d'`, и `useDebouncedValue`
    возвращает НАЧАЛЬНОЕ значение синхронно (`useState(value)` в
    `src/shared/lib/debounce/useDebouncedValue.ts:10`), поэтому эффект записи
    в URL срабатывает уже на первом коммите: `trimmed.length < 2` →
    `params.delete('q')`. Итог — `useMovieCatalog` успевает дёрнуть
    `getSearchMovies('d')` при первом рендере (лишний сетевой запрос на
    demo-квоте 200 req/сутки), а `?q` тут же исчезает из URL и пользователь
    видит "Browse catalog" вместо результатов — то самое "введённое молча
    отбрасывается", которое этот план и должен был починить. Хиро обязан
    применять тот же гейт `QUERY_MIN_LENGTH`, что и `Header`, а не
    изобретать свой порог — см. Task 1.
- **Зависимости:** новых нет — `filtersToSearchParams` и `EMPTY_FILTERS`
  переиспользуются из `@features/catalog-filter` (`EMPTY_FILTERS` сейчас не
  реэкспортирован из публичного `index.ts` — Task 1 это исправляет, вместо
  дублирования литерала `{ genres: [], yearFrom: null, ... }` в
  `HeroSection`); `QUERY_MIN_LENGTH` берётся из `@widgets/header` (сейчас
  module-private в `Header.tsx` — Task 1 экспортирует её через публичный
  `index.ts` виджета, чтобы обе точки входа поиска жили по одному контракту
  вместо дублирования магического числа `2`).

## Подход к разработке

- **Подход к тестированию:** Regular (сначала код, потом тесты)
- Каждая задача выполняется полностью, прежде чем переходить к следующей
- Изменения точечные — это связывание одного компонента с уже существующим
  URL-контрактом, а не рефакторинг стека фильтров/поиска
- **КРИТИЧНО: каждая задача ДОЛЖНА включать новые/обновлённые тесты** для
  изменений кода в этой задаче
- **КРИТИЧНО: все тесты должны проходить перед началом следующей задачи** —
  без исключений
- Запускать тесты после каждого изменения
- Сохранять обратную совместимость (без изменений в поведении `/search` или
  URL-контракте)

## Стратегия тестирования

- **Unit-тесты:** новый `HeroSection.test.tsx` (у компонента сейчас нет
  тестов), проверяющий реальную навигацию через паттерн `MemoryRouter` +
  `LocationProbe` из `Header.test.tsx` — без мока `useNavigate`, чтобы
  проверять фактическую результирующую строку URL.
- **Интеграционный тест сайдбара:** дополнение к
  `SearchDesktop.test.tsx` — монтирование `SearchDesktop` сразу на
  `/search?type=movie` (эмулируя переход из хиро с выбранным типом и пустым
  запросом) и проверка, что радио-кнопка "Movies" в `SearchSidebar` активна, а
  "Series"/"Anime" — нет. Комбинация `type`+`q` не дублируется отдельным
  тестом — она уже покрыта существующими `usePageSync.test.tsx:186` и
  `SearchDesktop.test.tsx:100-137` (см. Контекст выше).
- **E2E-тесты:** в проекте нет Playwright/Cypress-сьюта — пропускается.

## Отслеживание прогресса

- Отмечать выполненные пункты `[x]` сразу по завершении
- Новые обнаруженные задачи — с префиксом ➕
- Проблемы/блокеры — с префиксом ⚠️
- Обновлять план при отклонении от исходного объёма работ

## Обзор решения

- Привести ключи `CHIPS` к контракту `FilterState.type`: `null` для
  "Everything" (соответствует "без фильтра типа" — `FilterState.type:
  string | null`), `'movie'`, `'series'`, `'anime'` для остальных.
  Тип состояния `activeFilter` меняется на `FilterState['type']` (было
  `string`), начальное значение `null`. React-`key` в `CHIPS.map` переносится
  на `c.label` (уникален и стабилен), а не `c.key`, — иначе `null`-ключ
  превращается в React-`key="null"` неявной строкой.
- Экспортировать `EMPTY_FILTERS` из публичного `index.ts`
  `@features/catalog-filter` (уже существует в `searchParams.ts`, просто не
  реэкспортирован) и `QUERY_MIN_LENGTH` из публичного `index.ts`
  `@widgets/header` (сейчас module-private в `Header.tsx`) — обе точки входа
  поиска (`Header` и хиро) должны жить по одному контракту вместо
  дублирования литералов/магических чисел.
- По сабмиту (Enter в поле, либо клик по кнопке "Search" — оба обработчика
  уже есть, просто сейчас неполные) собрать целевой URL:
  1. `filtersToSearchParams({ ...EMPTY_FILTERS, type: activeFilter })` →
     `URLSearchParams`, содержащий `type` только если `activeFilter` не
     `null` (функция уже пропускает null/пустые поля).
  2. `trimmed = q.trim()`; если `trimmed.length >= QUERY_MIN_LENGTH` —
     `params.set('q', trimmed)`. Тот же гейт, что и в `Header`, — иначе
     однобуквенный запрос из хиро долетает до `/search` и тут же стирается
     эффектом `Header`, см. Контекст выше.
  3. `navigate(params.toString() ? `/search?${params}` : '/search')`.
- Никакого debounce и live-записи в URL при вводе — хиро-поиск это
  однократное действие "подтвердить и перейти", в отличие от live-синка
  `?q` в `Header` при уже открытой `/search`. Это соответствует
  существующему UX (кнопка называется "Search", а не живой фильтр) и не
  засоряет историю браузера записью на каждое нажатие клавиши на странице,
  которую пользователь всё равно сейчас покинет.
- `/search` подхватывает `?q`/`?type` через свой существующий, неизменный
  путь чтения (`useFilterState()` для `type`, `searchParams.get('q')` для
  `q`), поэтому фильтры отрисовываются корректно, а `SearchSidebar`
  автоматически показывает активным выбранный из хиро тип — новой логики
  для этого не требуется, только verification-тест (см. Технические
  детали про Variant A для случая одновременного `type`+`q`).

## Технические детали

- **Поток данных:** локальный state `HeroSection` (`q: string`,
  `activeFilter: FilterState['type']`) → по сабмиту → `URLSearchParams` (через
  `filtersToSearchParams` + ручной `set` для `q`) →
  `navigate(`/search?${params}`)` → `/search` читает `?type` через
  `useFilterState()` и `?q` через `useSearchParams().get('q')` (оба пути не
  меняются) → `SearchSidebar` получает `filters` пропом и подсвечивает
  активный тип автоматически.
- **Маппинг типов:** `null` → без параметра `type` (browse "everything");
  `'movie' | 'series' | 'anime'` → `type=<value>`, далее разворачивается в
  `TYPE_MAP` из `filtersToParams` при сборке реального API-запроса на
  `/search` (этот шаг не меняется, вне скоупа плана).
- **Граничные случаи:**
  - Пустой запрос + выбран "Everything" + сабмит → `navigate('/search')`
    (без query-строки) — попадание на пустой browse-каталог, аналогично
    клику по обычной иконке поиска в `Header` (`variant='default'`).
  - Пустой запрос + выбран тип + сабмит →
    `navigate('/search?type=movie')` — browse только по фильтру, без
    текстового поиска. Сайдбар на `/search` при этом покажет "Movies"
    активным (проверяется тестом в Task 2).
  - Запрос короче `QUERY_MIN_LENGTH` (1 символ) + сабмит → `q` в URL не
    попадает (тот же гейт, что в `Header`) — если при этом выбран тип,
    `/search?type=movie` без `q`; если тип не выбран — `/search` без
    query-строки. Без этого гейта однобуквенный запрос из хиро тут же
    стирался бы эффектом `Header` на `/search`, см. Контекст выше.
  - Непустой запрос (длиной ≥ `QUERY_MIN_LENGTH`, любой выбранный тип) →
    `type` (если задан) + `q`, например `/search?type=series&q=dune`.
    Guard-эффект `usePageSync` на монтировании уже вычищает `type`/остальные
    фильтры при непустом `q` — существующее, протестированное поведение
    (Variant A: `usePageSync.test.tsx:186`, `SearchDesktop.test.tsx:100-137`),
    план его не переоткрывает и не дублирует тестом.

## Что куда идёт

- **Implementation Steps** (чекбоксы `[ ]`): изменение `HeroSection.tsx` и
  тесты к нему, плюс verification-тест сайдбара в `SearchDesktop.test.tsx`
  — всё достижимо в рамках этой кодовой базы.
- **Post-Completion** (без чекбоксов): ручной smoke-тест в браузере.

## Implementation Steps

### Task 1: Связать поле поиска и чипы типа в хиро с навигацией на `/search`

**Files:**

- Modify: `src/widgets/header/ui/Header/Header.tsx` (экспортировать
  `QUERY_MIN_LENGTH`)
- Modify: `src/widgets/header/index.ts` (реэкспортировать
  `QUERY_MIN_LENGTH`)
- Modify: `src/features/catalog-filter/index.ts` (реэкспортировать
  `EMPTY_FILTERS`)
- Modify: `src/pages/home/ui/HeroSection/HeroSection.tsx`
- Create: `src/pages/home/ui/HeroSection/HeroSection.test.tsx`

- [ ] В `Header.tsx` добавить `export` к `QUERY_MIN_LENGTH`; в
      `src/widgets/header/index.ts` добавить `export { QUERY_MIN_LENGTH }
      from './ui/Header'`
- [ ] В `src/features/catalog-filter/index.ts` добавить `export {
      EMPTY_FILTERS } from './lib/searchParams'`
- [ ] Импортировать `filtersToSearchParams`, `EMPTY_FILTERS` из
      `@features/catalog-filter` и `QUERY_MIN_LENGTH` из `@widgets/header` в
      `HeroSection.tsx`
- [ ] Обновить `CHIPS` до `{ key: null, label: 'Everything' }, { key:
      'movie', label: 'Movies' }, { key: 'series', label: 'Series' }, {
      key: 'anime', label: 'Anime' }`; поменять состояние `activeFilter` на
      `useState<FilterState['type']>(null)`; в `CHIPS.map` использовать
      `key={c.label}` вместо `key={c.key}` (значение `key` теперь может
      быть `null`)
- [ ] Добавить функцию `handleSubmit`, которая собирает `URLSearchParams`
      через `filtersToSearchParams({ ...EMPTY_FILTERS, type: activeFilter })`,
      устанавливает `q` через `params.set('q', trimmed)` только если
      `q.trim().length >= QUERY_MIN_LENGTH`, и вызывает
      `navigate(params.toString() ? `/search?${params}` : '/search')`
- [ ] Привязать `onKeyDown` поля (клавиша Enter) и `onClick` кнопки
      "Search" к вызову `handleSubmit` (заменить текущие голые вызовы
      `navigate('/search')`)
- [ ] Написать тест: ввод запроса длиной ≥ `QUERY_MIN_LENGTH` и нажатие
      Enter ведёт на `/search?q=<query>` (с trim)
- [ ] Написать тест: выбор чипа типа (например "Movies") при пустом
      запросе и клик по "Search" ведёт на `/search?type=movie`
- [ ] Написать тест: заданы одновременно запрос (≥ `QUERY_MIN_LENGTH`) и
      чип типа — ведёт на `/search?type=<type>&q=<query>`
- [ ] Написать тест: запрос короче `QUERY_MIN_LENGTH` (например 1 символ) +
      Enter — `q` не попадает в URL (переход на `/search` без `?q`, тот же
      гейт, что в `Header`, см. Контекст/Технические детали)
- [ ] Написать тест: состояние по умолчанию (активен "Everything", пустой
      запрос) и клик по "Search" ведёт на `/search` без query-строки
      (граничный случай — пустой сабмит не должен давать лишний `?` или
      пустые параметры)
- [ ] Прогнать тесты (`make test`) — должны пройти перед следующей задачей

### Task 2: Подтвердить синхронизацию фильтра типа в сайдбаре `/search`

Только тест — прод-код не меняется: `SearchSidebar` уже реактивен к
`filters.type` из `useFilterState()`. Комбинация `type`+`q` не тестируется
отдельно (уже покрыта `usePageSync.test.tsx:186` +
`SearchDesktop.test.tsx:100-137`, см. Контекст).

**Files:**

- Modify: `src/pages/search/ui/SearchDesktop/SearchDesktop.test.tsx`

- [ ] Написать тест в `describe`-блоке рядом с существующими сценариями
      сайдбара: `renderSearchDesktop(['/search?type=movie'])`, замокать
      каталожный эндпоинт через уже существующий в файле хелпер
      `mockCatalog([catalogDoc(...)])` (`onUnhandledRequest: 'error'` в MSW
      требует мока перед рендером)
- [ ] Ассерт: `within(document.querySelector('aside')!).getByRole('button',
      { name: /^Movies/ })` — `className` матчит `/radioRowActive/`
      (прецедент class-based ассерта на активный элемент —
      `SearchDesktop.test.tsx:436`, `SearchDesktop.test.tsx:545` для
      обращения к кнопке типа в сайдбаре)
- [ ] Ассерт: соседние кнопки "Series"/"Anime" в том же сайдбаре — `className`
      НЕ матчит `/radioRowActive/` (негативная проверка, что активен именно
      выбранный тип, а не все радио-кнопки разом)
- [ ] Прогнать тесты (`make test`) — должны пройти перед следующей задачей

### Task 3: Проверить критерии приёмки

- [ ] Проверить, что все требования из Обзора реализованы (и поле поиска, и
      переключатель типа реально управляют навигацией на `/search`)
- [ ] Проверить граничные случаи (пустой запрос, тип не выбран, оба
      заданы, задан только тип)
- [ ] Проверить, что сайдбар `/search` синхронизируется с типом из
      hero-навигации в browse-режиме, и корректно игнорирует его в
      text-search режиме (Task 2)
- [ ] Прогнать полный набор тестов: `make test`
- [ ] Прогнать `make lint` и `make typecheck`
- [ ] Подтвердить отсутствие e2e-сьюта (шаг пропущен, уже отмечено в
      Стратегии тестирования)

### Task 4: [Final] Обновить документацию

- [ ] Добавить в `plans/roadmap.md`, раздел 1.2 "Поиск с debounce" (после
      строки про `Min length 2 + trim`), новый пункт `[x]`: хиро-поиск
      главной страницы (`HeroSection`) — вторая точка входа в `/search`,
      использует тот же `QUERY_MIN_LENGTH`/`filtersToSearchParams`
      контракт, что и `Header`, но пишет URL по явному сабмиту, а не
      live-дебаунсом
      — сослаться на этот план файлом
- [ ] Обновить `AGENTS.md`, только если эта связка вводит новый переиспользуемый
      паттерн сверх уже задокументированного — переиспользование
      `filtersToSearchParams`/`FilterState`/`QUERY_MIN_LENGTH` из двух точек
      входа (`Header`, `HeroSection`) стоит явно упомянуть в разделе Data
      state как общий контракт "поиск → URL", если там такого пункта ещё
      нет
- [ ] Переместить этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка:**

- Открыть `/` в браузере, ввести запрос (например "dune"), выбрать
  "Series", нажать Enter — убедиться, что попадаем на
  `/search?type=series&q=dune`, сетка результатов показывает результаты
  текстового поиска, а фильтры сайдбара задизейблены (существующее
  поведение text-search на `/search`).
- Кликнуть "Search" при пустом поле и выбранном "Everything" — убедиться,
  что попадаем на `/search` с browse-каталогом (без фильтров, без
  текстового поиска).
- Открыть `/`, выбрать "Movies" без ввода текста, нажать "Search" —
  убедиться, что попадаем на `/search?type=movie` и радио-кнопка "Movies" в
  сайдбаре уже активна.
