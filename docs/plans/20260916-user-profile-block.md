# Блок профиля пользователя (client-only, до Фазы 5)

## Overview

Сейчас в приложении нет ни одного UI-блока, привязанного к пользователю — только мёртвые
заглушки, зафиксированные в `docs/backlog/user-profile-block.md`:

- `Header.tsx:216` и `MobileHeader.tsx:59` рендерят захардкоженный `<div className={s.avatar}>AV</div>`
  — не имя, не логин, никуда не ведёт, и вдобавок один и тот же CSS-класс `.avatar` продублирован
  в двух `.module.css` (`Header.module.css:106`, `MobileHeader.module.css:83`);
- `BottomNav.tsx:44` держит пункт `profile` с `path: null` — задизейблен намеренно, и это
  закреплено тестом `BottomNav.test.tsx:54` («клик не навигирует») и вторым ассертом в тесте
  «6 колонок» (`BottomNav.test.tsx:87`);
- `AppLayout.tsx` в своей таблице соответствия chrome уже держит строку `profile → activeNav нет
  соответствия, active='profile'`, но записи `/profile` в `ROUTE_CHROME` нет, потому что нет роута.

Цель — заменить эти три заглушки настоящим, работающим блоком профиля, не дожидаясь Фазы 5
(BFF/OAuth/WebAuthn), и не выдумывая фиктивную авторизацию. Ключевой принцип плана: **каждый
элемент нового профиля делает что-то реальное**. Ни одной новой мёртвой кнопки — иначе мы просто
заменим одну заглушку («AV») на другую («Sign in», disabled), и бэклог-пункт вернётся в том же виде.

Что появляется по итогу:

- реальный роут `/profile` со своей страницей;
- `@features/profile` — client-only слайс с сохраняемым в `localStorage` отображаемым именем
  (тот же паттерн `createStorageSlot`, что у `@features/favorites` и `@features/theme`);
- аватар в обоих хедерах становится живой ссылкой на `/profile` и показывает реальные инициалы
  из введённого имени (или `ProfileIcon`, если имя не задано);
- пункт `profile` в `BottomNav` включается, а сам тип `path: string | null` и мёртвый
  класс `.navItemDisabled` удаляются — после этого плана задизейбленных пунктов нет вообще;
- на странице — счётчик избранного и быстрые ссылки на `/favorites`/`/popular`/`/recommendations`,
  выбор темы (`light`/`dark`/`system`) и кнопка очистки имени;
- честная подпись о том, что профиль локальный, а вход по аккаунту придёт вместе с бэкендом.

## Context (from discovery)

Файлы и слайсы, затронутые планом (прочитаны на этапе discovery):

- `src/widgets/header/ui/Header/Header.tsx` + `Header.module.css` — заглушка аватара, `.avatar` CSS.
- `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.tsx` + `MobileHeader.module.css` — вторая
  копия той же заглушки, отличается только `font-size` (10px против 11px) и `flex-shrink: 0`.
- `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.tsx` + `BottomNav.test.tsx` — пункт `profile`
  с `path: null`, тип `path: string | null`, класс `.navItemDisabled`, два теста завязаны на это.
- `src/app/layouts/AppLayout.tsx` — `ROUTE_CHROME` (карта `pathname → chrome-конфиг`), готовая
  строка `profile` в таблице соответствия в докблоке.
- `src/app/router.tsx` — все шесть роутов через `lazyNamed`, под `AppLayout`.
- `src/app/router.test.tsx` — по одному смоук-тесту на каждый роут («резолвит свой
  `lazyNamed()`-экспорт», через реальный `router.navigate(path)`) — единственный gate, ловящий
  опечатку в имени экспорта `lazyNamed(factory, exportName)`, которую не поймает ни `tsc`, ни
  юнит-тест самой страницы.
- `src/features/theme/*` — эталон фичи с client-only storage: `themeStorage.ts` (zod + `createStorageSlot`),
  `useTheme.ts` (через `useStorageSlot`), `ui/ThemeToggle/` (UI фичи, рендерится из обоих виджетов-хедеров).
- `src/features/favorites/*` — `useFavorites().ids` даёт список избранного для счётчика в блоке
  «быстрый доступ» (Task 4); `clear()` остаётся неиспользуемым экспортом — намеренно не даём ему
  клиента (см. решение 8 в Solution Overview).
- `src/shared/lib/storage/storage.ts` — `createStorageSlot(key, schema, fallback)`, мемоизация
  распарсенного значения, cross-tab-синхронизация через `storage`-событие.
- `src/pages/favorites/*` — эталон страничного слайса (`FavoritesPage.tsx` → `ui/Favorites/`, барель
  `index.tsx`, `EmptyState` из `@shared/ui`).
- `src/shared/ui/Icon/Icon.tsx` — `ProfileIcon`, `CheckIcon`, `HeartIcon`, `TrendingIcon`, `StarIcon`,
  `ListsIcon`, `ChevronRightIcon` — всё нужное уже есть, новых иконок не требуется.
- `vite.config.ts` (`build.rolldownOptions.output.codeSplitting.groups`) и `package.json`
  (`"size-limit"`) — новый page-слайс обязан получить свою группу чанка и свой бюджет.
- `knip.jsonc` — барели фич перечислены в `ignore`; новый барель может потребовать того же.
- `e2e/` — Playwright-спеки по одному файлу на маршрут, `e2e/utils/a11y.ts` (`checkA11y`).

Существующие токены, которые переиспользуются без единого нового хардкоженного цвета:
`--avatar-gradient`, `--bg-secondary`, `--bg-elevated`, `--bg-chip`, `--border-soft`,
`--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-warm`,
`--accent-warm-soft`, `--accent-warm-border`, `--font-display`, `--font-body`, `--font-mono`.

## Development Approach

- **Тестирование**: Regular (код → тесты, в рамках той же задачи). Task 1 и Task 2 — чистая функция
  и storage-хук — при желании легко перевернуть в TDD, но в этом репозитории все существующие планы
  идут в режиме Regular, и план держит тот же режим ради единообразия.
- Каждая задача — маленькая и самодостаточная; тесты пишутся сразу после кода, в той же задаче.
- Все тесты проходят перед переходом к следующей задаче: `make test`.
- Порядок задач подобран так, чтобы на любом промежуточном шаге приложение оставалось рабочим и
  в нём не появлялось новых мёртвых ссылок: страница и роут (Task 3-7) делаются **до** того, как
  аватар в хедерах станет ссылкой на `/profile` (Task 8-9).
