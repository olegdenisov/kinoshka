# Устранение вложенных interactive-элементов в Card/MobileCard

## Overview

`Card` (`src/entities/movie/ui/Card/Card.tsx`) и `MobileCard` (`src/entities/movie/ui/MobileCard/MobileCard.tsx`) сейчас оборачивают всю карточку в react-router `<Link>` (рендерится как `<a>`) и вкладывают внутрь `<button>`-элементы (`CardBtn`: Rate/Add/Eye/Favorite в `Card`; отдельная heart-кнопка в `MobileCard`). Это невалидный HTML — `<a>` не может содержать другой interactive-content (`<button>`) по спецификации — и ломает клавиатурную навигацию/поведение скринридеров (непредсказуемый фокус/tab-order на вложенных интерактивных элементах).

Коммит `3ac282c` уже накладывал пластырь: `preventDefault()+stopPropagation()` в обработчике клика `CardBtn`, чтобы клик по кнопке не всплывал до `<a>` и не триггерил переход. Это лечит симптом (нежелательную навигацию), но не саму причину (невалидную вложенность).

**Решение:** паттерн "stretched-link" через CSS `::after`. Ссылка (`<Link>`) оборачивает только видимый текст заголовка (`.title`) — это даёт ссылке настоящий текстовый accessible name без `aria-label`/`useId`. Псевдоэлемент `::after` на этой ссылке абсолютно позиционируется (`inset: 0`) относительно всей карточки и визуально растягивает кликабельную область на всю `.card`. Кнопки остаются обычными соседями ссылки в DOM (не потомками) и получают `z-index` выше псевдоэлемента, поэтому реально перехватывают клик — без вложенности `<button>` в `<a>` и без `preventDefault`-костыля.

## Context (from discovery)

- **Файлы/компоненты:**
  - `src/entities/movie/ui/Card/Card.tsx` + `Card.module.css` + `Card.test.tsx`
  - `src/entities/movie/ui/Card/CardBtn/CardBtn.tsx` + `CardBtn.test.tsx`
  - `src/entities/movie/ui/MobileCard/MobileCard.tsx` + `MobileCard.module.css` + `MobileCard.test.tsx`
- **8 вызывающих мест, реально рендерящих `Card`/`MobileCard`** (структура их использования не меняется, только внутренняя разметка Card/MobileCard):
  `pages/movie/ui/MovieMobile.tsx`, `pages/movie/ui/RelatedMovies/RelatedMovies.tsx`, `pages/favorites/ui/FavoritesMobile.tsx`, `pages/favorites/ui/FavoritesDesktop/FavoritesDesktop.tsx`, `pages/search/ui/SearchResultsGrid/SearchResultsGrid.tsx`, `pages/search/ui/SearchMobile.tsx`, `widgets/movie-rail/ui/MovieRailMobile/MovieRailMobile.tsx`, `widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.tsx`.
  Проверено: `pages/movie/ui/tabs/CastTab/CastTab.tsx` **не рендерит** `Card`/`MobileCard` — это отдельная плейн-карточка актёра (`<div className={s.castCard}>`, без `Link`/`button`), к этому багу отношения не имеет, из скопа исключена.
