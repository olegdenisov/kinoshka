# Интерактивный слайдер диапазона годов

## Обзор

Группа фильтра "Year" в сайдбаре каталога/поиска (desktop `SearchSidebar`) и её мобильный аналог
(`SearchMobile`) сейчас рендерят **чисто декоративный** двухползунковый слайдер: трек с двумя
ползунками, зафиксированными на `left: 60%` / `left: 95%`, без единого `<input>`, без обработки
drag, без связи с `filters.yearFrom`/`filters.yearTo`. Взаимодействовать с ним невозможно вообще.

Этот план заменяет эту вёрстку на настоящий интерактивный двухползунковый слайдер, построенный на
двух перекрывающихся нативных `<input type="range">`, встроенный в уже существующий пайплайн
`FilterState`/URL/API (`useFilterState`, `filtersToParams`, `getMoviesPage`/`getSearchMovies`),
который уже полностью поддерживает `yearFrom`/`yearTo` — это пробел исключительно в UI, а не в
слое данных.

## Контекст (по итогам разведки)

- **Декоративная вёрстка, которую нужно заменить:**
  - `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx` (desktop, строки ~95–107) +
    соответствующие классы в `SearchSidebar.module.css` (`.yearDisplay`, `.rangeTrack`,
    `.rangeFill`, `.rangeThumb*`)
  - `src/pages/search/ui/SearchMobile.tsx` (строки ~545–620) — та же визуальная вёрстка,
    продублирована как inline-стили (мобильные страницы не имеют CSS-модуля, см. `AGENTS.md`)
  - Оба места хардкодят `1970`/`2025` как дефолты отображения и `60%`/`95%` позиции ползунков —
    ничего из этого не читает и не пишет `filters.yearFrom`/`filters.yearTo`.
- **Уже подключено, изменений не требует:**
  - `FilterState.yearFrom`/`yearTo` (`src/features/catalog-filter/model/useFilterState.ts`) —
    независимые nullable-поля, единственный источник истины — URL через `useSearchParams`.
  - `filtersToParams.ts` — превращает `yearFrom`/`yearTo` в параметр API `year: ["from-to"]`, уже
    обрабатывает случай открытого диапазона (задана только одна сторона) через собственные
    `YEAR_RANGE_MIN`/`MAX` (1874/2050, документированные границы API — не связаны с UI-границами
    самого слайдера, см. ниже).
  - `searchParams.ts` — `getFilterFromSearchParams`/`filtersToSearchParams` уже читают/пишут
    `yearFrom`/`yearTo` в URL, с zod-валидацией.
  - `activeChips` в `useFilterState` — уже рендерит чип "2020–2025" / "2020+" / "–2010" и рабочий
    `onRemove`, обнуляющий оба поля.
- **Паттерн, которому нужно следовать:** `GenreSelector`
  (`src/features/catalog-filter/ui/GenreSelector/`) — прецедент «один общий компонент, две
  responsive-точки использования», та же форма, что и у `ActiveFilterChips`. Он принимает проп
  `compact?: boolean` для мобильного варианта размера чипов вместо внутреннего `@media`-запроса
  (оба call site никогда не рендерятся одновременно, см. `useViewport`). `YearRangeSlider`
  повторяет ту же структуру директории (`ui/YearRangeSlider/{index.tsx, YearRangeSlider.tsx,
  YearRangeSlider.module.css, YearRangeSlider.test.tsx}`) и тот же паттерн пропа `compact`.
- **Тестов пока нет** ни на секцию Year в `SearchSidebar` (файла тестов вообще нет), ни в
  `SearchMobile.test.tsx` — новые тесты аддитивны, ничего не мигрируют.

## Подход к разработке

- **Подход к тестированию:** Regular (сначала реализация, потом тесты/обновление тестов на каждой задаче).
- Каждую задачу доводить до конца перед переходом к следующей; запускать тесты после каждого изменения.
- **КРИТИЧНО: каждая задача ДОЛЖНА включать новые/обновлённые тесты** — это не опционально.
- **КРИТИЧНО: все тесты должны проходить перед началом следующей задачи.**
- Обновлять этот файл плана при изменении объёма работ по ходу реализации.

## Обзор решения

**Компонент:** `YearRangeSlider` в `@features/catalog-filter/ui`, полностью управляемый пропами
(`yearFrom`, `yearTo`, `onChange`, `disabled?`, `compact?`) — без внутреннего знания об URL/роутере,
по форме аналогичен `GenreSelector`.