- **React Compiler включён** — никаких ручных `useMemo`/`useCallback`/`memo`.
- **TypeScript**: только `type`, никаких `interface`; компоненты — `const Foo = ({ p }: FooProps) =>`,
  без `React.FC`.
- **Mobile-first CSS**: одна компонента + один CSS-модуль на блок, мобильная вёрстка — безусловная
  база, десктоп — в `@media (min-width: 720px)`. `useViewport()` в этом плане **не используется
  нигде** — новых точечных JS-форков по вьюпорту не добавляется (в репозитории их ровно два, оба
  задокументированы в AGENTS.md, и профиль к ним не относится).
- Все новые WHY-комментарии в коде — на русском.
- Обновлять этот файл, если по ходу работы меняется скоуп.

## Testing Strategy

- **unit-тесты**: обязательны в каждой задаче.
  - новые: `getInitials.test.ts`, `profileStorage.test.ts`, `useProfile.test.tsx`,
    `ProfileAvatar.test.tsx`, `Profile.test.tsx`; `ProfilePage.tsx` и барель `src/pages/profile/index.tsx`
    покрываются смоук-тестом `/profile → ProfilePage` в `router.test.tsx` (Task 7) — тот же паттерн,
    что у `FavoritesPage` (у неё тоже нет отдельного `.test.tsx`);
  - изменяемые: `BottomNav.test.tsx` (два теста завязаны на задизейбленный `profile`: тест
    «остаётся задизейбленным» и второй ассерт в тесте «6 колонок»), `Header.test.tsx`,
    `MobileHeader.test.tsx`, `AppLayout.test.tsx`, `router.test.tsx` (смоук-тест на резолв
    `/profile → ProfilePage`, закрывается в Task 7).
- **MSW не задействуется**: ни одна часть этого плана не ходит в API. Это client-only фича целиком,
  и в `src/test/setup.ts` (`onUnhandledRequest: 'error'`) ничего добавлять не нужно.
- **localStorage в тестах**: `src/test/setup.ts` уже глобально чистит `localStorage` в `afterEach`
  для всех тестов проекта. Новые тесты (`profileStorage.test.ts`, `useProfile.test.tsx`,
  `Profile.test.tsx`) дополнительно чистят его и в `beforeEach` — не потому что без этого мемо
  внутри `createStorageSlot` протечёт (`get()` сам сбрасывает кеш, когда `raw === null`), а просто
  ради единообразия с уже существующими `useFavorites.test.ts`/`themeStorage.test.ts`, которые
  делают то же самое.
- **тесты блока Appearance в `Profile.test.tsx`** сбрасывают `document.documentElement`
  (`removeAttribute('data-theme')`) в `afterEach` — тот же приём, что уже применён в
  `MobileHeader.test.tsx`/`ThemeToggle.test.tsx`, иначе выставленная тема протечёт в соседние кейсы
  файла.
- **e2e-тесты**: добавляется `e2e/profile.spec.ts` (desktop chromium) — AGENTS.md требует
  e2e-покрытие для UI-изменений, а `/profile` — седьмой маршрут SPA (сейчас их шесть, и у каждого
  есть своя спека в `e2e/`). **Стоимость по квоте API — ноль запросов**: страница `/profile`
  не делает ни одного обращения к Kinopoisk API (весь стейт локальный), так что спека не влияет на
  лимит 200 запросов/день демо-тарифа. **При локальных прогонах (Task 11, Task 12) запускать
  точечно** — `pnpm exec playwright test e2e/profile.spec.ts --project=chromium`, а не весь
  `make e2e`: полный сьют стоит ~40-50 запросов из 200/день демо-тарифа (см. AGENTS.md), и гонять
  его дважды ради спеки, которая сама не делает ни одного запроса, — не повод. Мобильная спека
  (`e2e/mobile/`) **не** добавляется — роадмап ограничивает мобильный сьют маршрутами `/`,
  `/search`, `/movie/:id`, и расширять его ради client-only страницы смысла нет (мобильная вёрстка
  проверяется unit-тестами + ручным прогоном).
- **a11y**: `checkA11y(page)` из `e2e/utils/a11y.ts` в новой спеке — ноль violations с
  `impact === 'critical'`. Отдельно следить, чтобы у ссылки-аватара и у включённого пункта
  `Profile` в `BottomNav` были различимые доступные имена (см. Technical Details).
- **бюджеты бандла**: `make size` после `make build-only` — новый бюджет `page-profile` и
  пере-замер `shared` (см. Task 10).

## Progress Tracking

- отмечать выполненное `[x]` сразу, а не пачкой в конце;
- новые обнаруженные задачи добавлять с префиксом ➕;
- блокеры/проблемы — с префиксом ⚠️;
- если реализация отклоняется от плана, править этот файл, а не расходиться с ним молча.

## Solution Overview

### Выбранный вариант: (a) — client-only профиль сейчас

Бэклог явно фиксирует развилку, и этот план реализует вариант **(a)**: сделать блок профиля до
Фазы 5, как client-only, без реальной авторизации.

**Вариант (a) — client-only профиль сейчас (реализуется этим планом).**

- Как: имя пользователя вводится и хранится в `localStorage` (`kinoshka:profile`), аватар и
  инициалы выводятся из него, быстрые ссылки и счётчик избранного берутся из уже живого
  `@features/favorites`, выбор темы — из уже живого `@features/theme`.
- Плюсы: три мёртвые заглушки (`AV`-див ×2, задизейбленный пункт nav) исчезают прямо сейчас;
  `/profile` — реальный маршрут, а не фикция; попутно получает первого реального потребителя
  `useTheme().theme/setTheme` (сейчас числится в `knip.jsonc` как «публичный API без вызывающего»);
  ноль новых API-запросов и ноль зависимости от бэкенда; когда в Фазе 5 появится сессия, страница
  и роут уже есть — меняется только источник данных (`useProfile()` начинает читать сессию вместо
  `localStorage`), а не вся навигация и вёрстка.
- Минусы: локальное имя — не настоящая идентичность (не переносится между браузерами/устройствами,
  теряется вместе с очисткой данных сайта); часть работы (сам `profileStorage`) будет заменена,
  когда появится реальный auth; появляется соблазн навесить на страницу «настройки», которым там
  не место.

**Вариант (b) — отложить до реальной сессии в auth-ветке (5.1-5.3) (отклонён).**