- **Существующий пластырь:** `CardBtn.tsx` — `onClick={e => { e.preventDefault(); e.stopPropagation(); onClick?.(e) }}`; `MobileCard.tsx` — аналогичный inline-обработчик на favorite-кнопке, **тоже** с `e.preventDefault()` перед `e.stopPropagation()` (проверено в исходнике) — оба места убирают `preventDefault()` одинаково в Task 3.
- **Стек стекинга (paint order):** позиционированные элементы с `z-index:auto` (текущие `.actions`, `.ratingBadge`, `.typeBadge`, `.favoriteBtn`, `.rating`) красятся на "уровне 0" — ниже позиционированных элементов с явным положительным `z-index`. Значит `::after` с `z-index:1` без соответствующего повышения `z-index` у `.actions`/`.favoriteBtn` перехватит клики вместо кнопок — оба слоя нужно явно проставить (`::after` = 1, кнопки = 2). `.card` при этом получает `position: relative` без собственного `z-index` (остаётся `auto`) — новой stacking context не создаёт, поэтому эти `z-index` всплывают в ближайший реальный stacking context предка; практических коллизий с существующими `z-index` в приложении (10/20/40/50/60 у оверлеев/шапки/боттомшита) нет, но для локальной изоляции стоит добавить `.card { isolation: isolate; }`.
- **UA-стили ссылки:** `.card` (сейчас `<a>`) держит `text-decoration:none; color:inherit;` — после смены `.card` на `<div>` и переноса `<Link>` на `.title`, `text-decoration: none` нужно перенести на `.title` явно (иначе браузерный дефолт `a:link` — подчёркивание — проявится, т.к. author-правило должно явно его перебить). `color: inherit` переносить **не нужно**: `.title` уже объявляет `color: var(--text-primary)` (Card.module.css:108, MobileCard.module.css:59) — это явное author-правило и так побеждает UA-стиль `a:link` независимо от specificity (author normal всегда старше UA normal по origin cascade). Добавление `color: inherit` поверх существующего токена не чинит ничего, а просто затирает его унаследованным цветом ближайшего предка — убрать эту идею из решения.
- **Тесты, завязанные на текущий баг:** `CardBtn.test.tsx` содержит тест `'клик внутри Link не триггерит переход (preventDefault/stopPropagation)'`, который вручную оборачивает `CardBtn` в нативный `<a>` — эта синтетика тестирует ровно старый обходной путь и станет неактуальной/ненадёжной после фикса (без `preventDefault` нативный `<a>`-дефолт не отменяется одним `stopPropagation`). Удаляется в рамках этого плана.
- **Не в скопе:** отсутствующие `aria-label` у кнопок Rate/Add/Eye в `Card.tsx` (нет `ariaLabel` prop) — существующий, отдельный от этого бага пробел в доступности, не трогаем здесь.
- **Фокус-стили (важно для a11y-обоснования этого плана):** `src/app/styles/global.css:77` задаёт глобальный `:focus-visible { outline: 2px solid var(--accent-warm); }`. Сейчас при табуляции на карточку обводка рисуется вокруг всей карточки (т.к. `<a>` = вся карточка). После рефакторинга `<a>` — это только `.title` (текст заголовка), и без явной правки обводка схлопнется до размера текста, а не будет покрывать растянутый `::after`-хитбокс — визуальная регрессия ровно в той части, которую этот план должен улучшить. Нужно явно перенести фокус-индикацию на псевдоэлемент (см. Technical Details).
- **Непроверяемость CSS-слоёв в текущих тестах:** в проекте нет визуального/browser-level тестирования (Vitest+jsdom не считает layout, не применяет реальный CSS-каскад/paint order). Корректность `position`/`z-index`/`::after`-геометрии из этого плана **не может** быть подтверждена юнит-тестами — только ручной проверкой в браузере. Зелёный `make test` не является доказательством того, что stretched-link реально растянут; это должно быть явным чекбоксом внутри Task 1/2, а не только в Post-Completion.

## Development Approach

- **Тестовый подход:** Regular (сначала код, потом тесты/обновление тестов под новую структуру).
- Выполнять задачи по одной, полностью, без забегания вперёд.
- Каждая задача включает написание/обновление тестов — обязательно, не опционально.
- Все тесты должны проходить перед переходом к следующей задаче.
- Обновлять этот файл при изменении объёма работ.

## Testing Strategy

