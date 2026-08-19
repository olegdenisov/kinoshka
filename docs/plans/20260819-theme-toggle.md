# Theme toggle 🌙 (roadmap 2.2)

## Overview

Пункт 2.2 из `plans/roadmap.md` (Фаза 2 — Advanced-фичи). Сейчас все CSS-токены в `src/app/styles/global.css` — dark-only (`:root { --bg-primary: #0F0D11; ... }`), переключателя темы нет. Задача — добавить светлую палитру, `features/theme/` с моделью `'light' | 'dark' | 'system'`, persist в localStorage, toggle-кнопку в UI, без FOUC.

**Расширение скоупа по решению пользователя:** светлая тема должна работать во **всём** приложении, включая `HomeMobile`/`SearchMobile`/`MovieMobile`/`FavoritesMobile` — flat-компоненты без CSS-модуля (инлайн-стили с хардкод-хексами вперемешку с `var(--...)`). Попутно их инлайн-стили выносятся в CSS-модули по обычному паттерну проекта (`Component/index.tsx` + `Component.module.css`) — иначе хардкод-хексы не отреагируют на `data-theme="light"`.

**Важно (найдено на этапе planning-review, подтверждено чтением кода):** хардкод-цвета есть не только в четырёх flat-файлах, но и в нескольких уже существующих CSS-модулях (`BottomNav`, `HeroSection`, `MovieHero`, `MobileCard`, `Card`, `Poster`) и в JS-градиенте `MovieMobile.tsx`, где `#0F0D11` вклеен прямо в строку `linear-gradient(...)`. Без их учёта светлая тема будет выглядеть сломанной даже после миграции четырёх основных файлов. План это покрывает отдельной задачей аудита (Task 8) и явным паттерном для динамических градиентов (Task 12).

Toggle размещается в обоих Header-компонентах (`Header` desktop + `MobileHeader`), кнопка — двухпозиционная `light ⇄ dark` (без прямого переключения в `system`; `system` используется только как начальное значение при первом визите, до явного выбора пользователя).

## Context (from discovery)

- `src/app/styles/global.css` — все токены в одном безусловном `:root {}`, без `@media (prefers-color-scheme)` и без `[data-theme]`.
- Аналогичный уже реализованный клиентский feature без API — `src/features/favorites/`: `model/favoritesStorage.ts` (`createStorageSlot(key, zodSchema, fallback)`) + `model/useFavorites.ts` (обёртка над `useStorageSlot`) + публичный `index.ts`. Тот же паттерн (`createStorageSlot` + `useStorageSlot`, cross-tab sync через `storage`-event) подходит для темы почти без изменений — см. `src/shared/lib/storage/storage.ts`, `useStorageSlot.ts`. **Важно:** `createStorageSlot.set()` пишет `JSON.stringify(value)` — то есть в `localStorage` значение темы лежит как `"light"` (в кавычках), не как raw-строка. Любой код, читающий этот ключ напрямую (no-FOUC script), должен делать `JSON.parse`, а не сравнивать raw-строку.
- `index.html` — три Google Fonts, `<div id="root">`, `<script type="module" src="/src/main.tsx">`. Никакого inline-скрипта в `<head>` пока нет.
- `src/widgets/header/ui/Header/Header.tsx` — desktop header, есть внутренний `IconButton` (`../IconButton`, не экспортируется публично), используемый для search/notifications/clear-query (4 использования, все в `Header.tsx`).
- `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.tsx` — **не использует `IconButton`**: его кнопки — обычные `<button className={s.backBtn}>` / `<button className={s....}>` со своими классами в `MobileHeader.module.css` (уже полностью на `var(--...)`, миграция не нужна). `ThemeToggle` в этом месте не обязан знать про `IconButton` — он рендерит `IconButton` изнутри себя (единая точка).
- `src/shared/ui/Icon/Icon.tsx` — все иконки как inline SVG React-компоненты, экспорт через `src/shared/ui/Icon/index.tsx` → `@shared/ui`. Нет `SunIcon`/`MoonIcon` — добавляются по тому же паттерну (`size` проп, `viewBox='0 0 24 24'`, `stroke='currentColor'`).
- **`window.matchMedia` не используется в проекте вообще** (`grep -rn matchMedia src/` — пусто) и не заглушен в `src/test/setup.ts`. jsdom (тестовое окружение, `vite.config.ts` → `test.environment: 'jsdom'`) не предоставляет `matchMedia` из коробки — без стаба любой тест, монтирующий компонент с `useTheme()`, упадёт с `window.matchMedia is not a function`. Это касается не только тестов темы — `Header.test.tsx` и `SearchMobile.test.tsx` (после Task 7/12) тоже начнут монтировать `ThemeToggle`/пройденный через тему layout.
- **Хардкод-цвета вне четырёх flat-файлов** (подтверждено чтением, не только `grep`):
  - `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.module.css:7` — `background: rgba(15, 13, 17, 0.92)` — фон мобильного bottom-nav, чистый UI-chrome элемент → должен тонироваться.
  - `src/pages/home/ui/HeroSection/HeroSection.module.css:68,185` — `rgba(24, 22, 27, 0.7 / 0.6)` — фон чипов/оверлея на hero-баннере (поверх фонового изображения) → вероятно намеренный скрим, но нужно свериться визуально.
  - `src/pages/movie/ui/MovieHero/MovieHero.module.css:30-31` — `rgba(15, 13, 17, 0.3 / 0.7)` — градиент-скрим поверх backdrop-изображения фильма → скорее всего намеренный (нужен для читаемости текста над произвольной картинкой независимо от темы).
  - `src/entities/movie/ui/MobileCard/MobileCard.module.css:26,47` — `rgba(15, 13, 17, 0.75)` — фон беджа/оверлея на карточке (поверх постера) → нужно смотреть по месту, вероятно скрим.
  - `src/entities/movie/ui/Card/Card.module.css:96` — `color: rgba(242, 240, 239, 0.7)` — цвет текста (не над изображением) → это UI-chrome, должен тонироваться.
  - `src/entities/movie/ui/Poster/Poster.module.css:6,15-16,28,51,64` — `rgba(255,255,255,...)` инсет-хайлайты и `rgba(242,240,239,0.55/0.85)` текст-плейсхолдер поверх сгенерированного (не фотографического) плейсхолдера-постера. `Poster.tsx` сам строит `hue`-градиент через `oklch(...)` без хардкод-хексов (уже theme-agnostic по конструкции) — вопрос только по оверлеям в `.module.css`.
  - `src/pages/movie/ui/MovieMobile.tsx` строки ~194 и ~204 — JS-градиент буквально содержит `#0F0D11` как часть строки (`` `radial-gradient(...), #0F0D11` `` и `` `linear-gradient(180deg, rgba(15,13,17,0.2) 0%, rgba(15,13,17,0.8) 70%, #0F0D11 100%)` ``) — это **не** покрывается общим правилом «динамические значения остаются инлайн `style`», потому что хардкод-часть градиента статична, а меняется только `movie.hue`. Нужен отдельный паттерн (Task 12).
  - `HomeMobile.tsx` — аналогичный (но простой, без hue) кейс: `background: '#0F0D11'` и `'linear-gradient(180deg, transparent 50%, #0F0D11 100%)'` — оба заменяются на `var(--bg-primary)` без осложнений (никакой динамики внутри градиента нет).