**Границы слайдера:** `YEAR_SLIDER_MIN = 1900`, `YEAR_SLIDER_MAX = new Date().getFullYear()`
(текущий год, вычисляется в момент рендера, не хардкодится — слайдер никогда не отстаёт от
реальности). Это границы UI/drag, отдельные от `YEAR_RANGE_MIN`/`MAX` (1874/2050) в
`filtersToParams.ts`, которые кодируют собственный фолбэк открытого диапазона API и остаются
без изменений — любое значение, которое может выдать слайдер, и так укладывается внутрь них.

**Механика двух ползунков — два перекрывающихся нативных input, а не самописный pointer-drag:**
два `<input type="range">`, абсолютно наложенных друг на друга на одном треке.
- "from"-input: `min={YEAR_SLIDER_MIN}`, `max={currentTo}` (cross-linked на живое значение другого
  ползунка).
- "to"-input: `min={currentFrom}`, `max={YEAR_SLIDER_MAX}`.

  Такой cross-link по min/max заставляет сам браузер не давать ползункам пересекаться — без
  ручной математики клэмпинга. Это стандартная, хорошо известная техника для двухползункового
  range на нативных input (в противовес самописному слайдеру на pointer-событиях), и она даёт
  нативную клавиатурную поддержку (стрелки), фокус и семантику для скринридеров бесплатно — в
  проекте нет библиотеки для drag/жестов, так что это ещё и вариант с наименьшим объёмом кода.
- У каждого input `pointer-events: none` целиком, кроме собственного псевдоэлемента-ползунка
  (`::-webkit-slider-thumb` / `::-moz-range-thumb` получают `pointer-events: auto`), так что оба
  ползунка остаются независимо перетаскиваемыми даже при полном наложении input'ов. Нативный трек
  красится прозрачным; отдельная пара абсолютно позиционированных div'ов (существующая визуальная
  часть `.rangeTrack`/`.rangeFill`, перенесённая из текущей декоративной вёрстки) рисует видимый
  трек/заливку, позиционируясь через inline `style` в процентах, вычисленных из двух значений.

**Коммит по отпусканию:** локальный `useState` зеркалит `[from, to]` для живой визуальной обратной
связи во время drag (`onChange` React на каждом `<input>` срабатывает как нативное событие
`input` — то есть на каждом промежуточном тике, а не только в конце — поэтому он только
обновляет локальный стейт). Проп `onChange` родителя (→ `setFilters`/URL/рефетч API) срабатывает
один раз, по `onMouseUp`/`onTouchEnd` **и** `onKeyUp` — pointer-drag порождает только
`mouseup`/`touchend`, но клавиатурное изменение (стрелки, Home/End) не порождает ни то, ни другое,
поэтому `onKeyUp` необходим, чтобы вообще коммитить изменения с клавиатуры; без него клавиатурный
пользователь мог бы двигать слайдер, но изменение никогда бы не сохранялось. Локальный стейт
пересинхронизируется с пропами при монтировании и при любом внешнем изменении
`yearFrom`/`yearTo` (например "Reset filters" или удаление чипа) через `useEffect`.

**Полный диапазон = отсутствие фильтра:** если закоммиченная пара `[from, to]` равна
`[YEAR_SLIDER_MIN, YEAR_SLIDER_MAX]` (дефолтная, нетронутая позиция слайдера), `onChange`
вызывается с `(null, null)`, а не с буквальными числами границ — это держит URL чистым, следуя
конвенции `filtersToSearchParams` "не писать пустые/дефолтные поля". Любая другая позиция вызывает
`onChange(from, to)` с обоими заданными числами.

**Доступность:** оба input получают `aria-label` ("Year from" / "Year to"), поскольку видимого
`<label>`, привязанного к ним, нет (числовой readout над треком — презентационный, не label).

## Технические детали

- Новые файлы, `src/features/catalog-filter/ui/YearRangeSlider/`:
  - `YearRangeSlider.tsx` — компонент + константы `YEAR_SLIDER_MIN`/`YEAR_SLIDER_MAX`
    (экспортируются для тестов).
  - `YearRangeSlider.module.css` — трек/заливка (перенесены из `SearchSidebar.module.css`'s
    `.rangeTrack`/`.rangeFill`), прозрачный нативный трек, кастомные стили ползунка
    (`::-webkit-slider-thumb`/`::-moz-range-thumb`), вариант `compact` для мобильной версии
    (крупнее ползунок, соответствует текущему мобильному inline-размеру: 18px против desktop 12px).
  - `index.tsx` — `export { YearRangeSlider } from './YearRangeSlider'`.
  - `YearRangeSlider.test.tsx`.