- Как: ничего не делать в `main`, вернуться к профилю внутри `auth/hono-bff` или
  `auth/fastify-sessions`, где уже есть `/api/me/*` и httpOnly-сессии.
- Плюсы: ничего не переделывается дважды; профиль сразу «настоящий», с логином и серверным
  избранным.
- Минусы: Фаза 5 в роадмапе — после монорепо+Docker и в отдельных ветках, то есть не в ближайшей
  работе над `main`; всё это время в продуктовом UI остаются три мёртвые заглушки, которые видит
  любой, кто открывает приложение, — а это ровно то, на что жалуется бэклог-пункт; вдобавок
  задизейбленный пункт `Profile` в `BottomNav` остаётся зафиксированным тестом, то есть заглушка
  не просто существует, а защищена от исправления.

**Почему (a).** Дух бэклога — заменить заглушки чем-то реальным сейчас, а не поддерживать мёртвый
UI ещё несколько фаз. Объём переделки при переходе на серверный профиль невелик и локализован
(`@features/profile/model/*` — один storage-слот и один хук; страница, роут, chrome, аватар и
навигация переживают переход без изменений). Риск «сделали и выбросили» ограничен примерно
двумя файлами из тринадцати задач.

> ⚠️ Если пользователь предпочтёт вариант (b), этот план не нужно урезать — его нужно не начинать:
> при (b) правильное действие — оставить `docs/backlog/user-profile-block.md` как есть, дописав в
> него принятое решение и ссылку на ветку Фазы 5, в которой профиль будет сделан.

### Принципиальные решения внутри варианта (a)

1. **Никакой disabled-кнопки «Sign in».** Первый напрашивающийся способ «оставить место под
   будущий логин» — нарисовать неактивную кнопку входа. Это воспроизводит ровно ту проблему, из-за
   которой заведён бэклог-пункт: мёртвый контрол, который ничего не делает. Вместо неё — обычная
   информационная подпись в футере профиля: профиль локальный, хранится в этом браузере, вход по
   аккаунту появится вместе с бэкендом. Текст — не контрол, его нельзя «нажать впустую».
2. **`ProfileAvatar` живёт в `@features/profile/ui/`, а не в `@shared/ui`.** Прямой прецедент —
   `ThemeToggle` (`@features/theme/ui/ThemeToggle`), который точно так же рендерится из обоих
   виджетов-хедеров: `widgets/*` → `features/*` — разрешённое направление импорта. В `@shared/ui`
   компонент переезжал бы только если бы ему потребовалось быть доступным из слоя ниже `features`
   (как это случилось с `IconButton`, который понадобился самому `@features/theme`) — здесь такой
   необходимости нет.
3. **Дублированный `.avatar` CSS удаляется из обоих хедеров.** Единственная разница между двумя
   копиями — `font-size` (10px на мобильном против 11px на десктопе) и `flex-shrink: 0`. В
   `ProfileAvatar.module.css` это выражается ровно по mobile-first-паттерну репозитория: база —
   10px + `flex-shrink: 0`, в `@media (min-width: 720px)` — 11px. Никакого пропа-варианта.
4. **Большой аватар на самой странице `/profile` — не `ProfileAvatar`, а отдельный элемент.**
   `ProfileAvatar` — это `<Link to='/profile'>`; на самой странице `/profile` ссылка на текущую
   страницу бессмысленна и вредна для скринридера. Вместо того чтобы вводить в `ProfileAvatar`
   проп `as`/`interactive`/`size` ради одного места, страница рисует свой крупный кружок,
   переиспользуя тот же токен `--avatar-gradient` и те же инициалы из `useProfile().initials`.
   Сознательный выбор «дублирование вместо преждевременной абстракции» — ~10 строк CSS против
   полиморфного компонента, который пришлось бы поддерживать.
5. **Тип `path` в `BottomNav` сужается с `string | null` до `string`.** После включения `profile`
   задизейбленных пунктов не остаётся ни одного, поэтому вместе с `path: null` уходят и проверка
   `it.path &&` в `onClick`, и класс `.navItemDisabled` из `BottomNav.module.css`. Оставлять
   мёртвую ветку «на будущее» — YAGNI; если когда-нибудь понадобится снова, вернуть три строки
   тривиально.
6. **Выбор темы (`light`/`dark`/`system`) переезжает на страницу профиля как полноценный контрол.**
   `ThemeToggle` в хедерах остаётся как есть (двухпозиционный быстрый переключатель) — он не
   удаляется и не меняется. Страница профиля добавляет трёхпозиционный выбор, потому что вариант
   `system` сейчас нельзя выбрать вообще нигде в UI: `useTheme().theme` и `setTheme` — публичный
   API без единого вызывающего, перечисленный в `knip.jsonc` как намеренно-неиспользуемый. Это
   ровно тот случай, когда «страница настроек пользователя» даёт ему естественный дом.
   **Взаимодействие с `ThemeToggle` в хедере:** оба контрола читают/пишут один и тот же `themeSlot`
   через `useStorageSlot`, так что рассинхрона между ними не бывает — но `ThemeToggle` вызывает
   `toggleTheme()`, который всегда ставит явный `light`/`dark`, т.е. молча заменяет выбранный на
   `/profile` вариант `system` при следующем клике по хедерному переключателю. Это осознанное, а
   не случайное поведение (быстрый переключатель в хедере не обязан понимать про `system`), и оно
   покрывается тестом в Task 5.
7. **Что сознательно НЕ делается.** Бэклог перечисляет «мой список, просмотрено, рейтинг» —
   ни для одного из трёх нет ни источника данных, ни аффорданса в остальном UI (на карточке фильма
   нет кнопки «просмотрено», нет пользовательских оценок). Реализовать их означало бы придумать
   три новые client-only фичи разом и снова — с нуля, без спроса. Вне скоупа, зафиксировано
   в Post-Completion как возможное продолжение.
8. **Кнопки «Clear favorites» в плане нет.** Черновик добавлял её, обосновывая тем, что
   `useFavorites().clear()` — «публичный API без вызывающего» (по прецеденту `knip.jsonc`). Это
   перевёрнутый YAGNI: неиспользуемый экспорт — повод удалить его, а не найти ему применение.
   Бэклог массовой очистки избранного не просит, и это был бы единственный деструктивный контрол
   во всём приложении, тянущий за собой отдельное состояние подтверждения и три теста. Остаётся
   только `Clear name` (Task 6) — она нужна независимо: без неё сохранённое имя нельзя вернуть
   к `Guest` без похода в devtools.