- **Unit-тесты:** обязательны для каждой задачи (Vitest + Testing Library, `msw` не требуется — компоненты чисто презентационные).
- **Регрессионный тест на саму причину бага:** для `Card` и `MobileCard` — явная проверка `link.querySelectorAll('button')` пуста, чтобы зафиксировать именно структурное условие бага (а не только побочный эффект "не навигирует").
- **E2E:** в проекте нет Playwright/Cypress — не применимо.
- **Известное ограничение юнит-тестов:** Vitest+jsdom не считает layout и не применяет реальный CSS-каскад/paint order — корректность `position`/`z-index`/`::after`-геометрии из этого плана (то, что stretched-link физически растянут на всю карточку, а не только на текст заголовка) юнит-тестами не проверяется в принципе. Зелёный `make test` не означает, что hit-area в браузере действительно работает — единственная проверка этого слоя ручная, вынесена отдельным пунктом в Task 1 и Task 2 (а не только в Post-Completion), чтобы не потеряться после "все тесты прошли".

## Solution Overview

- Внешний контейнер карточки (`.card`) перестаёт быть `<Link>`, становится обычным `<div>` — сохраняет весь текущий layout/CSS класс `card`, только тег меняется. Получает `position: relative; isolation: isolate;` (containing block для `::after` + локальная stacking context, чтобы новые `z-index` не утекали к соседям карточки).
- `<Link to={`/movie/${movie.id}`}>` теперь оборачивает **только** `movie.title` внутри `.info`/`.title` (Card) и `.title` (MobileCard) — заменяет собой текущий `<div className={s.title}>`. Сама ссылка (`.title`) остаётся `position: static` — **не** получает `position: relative`, иначе станет containing block для собственного `::after`, и растянется только текст заголовка, а не вся карточка.
- `.title` получает псевдоэлемент `::after { content: ''; position: absolute; inset: 0; z-index: 1; }` — позиционируется относительно ближайшего `position`-предка, которым благодаря предыдущему пункту оказывается `.card`, а не сам `.title`, и растягивает hit-area ссылки на всю карточку.
- `.actions` (Card) и `.favoriteBtn` (MobileCard) получают явный `z-index: 2`, чтобы визуально/по hit-test'у быть выше растянутого псевдоэлемента ссылки и реально принимать клики.
- `.title` явно получает `text-decoration: none;` (раньше это было на `.card`, который был ссылкой). `color` не трогаем — `.title` уже объявляет `color: var(--text-primary)`, этого достаточно, чтобы перебить UA-стиль `a:link` (см. Context).
- Фокус-индикация переносится с `.title` (текст) на растянутый `::after`, чтобы обводка при табуляции покрывала всю карточку, а не только текст заголовка: `.title:focus-visible { outline: none; } .title:focus-visible::after { outline: 2px solid var(--accent-warm); border-radius: 6px; }` (радиус — как у `.overlay`, чтобы обводка совпадала со скруглением постера).
- `CardBtn.tsx` и `MobileCard.tsx`: убрать `e.preventDefault()` из обработчиков клика кнопок — он был нужен только для гашения нативной навигации нависшего `<a>`-предка, которого после рефакторинга больше нет. `e.stopPropagation()` оставить как есть (без изменений) — трогать его не входит в задачу этого плана.
- **Принятый компромисс:** растянутый `::after` перекрывает `.meta`/бейджи/постер целиком, поэтому текст этих элементов (рейтинг, год, жанр) больше нельзя выделить мышью потом-драгом — это ожидаемая, стандартная цена паттерна stretched-link, а не баг.

## Technical Details

### Card.tsx — новая структура (фрагмент)

```tsx
<div className={s.card}>
  <div className={s.posterContainer}>
    {/* Poster, overlay, actions, ratingBadge, typeBadge — без изменений структуры */}
  </div>

  <div className={s.info}>
    <Link to={`/movie/${movie.id}`} className={s.title}>
      {movie.title}
    </Link>
    <div className={s.meta}>...</div>
  </div>
</div>
```

### Card.module.css — ключевые изменения