- `SearchSidebar.tsx`: заменить статичный блок Year на `<YearRangeSlider yearFrom={filters.yearFrom} yearTo={filters.yearTo} onChange={(yearFrom, yearTo) => onFiltersChange({ ...filters, yearFrom, yearTo })} disabled={disabled} />`.
- `SearchSidebar.module.css`: удалить ставшие неиспользуемыми `.yearDisplay`, `.rangeTrack`,
  `.rangeFill`, `.rangeThumb`, `.rangeThumbLeft`, `.rangeThumbRight` (логика/вёрстка переезжают в
  собственный модуль компонента).
- `SearchMobile.tsx`: заменить inline-стилевой блок Year (строки ~545–620) на
  `<YearRangeSlider ... compact />`, та же связка через `setFilters` страницы, что и выше.
- `AGENTS.md`: добавить `YearRangeSlider` в строку `@features/catalog-filter` таблицы "Key public
  APIs".

## Что куда идёт

- **Шаги реализации** (`[ ]`): компонент + стили + тесты, интеграция в оба call site, обновление
  документации.
- **После завершения**: ручная проверка drag/клавиатуры в реальном браузере (jsdom/RTL умеют
  симулировать события `change`/`pointerup`, но не реальную физику pointer-drag и не реальное
  кросс-браузерное поведение z-index/click-through у ползунков).

## Шаги реализации

### Task 1: Собрать компонент `YearRangeSlider` с двумя перекрывающимися range-input'ами

**Файлы:**
- Создать: `src/features/catalog-filter/ui/YearRangeSlider/YearRangeSlider.tsx`
- Создать: `src/features/catalog-filter/ui/YearRangeSlider/YearRangeSlider.module.css`
- Создать: `src/features/catalog-filter/ui/YearRangeSlider/index.tsx`
- Создать: `src/features/catalog-filter/ui/YearRangeSlider/YearRangeSlider.test.tsx`

- [ ] создать `YearRangeSlider.tsx`: пропы `{ yearFrom: number | null; yearTo: number | null; onChange: (yearFrom: number | null, yearTo: number | null) => void; disabled?: boolean; compact?: boolean }`, локальный `useState<[number, number]>`, зеркалящий `[yearFrom ?? YEAR_SLIDER_MIN, yearTo ?? YEAR_SLIDER_MAX]`, пересинхронизируется через `useEffect` при изменении пропов
- [ ] отрендерить два `<input type="range">`, cross-linked через `min`/`max` (`max` у from-input = текущее значение `to`, `min` у to-input = текущее значение `from`), чтобы браузер не давал ползункам пересекаться; обновлять локальный стейт на `onChange` каждого input
- [ ] коммит родителю: по `onMouseUp`/`onTouchEnd`/`onKeyUp` (оба input) вызывать `props.onChange(from, to)`, переводя `[YEAR_SLIDER_MIN, YEAR_SLIDER_MAX]` (нетронутый полный диапазон) в `(null, null)`
- [ ] добавить `aria-label` ("Year from" / "Year to") на каждый input; учитывать проп `disabled` на обоих input
- [ ] создать `index.tsx` с реэкспортом
- [ ] написать тесты: рендерится с range-input'ами, помеченными `aria-label`, с корректными начальными значениями (из пропов и из `null`/`null`, дающего дефолт — полный диапазон)
- [ ] написать тесты: перетаскивание (fireEvent.change) "from"-input за значение "to" ограничено cross-linked атрибутом `max` (проверять сам атрибут, поскольку jsdom не соблюдает нативный клэмпинг range)
- [ ] написать тесты: `onChange` НЕ вызывается на промежуточных событиях `change`, но вызывается один раз на `mouseup`/`touchend` с закоммиченными значениями
- [ ] написать тесты: `onChange` также вызывается на `keyup` (коммит по клавиатуре, без участия `mouseup`/`touchend`)
- [ ] написать тесты: коммит обратно к полному дефолтному диапазону вызывает `onChange(null, null)`
- [ ] написать тесты: проп `disabled` дизейблит оба input
- [ ] прогнать тесты — должны проходить перед задачей 2

### Task 2: Стилизовать `YearRangeSlider` (desktop + compact-вариант для мобильной версии)

**Файлы:**
- Изменить: `src/features/catalog-filter/ui/YearRangeSlider/YearRangeSlider.module.css`
- Изменить: `src/features/catalog-filter/ui/YearRangeSlider/YearRangeSlider.test.tsx`