9. **Что вне скоупа, но зафиксировано, а не потеряно вместе с закрытым бэклог-пунктом.**
   `Header.tsx` держит `IconButton aria-label='Notifications'` без `onClick` (и декоративную точку
   непрочитанного), а `MOVIE_CHROME.rightAction` в `AppLayout.tsx` — `IconButton aria-label='Share'`
   тоже без обработчика. Это те же мёртвые контролы, что и заглушки из этого бэклог-пункта, но
   чинить их — отдельная, не связанная с профилем работа (нет ни бэкенда для уведомлений, ни
   интеграции Web Share API). Чтобы `docs/backlog/user-profile-block.md` не забрал с собой в
   удаление единственное упоминание этой проблемы, Task 13 заводит для них отдельный
   `docs/backlog/dead-header-controls.md`, а не просто удаляет старый пункт.

### Композиция страницы `/profile` (сверху вниз)

```
<main>
  <h1>Profile</h1>

  ── Шапка ─────────────────────────────────
  [ большой аватар: инициалы или ProfileIcon ]
  [ имя, либо "Guest" если не задано ]
  [ форма: input(name) + кнопка Save ]

  ── Быстрый доступ ────────────────────────
  Favorites  (N)   → /favorites
  Popular          → /popular
  Picks            → /recommendations

  ── Appearance ────────────────────────────
  ( ) Light   ( ) Dark   (•) System

  ── Сброс ──────────────────────────────────
  [ Clear name ]      (виден, только если имя задано)

  ── Подпись ───────────────────────────────
  «Локальный профиль. Данные хранятся только в этом браузере.
   Вход по аккаунту появится вместе с бэкендом.»
</main>
```

## Technical Details

### Хранилище и хук (`@features/profile`)

```ts
// src/features/profile/model/profileStorage.ts
export const PROFILE_NAME_MAX_LENGTH = 40

// длина считается в code points (Array.from), а не в UTF-16 code units (обычный `.length`/
// `z.string().max()`) — иначе имя из суррогатных пар (эмодзи, редкие символы) могло бы либо
// не пройти валидацию на ровно допустимой длине, либо пройти и быть обрезано setName неровно
const profileNameSchema = z
  .string()
  .refine((value) => Array.from(value).length <= PROFILE_NAME_MAX_LENGTH)

export const profileNameSlot = createStorageSlot(
  'kinoshka:profile',
  profileNameSchema,
  '',
)
```

Ключ `kinoshka:profile` — тот же неймспейс, что у `kinoshka:favorites`, `kinoshka:theme`,
`kinoshka:genres`. Значение — просто строка (как у `kinoshka:theme`), а не объект: сейчас в профиле
ровно одно пользовательское поле, и заворачивать его в объект «на вырост» — то же YAGNI. Если в
Фазе 5 появится серверный профиль, схема всё равно будет переписана целиком.

`.refine()` в схеме работает и на чтение: слишком длинное значение, попавшее в `localStorage` мимо
UI, не пройдёт `safeParse` и деградирует в `''` — тот же защитный эффект, что у zod-валидации
избранного.

```ts
// src/features/profile/model/useProfile.ts
export type UseProfileResult = {
  name: string
  initials: string
  setName: (next: string) => void
  clearName: () => void
}
```

- `setName` — тримит вход и обрезает до `PROFILE_NAME_MAX_LENGTH` **символов (code points), а не
  UTF-16 code units**: `Array.from(trimmed).slice(0, PROFILE_NAME_MAX_LENGTH).join('')` — обычный
  `.slice(0, N)` по строке мог бы разрезать суррогатную пару пополам (та же причина, по которой
  `getInitials` ниже использует `Array.from`). UI-атрибут `maxLength` на инпуте — не гарантия:
  значение может прийти из автозаполнения/вставки.
- `clearName` — `profileNameSlot.set('')`, а не `.remove()`: `useStorageSlot` подписан на
  `subscribe`, а `remove()` не диспатчит событие изменения (см. `storage.ts` — уведомление шлёт
  только `set`), так что `remove()` не перерисовал бы подписчиков в текущей вкладке.
- `initials` — производное от `name` через `getInitials()`, считается на каждый рендер;
  мемоизация не нужна (React Compiler).

### Чистая функция инициалов

```ts
// src/features/profile/lib/getInitials.ts
export const getInitials = (name: string): string => { /* ... */ }
```

Правила:

- пустая строка / только пробелы → `''` (UI в этом случае рисует `<ProfileIcon />`, а не пустой кружок);
- одно слово → первый символ, в верхнем регистре;
- два и более слов → первый символ первого слова + первый символ второго;
- верхний регистр через `toLocaleUpperCase()` — не `toUpperCase()`: имя может быть кириллическим,
  и локаль-зависимый вариант корректнее для нелатинских алфавитов;
- первый символ берётся через `Array.from(word)[0]`, а не `word[0]` — `word[0]` режет суррогатную
  пару пополам (эмодзи/редкие символы в имени дали бы на экране «испорченный» символ).

### Доступные имена (a11y) — чтобы не создать коллизию селекторов

На мобильном одновременно в DOM присутствуют `ProfileAvatar` (в `MobileHeader`) и пункт `Profile`
в `BottomNav`. У них **разные роли** (`link` против `button`), поэтому `getByRole('link', { name: ... })`
и `getByRole('button', { name: 'Profile' })` не конфликтуют. Тем не менее имена задаются явно
и по-разному:

- `ProfileAvatar` → `aria-label='Your profile'` (и `'Your profile: <имя>'`, когда имя задано —
  иначе скринридер прочитает только пару букв инициалов);
- пункт `BottomNav` → видимый текст `Profile` (как сейчас, не трогаем).

Это тот же класс проблемы, который уже задокументирован в AGENTS.md для `BottomSheet`
(`'Dismiss'` вместо второго `'Close'`) — поэтому решается заранее, а не после падения спеки.

### Роутинг и chrome

```ts
// src/app/router.tsx
const ProfilePage = lazyNamed(() => import('../pages/profile'), 'ProfilePage')
// ...
{ path: '/profile', element: <ProfilePage /> },
```

```ts
// src/app/layouts/AppLayout.tsx — ROUTE_CHROME
'/profile': {
  active: 'profile',
  title: 'Profile',
},
```