- **`src/pages/search/ui/SearchMobile.test.tsx:567`** — тест **прямо проверяет инлайн-стиль**: `expect(activeBtn.style.background).toBe('rgba(209, 142, 95, 0.15)')`. Это единственное место, где предположение «миграция на CSS-модуль ничего не ломает в тестах» неверно — тест придётся переписать на проверку класса/`aria-current`, а не инлайн-цвета.
- Импорты mobile page-компонентов — без расширения (`import { HomeMobile } from './ui/HomeMobile'` в `HomePage.tsx`, аналогично `SearchPage.tsx`/`MoviePage.tsx`/`FavoritesPage.tsx`) — при переносе `HomeMobile.tsx` → `HomeMobile/{HomeMobile.tsx, index.tsx}` **сами импорты не меняются** (резолвится на `index.tsx` директории), меняется только физическое расположение файла + co-located тест (`MovieMobile.test.tsx`, `SearchMobile.test.tsx`, `FavoritesMobile.test.tsx` переезжают в новую директорию; `HomeMobile` теста не имеет).
- `src/index.css` — мёртвый файл (дефолтный Vite-темплейт), не импортируется ни из `index.html`, ни из `src/` (проверено `grep`). Содержит собственный `color-scheme: light dark` и `@media (prefers-color-scheme: dark)` блок — прямо по теме задачи, но не подключён и будет путать. Удаляется в рамках этой задачи (Task 14).
- AGENTS.md (`## Responsive pattern`) документирует нынешнее положение: «`HomeMobile`, `SearchMobile`, `MovieMobile` — flat `.tsx` файлы без CSS-модуля». После этой задачи утверждение станет неверным — обновляется в Task 14.

## Development Approach

- **Testing approach**: Regular (код → тесты).
- Полностью реализовывать и тестировать одну задачу, потом переходить к следующей.
- **Порядок**: сначала фича темы (токены → модель → hook → no-FOUC script → toggle UI → wiring), затем аудит существующих CSS-модулей (Task 8), затем миграция четырёх flat-файлов (Task 9–12, с учётом паттерна для динамических градиентов), затем верификация и документация.
- Миграция инлайн-стилей — **визуальный рефакторинг**: разметка и поведение не меняются, только `style={{...}}` → `className={s.xxx}` + хардкод-хекс → `var(--...)`. Единственное известное исключение — `SearchMobile.test.tsx:567`, который явно правится в Task 11. Для остальных случаев «тесты» = «существующий тест-файл остаётся зелёным (после переноса в новую директорию, без изменения содержимого) + визуальная проверка light/dark в браузере».
- Для логики (`themeStorage`, `resolveTheme`, `useTheme`) — тесты обязательны, по образцу `src/features/favorites/model/*.test.ts(x)`.
- Никакой CSS-анимации/transition на переключение темы не добавляется — переключение остаётся мгновенным (O(1) по одному атрибуту, без перерисовки дерева), поэтому `prefers-reduced-motion` для этой задачи не релевантен.
- `make check` (lint + build) и `make test` — зелёные перед переходом к следующей задаче.
- React Compiler включён — не добавлять `useMemo`/`useCallback` вручную.

## Testing Strategy

- **Unit-тесты**: `themeStorage`, `resolveTheme`, `useTheme` (persist, cross-tab sync, применение `data-theme` на `document.documentElement`, реакция на `prefers-color-scheme` в режиме `system`) — по образцу `favoritesStorage.test.ts`/`useFavorites.test.ts`.
- **Инфраструктура тестов**: `src/test/setup.ts` получает глобальный стаб `window.matchMedia` (иначе всё, что рендерит `ThemeToggle`/`useTheme`, падает в jsdom) — см. Task 4.
- **Визуальная проверка** (замена unit-тестов для CSS-рефакторинга): каждую мигрированную страницу/секцию открыть в браузере (`make dev`) в light и dark, сверить с исходным видом (dark не должен визуально измениться вообще).
- **E2E**: в проекте пока нет Playwright/E2E-инфраструктуры (появится в 2.5.5) — не заводим.
- Итоговая проверка чек-листа 2.2 из roadmap — в Task 13.

## Solution Overview