- [ ] перенести визуал `.rangeTrack`/`.rangeFill` из `SearchSidebar.module.css` в новый модуль, ширина/позиция заливки вычисляется из `(value - min) / (max - min) * 100%` через inline `style`
- [ ] стилизовать оба `<input type="range">` как полностью прозрачные оверлеи (`appearance: none`, прозрачные псевдоэлементы трека, `pointer-events: none` на input, `pointer-events: auto` + видимый ползунок только на `::-webkit-slider-thumb`/`::-moz-range-thumb`)
- [ ] добавить класс варианта `compact` (18px ползунок, соответствует текущему inline-размеру `SearchMobile`, против 12px на desktop), применяется при заданном пропе `compact`
- [ ] использовать дизайн-токены (`--accent-warm`, `--text-primary`, `--border-subtle`) вместо хардкоженных hex, заменяя сырые цвета, сейчас захардкоженные в inline-стилях `SearchMobile.tsx`
- [ ] написать/обновить тесты: проп `compact` применяет compact-класс к корневому элементу
- [ ] прогнать тесты — должны проходить перед задачей 3

### Task 3: Интегрировать в `SearchSidebar` (desktop)

**Файлы:**
- Изменить: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx`
- Изменить: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.module.css`
- Изменить: `src/features/catalog-filter/index.ts`
- Создать: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.test.tsx`

- [ ] экспортировать `YearRangeSlider` из `src/features/catalog-filter/index.ts`
- [ ] заменить статичный блок Year в `SearchSidebar.tsx` на `<YearRangeSlider yearFrom={filters.yearFrom} yearTo={filters.yearTo} onChange={(yearFrom, yearTo) => onFiltersChange({ ...filters, yearFrom, yearTo })} disabled={disabled} />`
- [ ] удалить ставшие неиспользуемыми классы `.yearDisplay`/`.rangeTrack`/`.rangeFill`/`.rangeThumb*` из `SearchSidebar.module.css`
- [ ] написать тесты (новый файл): `SearchSidebar` рендерит `YearRangeSlider`, связанный с `filters.yearFrom`/`yearTo`, коммит drag вызывает `onFiltersChange` с обновлённым `FilterState` (остальные поля сохранены)
- [ ] написать тесты: проп `disabled` пробрасывается в слайдер
- [ ] прогнать тесты — должны проходить перед задачей 4

### Task 4: Интегрировать в `SearchMobile`

**Файлы:**
- Изменить: `src/pages/search/ui/SearchMobile.tsx`
- Изменить: `src/pages/search/ui/SearchMobile.test.tsx`

- [ ] заменить inline-стилевой блок Year (строки ~545–620) в `SearchMobile.tsx` на `<YearRangeSlider yearFrom={filters.yearFrom} yearTo={filters.yearTo} onChange={(yearFrom, yearTo) => setFilters({ ...filters, yearFrom, yearTo })} compact />`
- [ ] написать/обновить тесты в `SearchMobile.test.tsx`: слайдер Year рендерится, коммит drag обновляет filters/URL так же, как это делают существующие кнопки Rating
- [ ] прогнать тесты — должны проходить перед задачей 5

### Task 5: Проверить критерии приёмки

- [ ] проверить, что все требования из Обзора реализованы (интерактивный двухползунковый слайдер годов на desktop и mobile, встроен в существующий пайплайн `FilterState`/URL/API)
- [ ] проверить edge-кейсы: полный диапазон → `(null, null)`, ползунки не пересекаются, состояние `disabled`, deep-link только с `yearFrom` или только с `yearTo` (асимметричная позиция слайдера) корректно рендерится
- [ ] прогнать полный набор тестов: `make test`
- [ ] прогнать `make check` (lint + build)

### Task 6: [Финал] Обновить документацию

- [ ] добавить `YearRangeSlider` в строку `@features/catalog-filter` таблицы "Key public APIs" в `AGENTS.md`
- [ ] перенести этот план в `docs/plans/completed/`

## После завершения

**Ручная проверка:**
- перетащить оба ползунка мышью и тачем (мобильный viewport) в реальном браузере — убедиться в
  плавном визуальном отслеживании во время drag и в единственном закоммиченном обновлении
  URL/сети по отпусканию
- клавиатурное взаимодействие: Tab к каждому ползунку, изменение стрелками/Home/End, убедиться,
  что URL коммитится через обработчик `onKeyUp` из задачи 1
- убедиться, что клики не теряются: при близких друг к другу ползунках у любого края диапазона
  проверить, что оба остаются независимо перетаскиваемыми (подтверждает работу трюка с
  `pointer-events` в Chrome/Firefox/Safari)