`activeNav` не задаётся сознательно: у `Header` нет nav-pill профиля (см. таблицу соответствия в
докблоке `ROUTE_CHROME` — строка `profile → activeNav нет соответствия, active='profile'` там уже
есть, план её не меняет, а впервые делает истинной). `title: 'Profile'` означает, что на мобильном
`MobileHeader` покажет заголовок вместо search-триггера (`showSearch && !title`) — то же поведение,
что у `/favorites`/`/popular`/`/recommendations`.

**Принятое следствие:** на `/profile` `MobileHeader` всё равно отрисует `ProfileAvatar` справа
(`rightAction ?? <ProfileAvatar />`), то есть ссылку на текущую страницу. Это не ошибка навигации
и не a11y-violation, а небольшая избыточность; прятать аватар именно на `/profile` потребовало бы
нового поля в `RouteChromeConfig` ради одного маршрута. Оставлено как есть, зафиксировано здесь.

### Бандл

Новый page-слайс обязан получить:

- группу чанка в `vite.config.ts`: `{ name: 'page-profile', test: /\/pages\/profile\// }` — **после**
  группы `shared` и рядом с остальными page-группами (порядок важен: `shared` ловит
  `@widgets`/`@features`/`@entities`/`@shared` раньше, иначе межстраничный код прилипнет к
  page-группе — этот баг уже ловили ревью, см. AGENTS.md);
- запись в `"size-limit"` в `package.json` — реальный замер после сборки + 15%.

Дополнительно: `@features/profile` попадает в чанк `shared` (он матчится `/(widgets|features|entities|shared)\//`),
поэтому существующий бюджет `shared` (22.6 KB gzip) вырастет и, возможно, будет превышен —
его нужно пере-замерить и поднять в той же задаче, а не «когда-нибудь потом».

**Промежуточное состояние между Task 7 и Task 10 — не ошибка.** Роут `/profile` появляется в
Task 7, а группа чанка `page-profile` — только в Task 10, поэтому локальная прод-сборка,
сделанная в этом промежутке, положит `/profile` в чанк с именем, выведенным из содержимого,
а не в `page-profile-*.js`. Это безвредно — сборка в этом промежуточном состоянии не публикуется,
финальная сборка после Task 10 уже соответствует конвенции именования.

## What Goes Where

- **Implementation Steps** — весь код, тесты, e2e-спека, конфиги сборки и документация в этом
  репозитории.
- **Post-Completion** — ручная проверка на реальных устройствах, решения по возможным продолжениям
  (просмотрено/оценки/мой список) и то, что должно произойти с этим профилем в Фазе 5. Без
  чекбоксов, информационно.

## Implementation Steps

### Task 1: Чистая функция `getInitials`

**Files:**

- Create: `src/features/profile/lib/getInitials.ts`
- Create: `src/features/profile/lib/getInitials.test.ts`

- [ ] создать `getInitials(name: string): string` по правилам из Technical Details (пусто → `''`, одно слово → первая буква, два+ слова → первые буквы первых двух слов)
- [ ] использовать `toLocaleUpperCase()` и `Array.from(word)[0]`, добавить русский WHY-комментарий про кириллицу и суррогатные пары
- [ ] написать тест: `''`, `'   '`, `'\n\t'` → `''`
- [ ] написать тест: одно слово (`'oleg'` → `'O'`, `'олег'` → `'О'`)
- [ ] написать тест: два и более слов (`'oleg denisov'` → `'OD'`, `'олег  денисов'` с двойным пробелом → `'ОД'`, три слова → инициалы первых двух)
- [ ] написать тест: имя, начинающееся с эмодзи/символа вне BMP, не даёт «половину» суррогатной пары
- [ ] прогнать `make test` — должно проходить перед Task 2

### Task 2: Storage-слот `kinoshka:profile` и хук `useProfile()`

**Files:**

- Create: `src/features/profile/model/profileStorage.ts`
- Create: `src/features/profile/model/profileStorage.test.ts`
- Create: `src/features/profile/model/useProfile.ts`
- Create: `src/features/profile/model/useProfile.test.tsx`
- Create: `src/features/profile/index.ts`

- [ ] создать `profileStorage.ts`: `PROFILE_NAME_MAX_LENGTH = 40`, zod-схема `z.string().refine((value) => Array.from(value).length <= PROFILE_NAME_MAX_LENGTH)` (длина в code points, а не UTF-16 code units — WHY-комментарий на русском), `profileNameSlot = createStorageSlot('kinoshka:profile', schema, '')`
- [ ] создать `useProfile.ts` с типом `UseProfileResult` (`type`, не `interface`) и реализацией через `useStorageSlot(profileNameSlot)` + `getInitials`
- [ ] в `setName` тримить и обрезать до `PROFILE_NAME_MAX_LENGTH` символов через `Array.from(trimmed).slice(0, PROFILE_NAME_MAX_LENGTH).join('')` (не `.slice()` по строке — режет суррогатную пару пополам); в `clearName` вызывать `set('')`, а не `remove()` — с русским WHY-комментарием про то, что `remove()` не уведомляет подписчиков в текущей вкладке
- [ ] создать барель `src/features/profile/index.ts`: `useProfile`, `UseProfileResult`, `PROFILE_NAME_MAX_LENGTH` (`ProfileAvatar` добавится в Task 8)
- [ ] написать тесты `profileStorage.test.ts`: пустой `localStorage` → `''`; валидное значение читается; значение длиннее лимита в code points → `''`; имя из суррогатных пар (эмодзи) на границе лимита проходит валидацию; невалидный JSON/не-строка → `''`
- [ ] написать тесты `useProfile.test.tsx`: начальное состояние (`name === ''`, `initials === ''`); `setName('Oleg Denisov')` → `name`/`initials`/запись в `localStorage`; `setName('  Oleg  ')` тримится; имя длиннее лимита обрезается по code points, не разрезая эмодзи; `clearName()` сбрасывает и не ломает подписку
- [ ] в тестах чистить `localStorage` в `beforeEach` (ради единообразия с `useFavorites.test.ts`/`themeStorage.test.ts` — глобальный `afterEach`-clear уже есть в `src/test/setup.ts`)
- [ ] прогнать `make test` и `make typecheck` — должны проходить перед Task 3

### Task 3: Страница `/profile` — каркас, шапка и форма имени

**Files:**