```css
.card {
  position: relative; /* containing block для .title::after */
  isolation: isolate; /* локальная stacking context — z-index не утекает к соседям */
  /* было: только cursor/display/gap/transition, без position — text-decoration/color убраны отсюда, .card больше не ссылка */
}

.title {
  /* существующие font-family/size/color(var(--text-primary))/letter-spacing/line-height/transition — БЕЗ изменений, color трогать не нужно */
  /* position НЕ добавлять — .title должен остаться position:static, иначе ::after ниже растянется только на текст заголовка, а не на .card */
  text-decoration: none;
}

.title::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

.title:focus-visible {
  outline: none; /* обводка переносится на ::after ниже, чтобы покрывать всю карточку */
}

.title:focus-visible::after {
  outline: 2px solid var(--accent-warm);
  border-radius: 6px; /* как у .overlay */
}

.actions {
  /* существующие position/left/right/bottom/display/gap/opacity/transform/transition — без изменений */
  z-index: 2;
}
```

### MobileCard.tsx — новая структура (фрагмент)

`.title` в MobileCard сейчас несёт line-clamp (`overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical`). Комбинация `-webkit-line-clamp` + абсолютно позиционированный `::after`-потомок исторически хрупкая в Blink/WebKit (алгоритм клэмпа по-разному учитывает generated content в разных версиях движков) — вместо того чтобы вешать `::after` прямо на клэмпнутый элемент, клэмп переносится на вложенный `<span>`, а `<Link>` (`.title`) остаётся "чистым" контейнером только для позиционирования/hit-area:

```tsx
<div className={s.card}>
  <div className={s.posterWrapper}>
    {/* Poster, .rating, favoriteBtn — без изменений структуры */}
  </div>
  <Link to={`/movie/${movie.id}`} className={s.title}>
    <span className={s.titleText}>{movie.title}</span>
  </Link>
  <div className={s.meta}>...</div>
</div>
```

### MobileCard.module.css — ключевые изменения

```css
.card {
  position: relative; /* добавлено — containing block для .title::after */
  isolation: isolate; /* локальная stacking context */
  /* text-decoration убран отсюда, color не трогаем */
}

.title {
  /* НЕ содержит больше line-clamp-свойств — они переехали в .titleText ниже */
  /* position НЕ добавлять — должен остаться position:static */
  text-decoration: none;
}

.titleText {
  /* сюда переехали существующие font-family/size/color(var(--text-primary))/letter-spacing/line-height/margin-bottom свойства .title, включая line-clamp: */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.title::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

.title:focus-visible {
  outline: none;
}

.title:focus-visible::after {
  outline: 2px solid var(--accent-warm);
  border-radius: 6px;
}

.favoriteBtn {
  /* существующие position/size/border/background — без изменений */
  z-index: 2;
}
```

## What Goes Where

- **Implementation Steps** (`[ ]`): рефакторинг Card/MobileCard/CardBtn, обновление CSS, обновление/добавление тестов.
- **Post-Completion**: ручная проверка клавиатурной навигации и скринридера в браузере (Tab-порядок, VoiceOver/NVDA), визуальная проверка hover/actions на всех 8 вызывающих местах.

## Implementation Steps

### Task 1: Рефакторинг Card.tsx на stretched-link через .title

**Files:**
- Modify: `src/entities/movie/ui/Card/Card.tsx`
- Modify: `src/entities/movie/ui/Card/Card.module.css`
- Modify: `src/entities/movie/ui/Card/Card.test.tsx`