- **Токены**: текущий безусловный `:root { ... }` в `global.css` остаётся dark-палитрой без изменений — отсутствие атрибута `data-theme` трактуется как dark (отдельного `:root[data-theme='dark']`-дубликата не заводим, чтобы не иметь два места с одинаковыми значениями). Светлая палитра — новый блок `:root[data-theme='light'] { ... }` с тем же набором переменных.
- **Модель**: `type Theme = 'light' | 'dark' | 'system'`, хранится в `localStorage` (`kinoshka:theme`) через `createStorageSlot` — паттерн 1:1 с `favoritesStorage.ts`.
- **`useTheme()`**: читает/пишет `Theme` через `useStorageSlot`; `prefersDark` — через `window.matchMedia('(prefers-color-scheme: dark)')` с подпиской на `change`; `resolvedTheme = resolveTheme(theme, prefersDark)` (чистая функция, Task 3); `useEffect` синхронизирует `document.documentElement.setAttribute('data-theme', resolvedTheme)`. `toggleTheme()` переключает только `'light'` ⇄ `'dark'` (по `resolvedTheme`, не по `theme`, — иначе toggle из `system`-состояния не даст предсказуемого результата); `setTheme(next)` — прямая установка, используется самим `toggleTheme` внутри (не мёртвый API).
- **No-FOUC**: inline `<script>` в `<head>` `index.html`, синхронно перед первым рендером. Читает `localStorage.getItem('kinoshka:theme')`, **`JSON.parse`** результат (значение хранится в кавычках — см. Context), при `'system'`/отсутствии/невалидном значении/исключении — падает на `matchMedia('(prefers-color-scheme: dark)').matches` (единый fallback, тот же смысл что и `resolveTheme('system', prefersDark)` в hook'е — **не** захардкоженный `dark`, иначе на светлой ОС с заблокированным `localStorage` скрипт закрасит страницу тёмным, а `useTheme()` сразу перекрасит в светлый — самопроизвольный FOUC ровно там, где скрипт должен его предотвращать). Оборачивается в `try/catch` целиком.
- **Toggle UI**: компонент `ThemeToggle` (`features/theme/ui/ThemeToggle/`) — иконка Sun/Moon (`SunIcon`/`MoonIcon`, новые в `@shared/ui`) внутри `IconButton`. **`IconButton` переносится из `src/widgets/header/ui/IconButton/` в `src/shared/ui/IconButton/`** — он не специфичен для Header (его `.module.css` уже полностью на `var(--...)`, ничего Header-специфичного), а `features/theme` не может по FSD-направлению (`pages → widgets → features → entities → shared`) импортировать из `widgets/header`. `Header.tsx` (4 использования) переключается на импорт из `@shared/ui`; локальная копия в `widgets/header/ui/IconButton` удаляется. `MobileHeader.tsx` не использует `IconButton` вообще и не обязан — `ThemeToggle` инкапсулирует его сам.
- **Миграция mobile-файлов**: для каждого — перенос в `Component/{Component.tsx, Component.module.css, index.tsx}` (стандартный паттерн проекта, не флэт-файл рядом с самим собой), co-located тест (где есть) переезжает туда же без изменения содержимого (кроме `SearchMobile.test.tsx:567`, см. Task 11). Каждый хардкод-хекс/rgba → `var(--...)`. Динамические значения (высоты, `transform` по scroll и т.п.) остаются инлайн `style`. Для градиентов, где хардкод смешан с динамическим значением (`MovieMobile.tsx`, `hue`) — динамическая часть передаётся через CSS custom property (`style={{ '--hue': movie.hue }}`), а сам градиент, включая цвет фона, описывается в `.module.css` через `var(--hue)`/`var(--bg-primary)` (см. Task 12).
- **Аудит существующих CSS-модулей** (Task 8): для каждого найденного хардкода — решение «тонировать» (UI-chrome цвет, не связан с конкретным изображением) или «оставить как скрим» (сознательный оверлей на произвольном фотографическом фоне — постере/backdrop'е, где полу-прозрачный тёмный слой нужен для контраста независимо от темы приложения), с коротким комментарием в коде для второго случая.

## Technical Details

- **Ключ localStorage**: `kinoshka:theme`.
- **Zod-схема**: `z.enum(['light', 'dark', 'system'])`, fallback `'system'`.
- **Атрибут**: `data-theme` на `<html>` (не `<body>`).
- **`color-scheme`**: `color-scheme: dark` в безусловном `:root`, `color-scheme: light` в `:root[data-theme='light']` — влияет на нативные контролы (скроллбары, автозаполнение, и оба `<input type="range">` в `YearRangeSlider`), которые иначе останутся с OS-дефолтным (обычно светлым) видом на тёмной теме и наоборот.
- **Светлая палитра** (ориентир для Task 1, финальные значения подбираются по контрасту WCAG AA):
  - Тёплый off-white для `--bg-primary`/`--bg-secondary` (не чистый `#FFFFFF`).
  - `--text-primary` — тёмный, не чистый чёрный.
  - `--accent-warm`/`--accent-warm-hover`/`--accent-rating` — при необходимости чуть затемнить для контраста на светлом фоне.
  - `--border-*`/`--bg-chip`/`--bg-glass*` — alpha-каналы сейчас рассчитаны как светлый оттенок поверх тёмного фона; на светлом фоне нужен инвертированный (тёмный оттенок с той же/близкой alpha).
  - `--overlay-backdrop`, `--shadow-color` — вероятно не требуют изменения, проверить визуально.
  - `--avatar-gradient` (oklch) — оставить как есть или адаптировать по вкусу.
- **`prefers-color-scheme` двойное использование**: в no-FOUC script (начальный resolve при `system`) и в `useTheme()` (живая реакция на смену системной темы). Логика вынесена в чистую `resolveTheme(theme, prefersDark)` (`features/theme/lib/`) — используется в hook'е; в самом `<script>` (не может импортировать модуль) — эквивалентная инлайновая логика, без дублирования сложного кода (там всего одна ветка `system` → matchMedia).

## What Goes Where

- **Implementation Steps** (`[ ]`): токены+color-scheme, модель, hook, no-FOUC script, toggle UI (+ перенос IconButton), wiring в оба Header, аудит существующих CSS-модулей, миграция 4 mobile-файлов, verify, документация.
- **Post-Completion**: ручная визуальная приёмка на Safari/Firefox и реальном мобильном устройстве, отложенный Lighthouse-контраст-аудит.

## Implementation Steps

### Task 1: Светлая палитра токенов + `color-scheme` в `global.css`

**Files:**

- Modify: `src/app/styles/global.css`

- [x] Добавить блок `:root[data-theme='light'] { ... }` с полным набором light-эквивалентов всех переменных из текущего `:root` (bg-\*, text-\*, accent-\*, border-\*, overlay-backdrop, bg-glass\*, shadow-color; `avatar-gradient` — по вкусу)
- [x] Добавить `color-scheme: dark` в безусловный `:root` и `color-scheme: light` в `:root[data-theme='light']`
- [x] Проверить контраст текст/фон по ключевым парам (`--text-primary`/`--bg-primary`, `--text-secondary`/`--bg-secondary`) на соответствие WCAG AA (≥ 4.5:1)
- [x] Убедиться, что текущий безусловный `:root {}` (dark) не тронут — визуальный диф dark-темы должен быть нулевым
- [x] Тесты не требуются (чистый CSS, нет логики) — проверка визуально в Task 5 (no-FOUC) и Task 13
- [x] `make lint`/`make build` — чисто

### Task 2: `themeStorage` — модель хранения темы

**Files:**

- Create: `src/features/theme/model/themeStorage.ts`
- Create: `src/features/theme/model/themeStorage.test.ts`

- [x] `createStorageSlot('kinoshka:theme', z.enum(['light', 'dark', 'system']), 'system')` — по образцу `src/features/favorites/model/favoritesStorage.ts`
- [x] Экспортировать `Theme` тип (`'light' | 'dark' | 'system'`)
- [x] написать тесты: валидное значение читается корректно
- [x] написать тесты: невалидное значение (не входящее в enum) / битый JSON → fallback `'system'`
- [x] run tests — должны пройти перед Task 3

### Task 3: `resolveTheme` — чистая функция вычисления эффективной темы

**Files:**

- Create: `src/features/theme/lib/resolveTheme.ts`
- Create: `src/features/theme/lib/resolveTheme.test.ts`

- [x] `resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark'` — `system` резолвится через `prefersDark`, `light`/`dark` возвращаются как есть
- [x] написать тесты для всех трёх входных `theme` × обоих `prefersDark`
- [x] run tests — должны пройти перед Task 4

### Task 4: `useTheme()` хук + стаб `matchMedia` в тестовом окружении

**Files:**

- Create: `src/features/theme/model/useTheme.ts`
- Create: `src/features/theme/model/useTheme.test.tsx`
- Modify: `src/test/setup.ts`

- [x] Добавить глобальный стаб `window.matchMedia` в `src/test/setup.ts` (jsdom не предоставляет его вообще — без стаба любой тест, монтирующий `useTheme`/`ThemeToggle`, упадёт с `matchMedia is not a function`); стаб возвращает объект с `matches`, `addEventListener`/`removeEventListener` (не no-op — конкретные тесты `useTheme` должны уметь вручную вызвать сохранённый listener, чтобы симулировать смену системной темы)
- [x] `useStorageSlot(themeSlot)` для чтения/записи `theme`
- [x] `prefersDark` через `window.matchMedia('(prefers-color-scheme: dark)')`, подписка на `change` в `useEffect` с отпиской в cleanup
- [x] `resolvedTheme = resolveTheme(theme, prefersDark)` (Task 3)
- [x] `useEffect`, применяющий `document.documentElement.setAttribute('data-theme', resolvedTheme)` при каждом изменении `resolvedTheme`
- [x] `toggleTheme()` — переключает по текущему `resolvedTheme` (`dark` → `setTheme('light')`, и наоборот); `setTheme(next: Theme)` — прямая установка, используется и извне, и самим `toggleTheme`
- [x] написать тесты: persist в localStorage, применение `data-theme` на `document.documentElement`, `toggleTheme` из обоих resolved-состояний, реакция на симулированное `change`-событие `matchMedia` при `theme === 'system'`
- [x] тесты сбрасывают `document.documentElement.removeAttribute('data-theme')` в `afterEach` (jsdom `document` общий между тестами файла)
- [x] run tests — должны пройти перед Task 5

### Task 5: Публичный API `features/theme` + no-FOUC script

**Files:**

- Create: `src/features/theme/index.ts`
- Modify: `index.html`

- [x] `index.ts` экспортирует `useTheme`, `Theme` (по паттерну `@features/favorites`)
- [x] Inline `<script>` в `<head>` `index.html`, **до** `<div id="root">`: читает `localStorage.getItem('kinoshka:theme')`, **`JSON.parse`** значение (хранится в кавычках, см. Context/Solution Overview), валидирует вручную (без импорта zod), при `'system'`/отсутствии/невалидном значении — `matchMedia('(prefers-color-scheme: dark)').matches`
- [x] Весь скрипт в `try/catch`; **fallback при исключении — тоже через `matchMedia(...).matches`**, не захардкоженный `'dark'` (см. обоснование в Solution Overview)
- [x] Ставит `document.documentElement.setAttribute('data-theme', ...)` синхронно
- [x] Тест не применим напрямую (inline script вне Vitest/jsdom-пайплайна, skipped - not automatable) — ручная проверка в Task 13, включая случай сохранённого `light` на ОС с тёмной темой (JSON-обёрнутое значение)
- [x] run `make test` — не должно быть регрессий

### Task 6: `SunIcon`/`MoonIcon`, перенос `IconButton` в `@shared/ui`, `ThemeToggle`

**Files:**

- Modify: `src/shared/ui/Icon/Icon.tsx`
- Modify: `src/shared/ui/Icon/index.tsx`
- Create: `src/shared/ui/IconButton/IconButton.tsx` (перенос содержимого)
- Create: `src/shared/ui/IconButton/IconButton.module.css` (перенос содержимого)
- Create: `src/shared/ui/IconButton/index.tsx`
- Modify: `src/shared/ui/index.ts`
- Delete: `src/widgets/header/ui/IconButton/index.tsx`, `IconButton.module.css`
- Modify: `src/widgets/header/ui/Header/Header.tsx` (4 использования `IconButton` → импорт из `@shared/ui`)
- Create: `src/features/theme/ui/ThemeToggle/ThemeToggle.tsx`
- Create: `src/features/theme/ui/ThemeToggle/ThemeToggle.module.css` (если нужны стили сверх `IconButton`)
- Create: `src/features/theme/ui/ThemeToggle/index.tsx`
- Create: `src/features/theme/ui/ThemeToggle/ThemeToggle.test.tsx`
- Modify: `src/features/theme/index.ts`

- [x] `SunIcon`/`MoonIcon` в `Icon.tsx` по паттерну существующих иконок, экспорт из `index.tsx`
- [x] Перенести `IconButton` из `src/widgets/header/ui/IconButton/` в `src/shared/ui/IconButton/` без изменений содержимого (уже theme-agnostic), экспортировать из `src/shared/ui/index.ts`
- [x] Обновить 4 импорта `IconButton` в `Header.tsx` на `@shared/ui`, удалить старую директорию
- [x] `ThemeToggle` — использует `useTheme()`, рендерит `IconButton` (`@shared/ui`) с `SunIcon`/`MoonIcon` по `resolvedTheme`, `aria-label` меняется на «Switch to light/dark theme»
- [x] Экспортировать `ThemeToggle` из `features/theme/index.ts`
- [x] написать тесты: клик переключает `document.documentElement.dataset.theme`, `aria-label` синхронизирован с текущей темой
- [x] `Header.test.tsx` — прогнать без изменений (импорт `IconButton` сменился, публичное поведение Header — нет); должен остаться зелёным
- [x] run tests — должны пройти перед Task 7

### Task 7: Встроить `ThemeToggle` в `Header` и `MobileHeader`

**Files:**

- Modify: `src/widgets/header/ui/Header/Header.tsx`
- Modify: `src/widgets/header/ui/Header/Header.test.tsx`
- Modify: `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.tsx`
- Modify/Create: `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.test.tsx` (создать, если такого файла ещё нет)
- Modify: `src/widgets/header/index.ts`, `src/widgets/mobile-chrome/index.ts` (если требуется реэкспорт)

- [x] `Header.tsx`: `ThemeToggle` в `s.actions`, рядом с `IconButton`(Bell)
- [x] `MobileHeader.tsx`: `ThemeToggle` в подходящем месте разметки (рядом с avatar/иконками)
- [x] Тест на наличие кнопки-тоггла (`getByRole('button', { name: /theme/i })`) в обоих header-компонентах
- [x] написать/обновить тесты — успешный рендер с toggle, клик меняет `document.documentElement.dataset.theme`
- [x] run tests — должны пройти перед Task 8

### Task 8: Аудит и токенизация хардкод-цветов в существующих CSS-модулях

**Files:**

- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.module.css`
- Modify: `src/entities/movie/ui/Card/Card.module.css`
- Modify (проверить, возможно оставить с комментарием): `src/pages/home/ui/HeroSection/HeroSection.module.css`
- Modify (проверить, возможно оставить с комментарием): `src/pages/movie/ui/MovieHero/MovieHero.module.css`
- Modify (проверить, возможно оставить с комментарием): `src/entities/movie/ui/MobileCard/MobileCard.module.css`
- Modify (проверить, возможно оставить с комментарием): `src/entities/movie/ui/Poster/Poster.module.css`

- [x] `grep -rE "#[0-9A-Fa-f]{3,8}|rgba?\(" --include='*.module.css' src` — построить полный список, свериться с шестью файлами выше
- [x] `BottomNav.module.css:7` (`rgba(15,13,17,0.92)`) — UI-chrome фон навбара → заменить на `var(--bg-glass-heavy)` (или ближайший подходящий токен)
- [x] `Card.module.css:96` (`color: rgba(242,240,239,0.7)`) — UI-chrome текст → заменить на `var(--text-secondary)` (или ближайший подходящий токен)
- [x] `HeroSection.module.css:68,185`, `MovieHero.module.css:30-31`, `MobileCard.module.css:26,47` — определить для каждого: это скрим/оверлей над произвольным фото (постер/backdrop), нужный для читаемости независимо от темы → оставить хардкод с коротким комментарием `/* намеренно не тонируется — скрим над постером/backdrop */`, ИЛИ это чистый UI-фон → тонировать. Решение принимается визуально (открыть компонент в браузере) — по факту решение принято по структуре CSS/markup (нет браузера, см. лог прогресса): `HeroSection` и `MobileCard` → тонировано (`var(--bg-glass)`), `MovieHero` → оставлено как скрим с комментарием
- [x] `Poster.module.css` — `rgba(255,255,255,...)` инсет-хайлайты и `rgba(242,240,239,...)` текст поверх сгенерированного (oklch-hue) плейсхолдера: по умолчанию оставить как намеренную консистентную стилизацию «постера» (не зависит от темы приложения, как и сам постер), задокументировать решение комментарием в CSS
- [x] Тесты не требуются (визуальный CSS-рефакторинг), кроме случаев, если существующий тест где-то assert'ит инлайн-цвет (проверить аналогично находке в Task 11 — по этим файлам ассертов на стиль не найдено на момент планирования, но проверить `grep -rn "toHaveStyle\|\.style\." src/**/*.test.tsx` по затронутым компонентам) — проверено, найдено только `Spinner.test.tsx` (не относится к затронутым компонентам), регрессий нет
- [x] Визуально проверить каждый затронутый компонент в light и dark — manual test (skipped - not automatable, нет браузера); решения приняты по чтению CSS/markup/TSX (наличие `background-image: url(movie.backdrop)` в `MovieHero.tsx` подтверждает скрим над реальным фото; `Card.module.css` уже использует `var(--bg-glass)` для аналогичных беджей поверх постера — использован как прецедент для `MobileCard`), см. [decision]-строки в логе прогресса
- [x] run `make test` — не должно быть регрессий перед Task 9

### Task 9: Миграция `FavoritesMobile` в `Component/index.tsx` + CSS-модуль

**Files:**

- Create: `src/pages/favorites/ui/FavoritesMobile/FavoritesMobile.tsx` (перенос содержимого `FavoritesMobile.tsx`)
- Create: `src/pages/favorites/ui/FavoritesMobile/FavoritesMobile.module.css`
- Create: `src/pages/favorites/ui/FavoritesMobile/index.tsx`
- Move: `src/pages/favorites/ui/FavoritesMobile.test.tsx` → `src/pages/favorites/ui/FavoritesMobile/FavoritesMobile.test.tsx`
- Delete: `src/pages/favorites/ui/FavoritesMobile.tsx`

- [x] Перенести компонент в директорию по стандартному паттерну проекта (`Component.tsx` + `index.tsx`-реэкспорт), импорт в `FavoritesPage.tsx` не меняется (без расширения, резолвится на директорию)
- [x] Перенести все `style={{...}}` в `FavoritesMobile.module.css`, хардкод-хексы (`#F2F0EF`, `#0F0D11`) → `var(--text-primary)`/`var(--bg-primary)`
- [x] Динамические/вычисляемые значения (если есть) оставить инлайн `style` — не найдено ни одного, все `style={{...}}` были статическими и полностью перенесены в CSS-модуль
- [x] Визуально сверить рендер до/после в dark-режиме (пиксель-в-пиксель идентично) — manual test (skipped - not automatable, нет браузера); проверено построчным сравнением: каждый CSS-класс в `FavoritesMobile.module.css` — точная копия соответствующего `style={{...}}` объекта из старого файла (значения/единицы не менялись), только хардкод-хексы → `var(--...)`, которые в dark-режиме резолвятся в те же самые hex-значения (`--bg-primary: #0f0d11`, `--text-primary: #f2f0ef` в безусловном `:root`)
- [x] `FavoritesMobile.test.tsx` — прогнать без изменений содержимого, должен остаться зелёным — зелёный (`make test`: 544/544, 64 файла); единственное изменение в файле — путь импорта `server` (`../../../test/setup` → `../../../../test/setup`), т.к. файл теперь на один уровень глубже (см. [decision] в логе прогресса), логика/ассерты не менялись
- [x] Визуально проверить light-режим — manual test (skipped - not automatable, нет браузера); все хардкод-хексы заменены на `var(--...)` токены, которые уже определены в `:root[data-theme='light']` (Task 1), поэтому компонент корректно отреагирует на смену темы
- [x] run tests — должны пройти перед Task 10 — `make test`, `make lint`, `make typecheck`, `make build` все прошли чисто

### Task 10: Миграция `HomeMobile` в `Component/index.tsx` + CSS-модуль

**Files:**

- Create: `src/pages/home/ui/HomeMobile/HomeMobile.tsx` (перенос содержимого)
- Create: `src/pages/home/ui/HomeMobile/HomeMobile.module.css`
- Create: `src/pages/home/ui/HomeMobile/index.tsx`
- Delete: `src/pages/home/ui/HomeMobile.tsx`

- [x] Перенести компонент в директорию, импорт в `HomePage.tsx` не меняется
- [x] Перенести все `style={{...}}` в `HomeMobile.module.css`; хардкод-хексы/rgba, включая `#0F0D11`/`#D18E5F` в градиенте и цветах фильтра-чипов, → соответствующие `var(--...)` (`#0F0D11` → `var(--bg-primary)`, `#F2F0EF` → `var(--text-primary)`, `#D18E5F` → `var(--accent-warm)`, `#B8ADAB` → `var(--text-secondary)`, `#5A5059` → `var(--text-faint)`, `#18161B` → `var(--bg-secondary)`, `rgba(24,22,27,0.7)`/`rgba(24,22,27,0.6)` → `var(--bg-glass)` (same decision as `HeroSection.module.css` `.badge`/`.chip`, used as precedent — see Task 8), `rgba(184,173,171,0.12)`/`rgba(184,173,171,0.15)` → `var(--border-light)`/`var(--border-soft)`, `rgba(209,142,95,0.15)` → `var(--accent-warm-soft)`, `rgba(209,142,95,0.18)` → `var(--accent-warm-glow)`, `rgba(209,142,95,0.35)` → `var(--accent-warm-border)`); active-chip conditional inline style replaced with `${s.chip} ${active ? s.chipActive : ''}` template-literal class toggling per project convention (`## Styles` in AGENTS.md) instead of carrying the conditional into inline `style`
- [x] Динамические значения (если есть) — оставить инлайн `style` — не найдено ни одного динамического/вычисляемого значения (высоты, transform по скроллу и т.п.); всё было статическим и полностью перенесено в CSS-модуль
- [x] Визуально сверить рендер dark до/после (идентично) — manual test (skipped - not automatable, нет браузера); проверено построчным сравнением: каждый класс в `HomeMobile.module.css` — точная копия соответствующего `style={{...}}` (значения/единицы не менялись), хардкод-хексы/rgba заменены на `var(--...)`, которые в dark (безусловный `:root`) резолвятся в те же самые исходные hex/rgba-значения
- [x] Тест-файла для `HomeMobile` нет — не добавлять новый (вне скоупа 2.2)
- [x] Визуально проверить light-режим — manual test (skipped - not automatable, нет браузера); все использованные токены уже определены в `:root[data-theme='light']` (Task 1), включая `--bg-glass`/`--accent-warm-soft`/`--accent-warm-border`, поэтому компонент корректно отреагирует на смену темы
- [x] run `make test` — не должно быть регрессий перед Task 11 — `make test` (544/544, 64 файла), `make lint`, `make typecheck`, `make build` все прошли чисто

### Task 11: Миграция `SearchMobile` в `Component/index.tsx` + CSS-модуль

**Files:**

- Create: `src/pages/search/ui/SearchMobile/SearchMobile.tsx` (перенос содержимого)
- Create: `src/pages/search/ui/SearchMobile/SearchMobile.module.css`
- Create: `src/pages/search/ui/SearchMobile/index.tsx`
- Move: `src/pages/search/ui/SearchMobile.test.tsx` → `src/pages/search/ui/SearchMobile/SearchMobile.test.tsx`
- Delete: `src/pages/search/ui/SearchMobile.tsx`

- [x] Перенести компонент в директорию, импорт в `SearchPage.tsx` не меняется
- [x] Перенести все `style={{...}}` в `SearchMobile.module.css` (40+ вхождений хардкода), все хардкод-значения → `var(--...)`
- [x] Динамические значения (если есть, напр. связанные с drawer-анимацией фильтров) — оставить инлайн `style` — не найдено ни одного: все `style={{...}}` были статическими или бинарными (active/disabled/isUpdating), последние переведены на условные CSS-классы (`${s.x} ${cond ? s.xActive : ''}`, `:disabled` псевдокласс) по конвенции проекта, а не оставлены инлайном
- [x] **`SearchMobile.test.tsx:567`** — переписано `expect(activeBtn.style.background).toBe('rgba(209, 142, 95, 0.15)')` → `expect(activeBtn.className).toMatch(/pageBtnActive/)`, по образцу уже существующего `Pagination.test.tsx` (`expect(activeBtn.className).toMatch(/btnActive/)`), сохраняя смысл проверки «активная кнопка страницы визуально выделена»
- [x] Визуально сверить рендер dark до/после (идентично) — manual test (skipped - not automatable, нет браузера); проверено построчным сравнением: каждый класс в `SearchMobile.module.css` — точная копия соответствующего `style={{...}}`/условного тернарника из старого файла, хардкод-хексы/rgba заменены на `var(--...)`, которые в dark (безусловный `:root`) резолвятся в те же самые исходные hex/rgba-значения
- [x] Визуально проверить light-режим, включая drawer-фильтры и результаты поиска — manual test (skipped - not automatable, нет браузера); все использованные токены уже определены в `:root[data-theme='light']` (Task 1), включая `--bg-glass`/`--bg-glass-heavy`/`--bg-chip`/`--accent-warm-soft`/`--accent-warm-border`, поэтому компонент корректно отреагирует на смену темы
- [x] run tests — должны пройти перед Task 12 — `make test` (544/544, 64 файла), `make lint`, `make typecheck`, `make build` все прошли чисто

### Task 12: Миграция `MovieMobile` в `Component/index.tsx` + CSS-модуль, включая динамические градиенты

**Files:**

- Create: `src/pages/movie/ui/MovieMobile/MovieMobile.tsx` (перенос содержимого)
- Create: `src/pages/movie/ui/MovieMobile/MovieMobile.module.css`
- Create: `src/pages/movie/ui/MovieMobile/index.tsx`
- Move: `src/pages/movie/ui/MovieMobile.test.tsx` → `src/pages/movie/ui/MovieMobile/MovieMobile.test.tsx`
- Delete: `src/pages/movie/ui/MovieMobile.tsx`

- [x] Перенести компонент в директорию, импорт в `MoviePage.tsx` не меняется
- [x] Перенести все статические `style={{...}}` в `MovieMobile.module.css` (935 строк, 60+ вхождений хардкода — разбить по секциям компонента: overview/cast/details/media-таб)
- [x] **Градиенты с `movie.hue` (строки ~194, ~204 в исходном файле)**: динамическая часть передаётся через CSS custom property (`style={{ '--hue': movie.hue }}` на элементе), сам градиент (включая ранее хардкоженный `#0F0D11`/`rgba(15,13,17,...)`) переносится в `.module.css` как `background: radial-gradient(..., oklch(0.32 0.1 var(--hue) / 0.6), transparent 70%), ..., var(--bg-primary)` — хардкод-хекс исчезает, `hue` остаётся динамическим
- [x] Прочие динамические значения (если есть, напр. связанные с активной вкладкой/скроллом) — оставить инлайн `style`
- [x] Визуально сверить рендер dark до/после (идентично) по всем четырём табам (Overview/Cast/Details/Media) (skipped - no browser available, reasoned from code)
- [x] `MovieMobile.test.tsx` — прогнать без изменений содержимого, должен остаться зелёным
- [x] Визуально проверить light-режим по всем табам, включая градиент-плейсхолдер без постера (skipped - no browser available, reasoned from code)
- [x] run tests — должны пройти перед Task 13

### Task 13: Verify acceptance criteria

- [x] Пройти чек-лист 2.2 из `plans/roadmap.md` построчно и подтвердить каждый пункт — все 7 пунктов подтверждены чтением кода: (1) светлая палитра спроектирована — `src/app/styles/global.css` содержит полный `:root[data-theme='light'] { ... }`; (2) токены `:root[data-theme="light"]` присутствуют (строки ~55-103); (3) `src/features/theme/` с моделью `Theme = 'light' | 'dark' | 'system'` (`themeStorage.ts`, `z.enum(['light','dark','system'])`) существует; (4) `useTheme()` (`src/features/theme/model/useTheme.ts`) ставит `document.documentElement.setAttribute('data-theme', resolvedTheme)` в `useEffect` и подписывается на `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)`; (5) persist через `useStorageSlot(themeSlot)` → `localStorage`; (6) toggle-кнопка `ThemeToggle` вшита и в `Header` (`src/widgets/header/ui/Header/Header.tsx:200`), и в `MobileHeader` (`src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.tsx:53`) — шире требования roadmap (там указан только `Header`); (7) no-FOUC inline-скрипт в `index.html` `<head>` до `<div id="root">`. Чек-боксы самого `plans/roadmap.md` формально проставляются в Task 14 (документация), не здесь.
- [x] Toggle работает на всех страницах (`/`, `/search`, `/movie/:id`, `/favorites`) в обоих Header (desktop resize < 720px → mobile) — подтверждено чтением, не браузером: desktop — `Header` рендерится в `HomeDesktop.tsx:17`, `SearchDesktop.tsx:131`, `MovieDesktop.tsx:37`, `FavoritesDesktop.tsx:53` (все четыре страницы), `ThemeToggle` внутри `Header.tsx:200`; mobile — `MobileHeader` (со встроенным `ThemeToggle`) рендерится внутри `HomeMobile.tsx`, `SearchMobile.tsx`, `MovieMobile.tsx`, `FavoritesMobile.tsx` (все через `mobile-chrome`). Переключение desktop/mobile по 720px — существующий `useViewport()`, не менялся этой задачей.
- [x] Persist: тема переживает reload страницы — не ретестировалось вручную (нет браузера); это прямое следствие использования `localStorage` через `createStorageSlot`/`useStorageSlot` (`useTheme.ts` → `useStorageSlot(themeSlot)`), уже покрыто тестом `useTheme.test.tsx` («setTheme персистит значение в localStorage (JSON-строка)» — `expect(localStorage.getItem('kinoshka:theme')).toBe('"light"')`) — persist-семантика идентична уже проверенной для `kinoshka:favorites`/`kinoshka:genres`.
- [x] Нет FOUC: hard refresh с сохранённым в localStorage `"light"` (JSON-обёрнутое значение) на ОС с тёмной темой — не мигает тёмным перед светлым (и наоборот) — не запускалось в реальном браузере (нет браузера в этом окружении); логика inline-скрипта в `index.html` прослежена вручную построчно: `raw = localStorage.getItem('kinoshka:theme')` → `'"light"'`; `theme = JSON.parse(raw)` → `'light'`; ветка `if (theme === 'light' || theme === 'dark') resolved = theme` → `resolved = 'light'` — `matchMedia` в этой ветке вообще не вызывается, поэтому тёмная ОС-тема не влияет; `setAttribute('data-theme', 'light')` ставится синхронно до первого рендера `<body>`. Для случая невалидного/отсутствующего значения fallback идёт через `matchMedia(...).matches` (не захардкожен `'dark'`), включая ветку `catch` — соответствует и `resolveTheme()`, и требованию из Solution Overview. Логика корректна, багов не найдено.
- [x] `system` работает как начальное значение при первом визите (очистить localStorage, сравнить с ОС-настройкой) — подтверждено чтением: `themeSlot = createStorageSlot('kinoshka:theme', z.enum([...]), 'system')` — при пустом `localStorage` `useStorageSlot` возвращает fallback `'system'`; `resolveTheme('system', prefersDark)` (`src/features/theme/lib/resolveTheme.ts`) резолвит `'system'` через `prefersDark` от `window.matchMedia('(prefers-color-scheme: dark)').matches` — совпадает с ОС-настройкой. Также покрыто тестом `useTheme.test.tsx` («из theme === system toggle даёт предсказуемый результат по resolvedTheme»).
- [x] Cross-tab: смена темы в одной вкладке отражается в другой (через тот же `createStorageSlot`) — не ретестировалось вручную в двух реальных вкладках; `themeSlot` использует тот же `createStorageSlot` (`src/shared/lib/storage/storage.ts`), который уже подписывается на `window.addEventListener('storage', storageHandler)` — этот же generic-механизм уже используется и протестирован для `kinoshka:favorites`/`kinoshka:genres`; `themeStorage.ts` не переопределяет и не обходит эту подписку, значит cross-tab sync наследуется «бесплатно», без дополнительного кода.
- [x] Нативные контролы (`YearRangeSlider`, скроллбары) визуально соответствуют теме (`color-scheme` из Task 1 применился) — подтверждено чтением: `global.css` содержит `color-scheme: dark` в безусловном `:root` (строка 53) и `color-scheme: light` в `:root[data-theme='light']` (строка 103); `grep -rn "color-scheme|appearance" src/features/catalog-filter/ui/YearRangeSlider/YearRangeSlider.module.css` не находит собственного `color-scheme` в компоненте (только `appearance: none`/`-webkit-appearance: none` на самих `<input>`, что убирает нативный OS-скин для кастомной отрисовки трека/thumb, но не переопределяет `color-scheme`) — значит нативные контролы (в т.ч. оставшийся нативный `outline`/фокус-стиль и любые не полностью кастомизированные части) наследуют `color-scheme` от `<html>`, как и задумано.
- [x] `make check` (lint + build) — зелёный — `make lint` (`oxlint .`) и `make build` (`tsc -b && vite build`) оба прошли чисто по отдельности. Полный `make check` = `format-check lint build` (см. `Makefile:36`) не полностью зелёный: `oxfmt --check .` падает на одном файле — `docs/plans/completed/20260814-home-hero-search-wiring.md` — не связанном с темой toggle. Проверено: этот файл не проходил `oxfmt --check` уже на базовом коммите `9b87149` (до начала работы над этим планом), и сам `oxfmt` не сходится на нём за один проход (переформатирование по кругу меняет отступы вложенных списков туда-обратно, не достигая стабильного состояния) — похоже на баг/ограничение форматтера на этом конкретном файле, а не на реальную проблему форматирования, введённую этой задачей. Остальные найденные в `format-check` файлы (`AGENTS.md` и 5 других `docs/plans/completed/*.md`, также с дрейфом до этой ветки) были безопасно отформатированы (`oxfmt`, только пробелы/переносы, без изменения контента) и теперь проходят `--check`. [decision] Не стал форсировать/чинить `20260814-home-hero-search-wiring.md` дальше, т.к. это увело бы контент документа от исходного без реального решения (не сходится), и файл не относится к скоупу theme-toggle.
- [x] `make test` — весь сьют зелёный — `make test`: **544 passed / 544, 64 test files passed / 64**, 0 failures (шум `Not implemented: Window's scrollTo()` — известные jsdom-предупреждения, не ошибки).
- [x] `make coverage` — сравнить с уровнем до задачи, не хуже — baseline «до задачи» нигде не сохранён и не был снят в рамках этого запуска, поэтому честного up/down-сравнения нет (как и указано в инструкции к задаче). Зафиксированы текущие цифры: **Statements 88.23% (2948/3341), Branches 78.35% (2118/2703), Functions 86.65% (370/427), Lines 97.24% (1904/1958)**. Theme-специфичные файлы: `features/theme/model` (useTheme.ts) — 97.22% statements/95% branches; `ThemeToggle.tsx` — 83.33% statements; `IconButton.tsx` — 85.71% statements. `make coverage` завершился без ошибок.

### Task 14: [Final] Обновить документацию

**Files:**

- Modify: `AGENTS.md`
- Modify: `plans/roadmap.md`
- Delete: `src/index.css` (мёртвый неиспользуемый Vite-темплейт с собственным `color-scheme`/`prefers-color-scheme`, не импортируется нигде)
- Move: `docs/plans/20260819-theme-toggle.md` → `docs/plans/completed/`

- [ ] `AGENTS.md`, секция `## Responsive pattern`: убрать утверждение «`HomeMobile`, `SearchMobile`, `MovieMobile` — flat `.tsx` файлы без CSS-модуля» (после этой задачи все четыре следуют обычному паттерну `Component/index.tsx` + `Component.module.css`)
- [ ] `AGENTS.md`, `## Key public APIs`: добавить `@features/theme` (`useTheme()`, `Theme`, `ThemeToggle`), добавить `IconButton` в строку `@shared/ui` (перенесён из `widgets/header`)
- [ ] `AGENTS.md`, секция `## Data state`: упомянуть `kinoshka:theme` рядом с `kinoshka:favorites`/`kinoshka:genres` в списке localStorage-ключей через `createStorageSlot`
- [ ] `AGENTS.md`: добавить короткую заметку по паттерну темизации (аналогично существующим заметкам про stretched-link/dual-thumb slider) — `data-theme` на `<html>` + переопределение токенов + no-FOUC inline script; новый CSS всегда через `var(--token)`, никогда хардкод-хекс
- [ ] Удалить `src/index.css`, убедиться что нигде не было ссылок (уже проверено на этапе planning — `grep` пуст)
- [ ] Обновить `Прогресс (живой трекер)` и чек-боксы пункта 2.2 в `plans/roadmap.md` (все строки 2.2 → `[x]`)
- [ ] Переместить этот файл в `docs/plans/completed/`

## Post-Completion

**Ручная проверка:**

- Проверить рендер light/dark в Safari и Firefox (не только Chromium dev-сервера) — `prefers-color-scheme` и `matchMedia`-событие `change` имеют нюансы реализации между браузерами.
- Проверить на реальном мобильном устройстве (не только эмуляция вьюпорта в DevTools).

**Отложено на другие фазы:**

- Контраст/a11y-аудит светлой палитры через Lighthouse — формально в 2.5.6, но стоит прогнать вручную сразу после Task 13, если будет время.
- `steiger`/`eslint-plugin-boundaries` (0.6, ещё не сделан) — проверит FSD-направление импортов `features/theme` автоматически; сейчас проверяется вручную ревью.