- Create: `src/pages/profile/ProfilePage.tsx`
- Create: `src/pages/profile/index.tsx`
- Create: `src/pages/profile/ui/Profile/Profile.tsx`
- Create: `src/pages/profile/ui/Profile/Profile.module.css`
- Create: `src/pages/profile/ui/Profile/index.tsx`
- Create: `src/pages/profile/ui/Profile/Profile.test.tsx`

- [ ] создать страничный слайс по образцу `src/pages/favorites/` (`ProfilePage.tsx` → `<Profile />`, барели `index.tsx`)
- [ ] в `Profile.tsx` отрисовать `<h1>Profile</h1>`, крупный аватар (инициалы из `useProfile()` либо `<ProfileIcon />`, если `initials === ''`) и отображаемое имя (или `Guest`, если имя не задано)
- [ ] добавить форму редактирования имени: `<form onSubmit>` + `<input>` с `maxLength={PROFILE_NAME_MAX_LENGTH}` (UI-хинт в UTF-16 code units — сознательно строже схемы, которая считает в code points; источник истины по длине — `setName`, не атрибут), `aria-label`, локальный `draft`-стейт и кнопка `Save`, задизейбленная пока `draft.trim()` совпадает с сохранённым именем
- [ ] написать `Profile.module.css` mobile-first (база — мобильная вёрстка, десктопные правки в `@media (min-width: 720px)`), только `var(--token)`, включая `--avatar-gradient` для кружка
- [ ] написать тест: без сохранённого имени показывается `Guest` и нет инициалов
- [ ] написать тест: ввод имени + сабмит формы сохраняет его (имя и инициалы обновились, значение попало в `localStorage`)
- [ ] написать тест: кнопка `Save` задизейблена, пока значение не изменилось, и снова активируется после правки
- [ ] написать тест: ввод из одних пробелов не сохраняется как имя
- [ ] прогнать `make test` — должно проходить перед Task 4

### Task 4: Секция «Быстрый доступ»

**Files:**

- Modify: `src/pages/profile/ui/Profile/Profile.tsx`
- Modify: `src/pages/profile/ui/Profile/Profile.module.css`
- Modify: `src/pages/profile/ui/Profile/Profile.test.tsx`

- [ ] добавить блок «быстрый доступ»: `<Link>`-строки на `/favorites` (со счётчиком `useFavorites().ids.length`), `/popular`, `/recommendations` — с иконками `ListsIcon`/`TrendingIcon`/`StarIcon` и `ChevronRightIcon`
- [ ] стили блока в `Profile.module.css` — mobile-first, только `var(--token)`
- [ ] написать тест: счётчик избранного отражает содержимое `localStorage`
- [ ] написать тест: ссылки ведут на нужные пути (проверять `href`, а не навигацию)
- [ ] прогнать `make test` — должно проходить перед Task 5

### Task 5: Секция «Appearance» (выбор темы)

**Files:**

- Modify: `src/pages/profile/ui/Profile/Profile.tsx`
- Modify: `src/pages/profile/ui/Profile/Profile.module.css`
- Modify: `src/pages/profile/ui/Profile/Profile.test.tsx`

- [ ] добавить блок `Appearance`: трёхпозиционный выбор темы (`light`/`dark`/`system`) через `useTheme().theme`/`setTheme` — семантически группа радиокнопок (`<fieldset>`+`<legend>` либо `role='radiogroup'`), а не три отдельные кнопки, чтобы выбор был озвучен скринридером корректно
- [ ] в тестах сбрасывать `document.documentElement.removeAttribute('data-theme')` в `afterEach` (тот же приём, что в `MobileHeader.test.tsx`/`ThemeToggle.test.tsx`), иначе выставленная тема протечёт в соседние кейсы файла
- [ ] написать тест: выбор темы вызывает `setTheme` и отмечает выбранный вариант как активный (включая `system`)
- [ ] написать тест: клик по `ThemeToggle` в хедере после выбора `system` на `/profile` заменяет его на явный `light`/`dark` (см. Solution Overview, п.6) — задокументированное поведение, не регресс
- [ ] прогнать `make test` — должно проходить перед Task 6

### Task 6: Секция «Сброс» (Clear name) и информационная подпись

**Files:**

- Modify: `src/pages/profile/ui/Profile/Profile.tsx`
- Modify: `src/pages/profile/ui/Profile/Profile.module.css`
- Modify: `src/pages/profile/ui/Profile/Profile.test.tsx`

- [ ] добавить кнопку `Clear name`, видимую только когда имя задано, вызывающую `clearName()` из `useProfile()`
- [ ] добавить информационную подпись про локальный профиль и будущий вход по аккаунту (текст, не контрол — см. решение 1 в Solution Overview)
- [ ] написать тест: `Clear name` не отображается без имени и очищает имя, когда оно задано
- [ ] прогнать `make test` — должно проходить перед Task 7

### Task 7: Роут `/profile`, chrome в `AppLayout`, включение пункта в `BottomNav`, смоук-тест роутинга

**Files:**

- Modify: `src/app/router.tsx`
- Modify: `src/app/router.test.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `src/app/layouts/AppLayout.test.tsx`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.tsx`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.module.css`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.test.tsx`