- [x] заменить внешний `<Link className={s.card}>` на `<div className={s.card}>` в `Card.tsx`
- [x] обернуть `movie.title` в `<Link to={`/movie/${movie.id}`} className={s.title}>` внутри `.info` вместо текущего `<div className={s.title}>`
- [x] в `Card.module.css`: добавить `.card { position: relative; isolation: isolate; }`, убрать `text-decoration`/`color` с `.card`
- [x] в `Card.module.css`: добавить `.title { text-decoration: none; }` (без `position`, без `color` — существующий `color: var(--text-primary)` не трогать) и `.title::after { content: ''; position: absolute; inset: 0; z-index: 1; }`
- [x] в `Card.module.css`: добавить `.title:focus-visible { outline: none; }` и `.title:focus-visible::after { outline: 2px solid var(--accent-warm); border-radius: 6px; }`
- [x] в `Card.module.css`: добавить `.actions { z-index: 2; }`
- [x] обновить тест `'ссылается на /movie/:id'` — заменить на проверку accessible name: `expect(screen.getByRole('link', { name: movie.title })).toHaveAttribute('href', '/movie/1')`
- [x] написать новый тест: ни одна action-кнопка не находится внутри DOM-поддерева ссылки — `const link = screen.getByRole('link'); expect(link.querySelectorAll('button')).toHaveLength(0)` (кнопки Rate/Add/Eye/Favorite достаются через `getAllByRole('button')`, у Eye/Rate/Add нет `ariaLabel`, поэтому адресовать их по имени нельзя — проверяем набор кнопок как группу через `querySelectorAll`, а не по одной)
- [x] написать/оставить тест на существующий сценарий "клик по сердечку не триггерит переход" — должен продолжать проходить на новой структуре без каких-либо `preventDefault`
- [x] запустить `make test` — все тесты `Card.test.tsx` должны проходить
- [x] manual test (skipped - not automatable): ручная проверка в браузере z-index/hit-area/::after-геометрии, Tab-фокуса вокруг всей карточки — требует `make dev` и визуальной проверки в реальном браузере, недоступно в этой среде

### Task 2: Рефакторинг MobileCard.tsx на stretched-link через .title

**Files:**
- Modify: `src/entities/movie/ui/MobileCard/MobileCard.tsx`
- Modify: `src/entities/movie/ui/MobileCard/MobileCard.module.css`
- Modify: `src/entities/movie/ui/MobileCard/MobileCard.test.tsx`

- [ ] заменить внешний `<Link className={s.card}>` на `<div className={s.card}>` в `MobileCard.tsx`
- [ ] обернуть `movie.title` в `<Link to={`/movie/${movie.id}`} className={s.title}><span className={s.titleText}>{movie.title}</span></Link>` вместо текущего `<div className={s.title}>{movie.title}</div>`
- [ ] в `MobileCard.module.css`: добавить `.card { position: relative; isolation: isolate; }`, убрать `text-decoration`/`color` с `.card`
- [ ] в `MobileCard.module.css`: перенести существующие line-clamp/типографику-свойства `.title` (`font-family`, `font-size`, `font-weight`, `color`, `letter-spacing`, `line-height`, `margin-bottom`, `overflow`, `display: -webkit-box`, `-webkit-line-clamp`, `-webkit-box-orient`) в новый класс `.titleText`; `.title` оставить только с `text-decoration: none;` (без `position`, без `color`)
- [ ] в `MobileCard.module.css`: добавить `.title::after { content: ''; position: absolute; inset: 0; z-index: 1; }`
- [ ] в `MobileCard.module.css`: добавить `.title:focus-visible { outline: none; }` и `.title:focus-visible::after { outline: 2px solid var(--accent-warm); border-radius: 6px; }`
- [ ] в `MobileCard.module.css`: добавить `.favoriteBtn { z-index: 2; }`
- [ ] добавить тест `expect(screen.getByRole('link', { name: movie.title })).toHaveAttribute('href', '/movie/1')` (такого теста в `MobileCard.test.tsx` сейчас нет)
- [ ] написать новый тест: `const link = screen.getByRole('link'); expect(link.querySelectorAll('button')).toHaveLength(0)`
- [ ] оставить/проверить существующий тест "клик по сердечку не триггерит переход" без `preventDefault`
- [ ] запустить `make test` — все тесты `MobileCard.test.tsx` должны проходить
- [ ] **ручная проверка в браузере (обязательна):** `make dev` на мобильном вьюпорте (< 720px), убедиться, что клик по постеру/рейтингу/пустой области ведёт на `/movie/:id`, клик по heart — нет; убедиться, что 2-строчный line-clamp заголовка визуально не сломался в Chrome и Safari (или хотя бы в Safari/WebKit-based браузере, если Safari недоступен — проверить в BrowserStack/аналоге); Tab-фокус рисует обводку вокруг всей карточки