- [ ] добавить в `router.tsx` `ProfilePage` через `lazyNamed(() => import('../pages/profile'), 'ProfilePage')` и маршрут `{ path: '/profile', element: <ProfilePage /> }` под `AppLayout`
- [ ] добавить в `router.test.tsx` смоук-тест `/profile → ProfilePage`, обновив заголовок существующего `describe` и комментарий над ним с «5» на «6 оставшихся роутов» (после `/` их резолвит первый `describe`) — по образцу теста для `/favorites`, резолв `lazyNamed()`-экспорта без опечатки в имени, единственный gate в CI, ловящий эту ошибку; ассерт делать по уникальному маркеру страницы (тексту информационной подписи из Task 6), а не по слову «Profile» — оно встречается на странице минимум дважды
- [ ] зарегистрировать `/profile` в собственной route-таблице `AppLayout.test.tsx` (`renderAt`'s `createMemoryRouter([...])` `children`) — плейсхолдер-элемент, как у остальных шести маршрутов; без этого новый тест из этого файла падает с «нет banner», а не с содержательной ошибкой, потому что `createMemoryRouter` не находит матч на `/profile`
- [ ] добавить в `ROUTE_CHROME` запись `'/profile': { active: 'profile', title: 'Profile' }` (без `activeNav` — у `Header` нет пункта профиля)
- [ ] обновить докблок `router.tsx` («все шесть роутов») и вводную фразу докблока `ROUTE_CHROME` в `AppLayout.tsx` (список заполненных маршрутов) — теперь их семь
- [ ] в `BottomNav.tsx` заменить `path: null` на `'/profile'` у пункта `profile`, сузить тип `path: string | null` до `string`, убрать проверку `it.path &&` в `onClick` и класс `navItemDisabled` из `className`
- [ ] удалить ставший мёртвым `.navItemDisabled` из `BottomNav.module.css`
- [ ] заменить тест «пункт Profile остаётся задизейбленным» на тест «клик по Profile ведёт на /profile» и добавить тест подсветки активного пункта на `active='profile'`
- [ ] поправить тест «6 колонок» — убрать ассерт про `navItemDisabled`, оставить проверку количества пунктов
- [ ] добавить тест в `AppLayout.test.tsx`: на `/profile` рендерится мобильный chrome с заголовком `Profile` и активным пунктом `profile` в `BottomNav`
- [ ] прогнать `make test` и `make typecheck` — должны проходить перед Task 8

### Task 8: Компонент `ProfileAvatar` в `@features/profile`

**Files:**

- Create: `src/features/profile/ui/ProfileAvatar/ProfileAvatar.tsx`
- Create: `src/features/profile/ui/ProfileAvatar/ProfileAvatar.module.css`
- Create: `src/features/profile/ui/ProfileAvatar/index.tsx`
- Create: `src/features/profile/ui/ProfileAvatar/ProfileAvatar.test.tsx`
- Modify: `src/features/profile/index.ts`

- [ ] создать `ProfileAvatar` — `<Link to='/profile'>` с инициалами из `useProfile()` либо `<ProfileIcon />`, если имя не задано
- [ ] задать `aria-label`: `'Your profile'` без имени и `` `Your profile: ${name}` `` с именем (см. раздел про a11y в Technical Details)
- [ ] перенести стили кружка в `ProfileAvatar.module.css` mobile-first: база — `font-size: 10px` + `flex-shrink: 0` + `text-decoration: none` (новый элемент — `<a>`, а не `<div>`, как был старый `.avatar` — без явного сброса инициалы отрендерятся подчёркнутыми), в `@media (min-width: 720px)` — `font-size: 11px`; плюс остальные свойства старого `.avatar` без изменений — `width`/`height: 32px`, `border-radius: 999px`, `display: flex` + центрирование, `font-family: var(--font-mono)`, `color: var(--text-primary)`, `cursor: pointer`, фон `var(--avatar-gradient)`, рамка `var(--border-strong)`
- [ ] добавить `:focus-visible` стиль (например, `outline` в `var(--accent-warm)`) — у старого `<div>` фокус-стиля не требовалось, у нового интерактивного `<a>` он нужен
- [ ] экспортировать `ProfileAvatar` из `src/features/profile/index.ts`
- [ ] написать тест: без имени рендерится ссылка на `/profile` с доступным именем `Your profile` и без текстовых инициалов
- [ ] написать тест: с сохранённым именем видны инициалы и доступное имя содержит само имя
- [ ] прогнать `make test` — должно проходить перед Task 9

### Task 9: Подключить `ProfileAvatar` в `Header` и `MobileHeader`, убрать дублированный CSS

**Files:**

- Modify: `src/widgets/header/ui/Header/Header.tsx`
- Modify: `src/widgets/header/ui/Header/Header.module.css`
- Modify: `src/widgets/header/ui/Header/Header.test.tsx`
- Modify: `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.tsx`
- Modify: `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.module.css`
- Modify: `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.test.tsx`

- [ ] в `Header.tsx` заменить `<div className={s.avatar}>AV</div>` на `<ProfileAvatar />` из `@features/profile`
- [ ] в `MobileHeader.tsx` заменить `rightAction ?? <div className={s.avatar}>AV</div>` на `rightAction ?? <ProfileAvatar />`
- [ ] удалить класс `.avatar` из `Header.module.css` и из `MobileHeader.module.css` (проверить, что на него больше нет ссылок)
- [ ] добавить тест в `Header.test.tsx`: аватар — ссылка на `/profile`, показывает инициалы сохранённого имени
- [ ] добавить тест в `MobileHeader.test.tsx`: то же самое, плюс что переданный `rightAction` по-прежнему перекрывает аватар (регресс-гард для `/movie/:id`, где справа кнопка «поделиться»)
- [ ] прогнать `make test` и `make typecheck` — должны проходить перед Task 10

### Task 10: Бандл — группа чанка `page-profile` и бюджеты `size-limit`

**Files:**

- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] добавить в `codeSplitting.groups` группу `{ name: 'page-profile', test: /\/pages\/profile\// }` рядом с остальными page-группами (после `shared`, не перед)
- [ ] выполнить `make build-only` и зафиксировать реальные gzip-размеры `page-profile-*.js` и `shared-*.js`
- [ ] добавить в `"size-limit"` запись `page-profile` с лимитом «реальный замер + 15%», как у остальных записей
- [ ] пере-замерить и при необходимости поднять лимит `shared` (в него попадает `@features/profile`), не трогая остальные лимиты без причины
- [ ] прогнать `make size` — все бюджеты должны проходить
- [ ] прогнать `make knip`; если он пометит экспорты нового бареля `src/features/profile/index.ts` как неиспользуемые, добавить его в `ignore` в `knip.jsonc` с комментарием-обоснованием (тот же приём, что уже применён к барелям `catalog-filter`/`favorites`/`theme`)
- [ ] прогнать `make lint` и `make typecheck` — должны проходить перед Task 11

### Task 11: E2E-спека `/profile` + проверка axe

**Files:**

- Create: `e2e/profile.spec.ts`

- [ ] написать спеку: переход на `/profile`, ввод имени, сохранение, `page.reload()` — имя сохранилось (проверка реальной персистентности в `localStorage`, а не только React-стейта)
- [ ] проверить, что после сохранения имени аватар в шапке показывает инициалы и ведёт на `/profile`
- [ ] проверить быстрый доступ: клик по `Favorites` (`getByRole('link', { name: 'Favorites' })` — коллизии с `NavPill` в хедере нет, тот рендерится `<button>`) уводит на `/favorites`
- [ ] добавить `await checkA11y(page)` из `e2e/utils/a11y.ts` — ноль violations с `impact === 'critical'`
- [ ] селекторы — только по `role`/`label`/`placeholder`/тексту, без `data-testid` (правило AGENTS.md)
- [ ] выполнить `make build-only`, затем `pnpm exec playwright test e2e/profile.spec.ts --project=chromium` (точечно, не весь `make e2e` — см. Testing Strategy про экономию API-квоты) — спека должна проходить; зафиксировать в плане, что спека не делает ни одного запроса к API
- [ ] мобильную спеку (`e2e/mobile/`) не добавлять — обоснование в Testing Strategy

### Task 12: Verify acceptance criteria

- [ ] проверить, что ни одной заглушки из бэклога не осталось: `grep -rn "AV" src/widgets` не находит захардкоженного аватара, `path: null` в `BottomNav` отсутствует, `.navItemDisabled` удалён
- [ ] проверить, что на странице нет ни одного контрола, который ничего не делает (в т.ч. не появилась disabled-кнопка входа)
- [ ] проверить краевые случаи: очень длинное имя (обрезка по code points, не по code units), имя из эмодзи, пустое избранное, тема `system`, cross-tab-синхронизация имени между двумя вкладками
- [ ] прогнать полный набор: `make check` (lint + build), `make test`, `make size`, `make knip`
- [ ] прогнать `pnpm exec playwright test e2e/profile.spec.ts --project=chromium` после `make build-only` (точечно, не весь `make e2e` — см. Testing Strategy)
- [ ] проверить обе темы (`light`/`dark`) на новой странице — ни одного хардкоженного цвета, всё через токены

### Task 13: [Final] Документация

**Files:**

- Modify: `AGENTS.md`
- Create: `docs/backlog/dead-header-controls.md`
- Delete: `docs/backlog/user-profile-block.md`
- Modify: `plans/roadmap.md`
- Move: `docs/plans/20260916-user-profile-block.md` → `docs/plans/completed/`

- [ ] добавить в `AGENTS.md` раздел про `@features/profile`: client-only профиль, ключ `kinoshka:profile`, `ProfileAvatar` как третий пример «UI фичи, рендерящейся из обоих виджетов-хедеров» (после `ThemeToggle`), решение «никаких disabled-заглушек авторизации»
- [ ] дополнить в `AGENTS.md` таблицу «Key public APIs» строкой `@features/profile`
- [ ] отметить в `AGENTS.md`, что задизейбленных пунктов в `BottomNav` больше нет и тип `path` сужен до `string`
- [ ] обновить в `AGENTS.md` список маршрутов в разделе Routing («`/`, `/search`, `/movie/:id`, `/favorites`, `/popular`, `/recommendations`») — добавить `/profile`
- [ ] обновить в `AGENTS.md` формулировку «`router.tsx` uses it for all 6 routes» (раздел про `lazyNamed`) — теперь их 7
- [ ] обновить в `AGENTS.md` перечисление `codeSplitting.groups` (раздел «Performance budgets») — добавить `page-profile` в список явных page-групп
- [ ] обновить в `AGENTS.md` формулировку «all 6 page slices are imported through an identically-named `index.tsx` barrel» — теперь их 7
- [ ] обновить в `AGENTS.md` раздел «`size-limit` budgets» — добавить `page-profile` в перечисление 10 записей (станет 11) и актуализировать измеренную цифру `shared` после её пере-замера в Task 10
- [ ] обновить в `AGENTS.md` раздел про E2E — формулировку «the app has 6 routes total (`/`, `/search`, …)» и зафиксировать там же решение «`/profile` не добавляется в мобильный сьют» (см. Testing Strategy)
- [ ] дописать в `plans/roadmap.md` (Фаза 5) заметку: client-only профиль уже существует в `main`, при появлении реальной сессии заменяется источник данных `useProfile()`, а роут/страница/навигация переиспользуются
- [ ] создать `docs/backlog/dead-header-controls.md` с YAML-фронтматтером (`worth: later`, `added: 2026-09-16`, по образцу существующих файлов в `docs/backlog/`), зафиксировав мёртвые элементы профильного UI, найденные при работе над этим планом: `Header.tsx` — `IconButton aria-label='Notifications'` без `onClick` (плюс декоративная точка непрочитанного); `AppLayout.tsx` `MOVIE_CHROME.rightAction` — `IconButton aria-label='Share'` без обработчика; `Footer.tsx` — статические нерабочие `<li>`-ссылки колонки «Account» (`My lists`/`Watched`/`Ratings`/`Recommendations`) (см. Solution Overview, п.9)
- [ ] удалить `docs/backlog/user-profile-block.md` — пункт закрыт (жизненный цикл бэклога: создать → сделать → удалить)
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

*Пункты, требующие ручных действий или внешних систем — без чекбоксов, информационно.*

**Ручная проверка:**

- пройти `/profile` на реальном мобильном устройстве (не только в эмуляции вьюпорта): попадание
  пальцем по пункту `Profile` в `BottomNav`, поведение экранной клавиатуры при фокусе в поле имени
  (не перекрывает ли она кнопку `Save`), безопасные зоны iOS.
- проверить страницу со скринридером (VoiceOver): озвучивание группы выбора темы (`radiogroup`),
  ссылки-аватара и кнопки `Clear name`.
- проверить приватный режим браузера, где `localStorage` может быть недоступен/сбрасываться:
  страница должна деградировать до «имя не задано», а не падать.

**Что дальше (вне скоупа этого плана):**

- «Просмотрено», пользовательские оценки, «мой список» — из бэклог-пункта. Каждой из этих фич
  нужен свой аффорданс в остальном UI (кнопка на карточке фильма/детальной странице), поэтому это
  отдельная работа, а не довесок к профилю. Если она понадобится — заводить отдельный
  бэклог-пункт/план, а не расширять этот.
- Аватар как картинка (загрузка файла/градиент по хешу имени) — сейчас только инициалы.

**Фаза 5 (когда появится реальный auth):**

- `@features/profile/model/*` — единственная часть, которая заменяется: `useProfile()` начинает
  читать имя/логин из сессии BFF вместо `localStorage`. Страница, роут, chrome, `ProfileAvatar`,
  включённый пункт `BottomNav` и быстрые ссылки переиспользуются как есть.
- Тогда же появится место для реальной кнопки входа/выхода — на месте текущей информационной
  подписи о локальном профиле.
- Локальное имя из `kinoshka:profile` в этот момент придётся либо мигрировать в серверный профиль,
  либо осознанно выбросить — решение принимается в auth-ветке, здесь не предопределяется.