### Task 3: Убрать preventDefault-костыль из CardBtn и MobileCard, привести к единому виду

**Files:**
- Modify: `src/entities/movie/ui/Card/CardBtn/CardBtn.tsx`
- Modify: `src/entities/movie/ui/Card/CardBtn/CardBtn.test.tsx`
- Modify: `src/entities/movie/ui/MobileCard/MobileCard.tsx` (обработчик favorite-кнопки)

- [ ] в `CardBtn.tsx` убрать `e.preventDefault()` из `onClick`, `e.stopPropagation()` оставить без изменений
- [ ] убрать `e.preventDefault()` из обработчика favorite-кнопки в `MobileCard.tsx` (он там есть — см. Context), `e.stopPropagation()` оставить без изменений
- [ ] удалить из `CardBtn.test.tsx` тест `'клик внутри Link не триггерит переход (preventDefault/stopPropagation)'` — он тестировал именно старый обходной путь синтетическим оборачиванием `CardBtn` в `<a>`, что больше не отражает реальную структуру приложения
- [ ] убедиться, что остальные тесты `CardBtn.test.tsx` (`active`, `ariaLabel`, `onClick вызывается по клику`) не завязаны на удалённое поведение и продолжают проходить
- [ ] запустить `make test` — все тесты `CardBtn.test.tsx` должны проходить

### Task 4: Проверка на всех вызывающих местах и полный прогон

**Files:**
- (без изменений кода — только верификация)

- [ ] `make dev`, вручную открыть каждое из 8 вызывающих мест (home rails desktop/mobile, `/search` grid и mobile, `/favorites` desktop и mobile, movie detail related movies) и проверить: клик по постеру/заголовку/бейджам ведёт на `/movie/:id`; клик по каждой action-кнопке (Rate/Add/Eye/Favorite/heart) НЕ ведёт на `/movie/:id` и не теряет свой собственный `onClick`-эффект (избранное переключается); `variant='compact'` (используется в `MovieRailDesktop`) рендерит на одну кнопку меньше (без Eye), но z-index/hit-area работают так же, как в `variant='grid'`
- [ ] проверить клавиатурную навигацию Tab: фокус последовательно проходит через ссылку карточки и через каждую видимую по hover/focus action-кнопку в естественном DOM-порядке, без "провалов"/дублей; обводка фокуса на ссылке покрывает всю карточку
- [ ] запустить `make check` (lint + build) — без ошибок
- [ ] запустить `make test` — весь набор тестов проходит

### Task 5: [Final] Обновить документацию

- [ ] добавить 2-3 предложения в конец раздела "Component structure" в `AGENTS.md` про паттерн stretched-link, используемый в `Card`/`MobileCard`: ссылка оборачивает только текст заголовка (реальный accessible name), `::after` с `position:absolute; inset:0` на этой ссылке растягивает hit-area на весь контейнер (`position:relative` на нём), action-кнопки — соседи ссылки с более высоким `z-index`, а не её потомки
- [ ] проверить, нужно ли обновление README.md (вероятно нет — внутренний рефакторинг компонента)
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

**Ручная проверка** (обязательно перед мёржем, т.к. это a11y/HTML-валидность фикс; основные хиты по DOM-структуре и hit-area уже проверяются внутри Task 1/2 — здесь финальный сквозной проход по всем местам использования):
- проверка в браузерном DevTools / HTML-валидаторе, что в отрендеренном дереве карточки нет `<button>` внутри `<a>` ни в одном из 8 мест использования
- проверка скринридером (VoiceOver на macOS) — карточка объявляется одной ссылкой с названием фильма (а не всем текстовым содержимым карточки), action-кнопки объявляются отдельно как кнопки со своими `aria-label`
- визуальная регрессия hover-состояния `.actions` (десктоп, `variant='grid'` и `variant='compact'` — отличаются только набором кнопок, не layout'ом) и favorite-кнопки (мобильный)
