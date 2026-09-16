# Страница персоны `/person/:id`

## Обзор

- Добавить отдельную страницу персоны (актёра / члена съёмочной группы) по адресу `/person/:id`, построенную по тому же паттерну, что уже работающая `/movie/:id`.
- Решаемая проблема: клик по актёру в `CastTab` и по имени члена съёмочной группы в `OverviewTab` сейчас никуда не ведёт — карточки персон на `/movie/:id` статичны, тупик в навигации. Пользователь не может перейти от фильма к актёру и от актёра обратно к другим его фильмам.
- Что даёт: базовая информация о персоне (фото, имя/оригинальное имя, дата рождения и возраст, дата смерти и место, место рождения, рост, профессии, число наград), фильмография со ссылками на `/movie/:id`, интересные факты. Плюс закольцованная навигация «фильм → персона → фильм».
- Интеграция с системой: новый entity-слайс `@entities/person` (типы, фетчер, маппер, Suspense-хук) + новый page-слайс `src/pages/person/`; новый роут под тем же `AppLayout`, что и остальные шесть; новый chrome-конфиг `PERSON_CHROME`; новая группа код-сплиттинга `page-person` и бюджет `size-limit`. `createCachedFetcher` (сейчас живёт в `@entities/movie`) переезжает в `@shared/lib` — без этого `@entities/person` пришлось бы импортировать инфраструктуру из соседнего entity-слайса, что запрещено направлением FSD (`pages → widgets → features → entities → shared`, без горизонтальных импортов между entity-слайсами).
- API уже сгенерирован, регенерировать ничего не нужно: `apiClient.getV15PersonById({ path: { id } })` (`PersonControllerFindOneV15` в `instance.gen.ts`) возвращает `Person`.

## Контекст (из исследования)

- **Файлы/компоненты, затрагиваемые задачей:**
  - `src/app/router.tsx` — 6 роутов через `lazyNamed` под одним `AppLayout`; сюда добавляется седьмой.
  - `src/app/layouts/AppLayout.tsx` — `ROUTE_CHROME` (карта по точному `pathname`) + отдельные `MOVIE_CHROME`/`SEARCH_CHROME`, матчащиеся через `useMatch`/`isSearchRoute`. Требует `PERSON_CHROME`.
  - `src/pages/movie/MoviePage.tsx` — эталон тонкой страницы-обёртки.
  - `src/entities/movie/api/createCachedFetcher.ts` — переезжает в `src/shared/lib/cachedFetcher/`, т.к. становится общей инфраструктурой для `@entities/movie` и `@entities/person`.
  - `src/entities/movie/api/getMovieDetail.ts`, `mapDtoToMovieDetail.ts` — эталон слоя данных.
  - `src/entities/movie/hooks/useMovieDetail.ts` — эталон Suspense-хука на `use()` + companion-инвалидация.
  - `src/pages/movie/ui/tabs/CastTab/CastTab.tsx` — карточки актёров, сейчас статичные `div`.
  - `src/pages/movie/ui/tabs/OverviewTab/OverviewTab.tsx` + `src/pages/movie/lib/groupCrewByProfession.ts` — имена crew, сейчас склеенные в строку.
  - `src/test/setup.ts` — импортирует `resetAllCachedFetchers`, путь импорта изменится.
  - `vite.config.ts` (`codeSplitting.groups`), `package.json` (`size-limit`).
- **Найденные паттерны:**
  - **Responsive pattern (актуальный):** один mobile-first компонент + один CSS-модуль, десктоп — через `@media (min-width: 720px)`. Пар `*Desktop`/`*Mobile` больше нет (миграция `docs/plans/20260827-mobile-first-adaptive-layout.md`). Формулировка бэклога про «пару `PersonDesktop`/`PersonMobile`» и про `MovieMobile`'s `MobileCast` — устаревшая, не следуем ей.
  - **404-паттерн:** `ApiError` из `@shared/api` + `AsyncBoundary.errorFallback` с проверкой `error instanceof ApiError && error.status === 404`, `onRetry` → companion-функция `invalidate*`.
  - **Кеш-паттерн:** `createCachedFetcher<P, R>(key, fetcher, options?)` даёт TTL, session-persist (только в DEV), 403-cooldown и `.invalidate(params)`.
  - **Suspense-паттерн:** `use(promise)` поверх стабильной ссылки на промис из `createCachedFetcher`.
  - **FSD:** `pages → widgets → features → entities → shared`, импорты только через публичный барель слайса; между слайсами одного уровня (например, двумя `entities/*`) горизонтальных импортов нет — общая инфраструктура живёт в `shared`.
  - **Стиль TS:** `type`, не `interface`; компоненты — `const Foo = (...) =>`, без `React.FC`.
- **Найденные зависимости:**
  - `Person` DTO (`src/shared/api/types.gen.ts`): `id`, `name`, `enName`, `photo`, `sex`, `growth`, `birthday`, `death`, `age`, `birthPlace[]`, `deathPlace[]`, `spouses[]`, `countAwards`, `profession[]` (`Profession = { value?, professionId? }`), `facts[]` (`FactInPerson = { value? }`), `movies[]` (`MovieInPerson`).
  - `MovieInPerson = { id, name?, alternativeName?, rating?, general?, description?, enProfession?, professionId? }` — **нет** `poster`/`type`/`genre`/`year`.
  - Ошибки `PersonControllerFindOneV15Error` (400/401/403/404) — та же форма `{ statusCode, message }`, что у movie. 404 у API документирован как «персона не найдена» (имя DTO `ForbiddenErrorResponseDto` — квирк спеки, не 403).
  - `formatDate()` (`@entities/movie/lib`) — опциональный второй параметр `locale`, по умолчанию `navigator.language`. Вызывать только из page-слоя.
  - `createCachedFetcher` (`src/entities/movie/api/createCachedFetcher.ts`) сейчас **не** экспортируется из публичного барреля `@entities/movie` (`src/entities/movie/index.ts` отдаёт только `resetAllCachedFetchers`) и зависит только от `@shared/lib`'s `createSessionCache` + типа `Movie` (используется исключительно как дефолт дженерика `R = Movie[]`) — перенос в `@shared/lib` возможен без разрыва зависимостей, если убрать этот дефолт.
- **Проверено живым запросом** (`GET /v1.5/person/6317`, ключ из `.env.local`):
  - `photo` отдаётся с `https://avatars.mds.yandex.net/...` — хост **уже** в `img-src` в `vercel.json`, правки CSP не нужны.
  - У персоны 94 записи в `movies[]`, `general: true` — **ни у одной**; `enProfession` принимает значения `actor`/`producer`/`cameo`/`uncredited`.
  - `facts[]` — в этой выборке простой текст, но Kinopoisk в целом известен тем, что иногда кладёт в `facts[].value` HTML-разметку (`<span class="...">`) — маппер должен это учитывать (см. «Технические детали»).
  - Отдельного эндпоинта «фото персоны» нет: `/v1.5/image` фильтруется по `movieId` (см. `getMovieImages.ts`), поэтому «фото» из бэклога сводится к единственному полю `photo`.

## Подход к разработке

- **Подход к тестированию: Regular** (сначала код, затем тесты в рамках той же задачи) — так написаны все существующие планы и тесты в репозитории.
- [ ] выполнять каждую задачу полностью, прежде чем переходить к следующей
- [ ] делать маленькие сфокусированные изменения
- [ ] **КРИТИЧНО: каждая задача ОБЯЗАНА содержать новые/обновлённые тесты** на код, меняющийся в этой задаче
  - [ ] писать юнит-тесты на новые функции/компоненты
  - [ ] писать юнит-тесты на изменённые функции/компоненты
  - [ ] добавлять кейсы на новые ветки кода
  - [ ] обновлять существующие тесты, если поведение изменилось
  - [ ] покрывать и успешные, и ошибочные сценарии
- [ ] **КРИТИЧНО: все тесты должны проходить до старта следующей задачи** — без исключений
- [ ] **КРИТИЧНО: обновлять этот файл плана, если scope меняется по ходу реализации**
- [ ] запускать `make test` после каждого изменения
- [ ] сохранять обратную совместимость (`/movie/:id` не должна сломаться)
- [ ] использовать `type`, не `interface`; компоненты объявлять как `const Foo = (...) =>`, без `React.FC`
- [ ] все WHY-комментарии в коде — на русском, как принято в репозитории; строки UI — на английском (как «Cast», «Synopsis», «Movie not found» в существующих компонентах)
- [ ] не хардкодить цвета — только `var(--token)` из `src/app/styles/global.css` (иначе светлая тема сломается)
- [ ] не создавать горизонтальных импортов между слайсами одного уровня (в частности, `@entities/person` никогда не импортирует `@entities/movie`, и наоборот) — общая инфраструктура выносится в `@shared/lib`

## Стратегия тестирования

- [ ] **юнит-тесты**: обязательны в каждой задаче (см. «Подход к разработке» выше), Vitest + Testing Library, co-located `*.test.ts(x)`
- [ ] **моки API**: только MSW (`msw/node`, `setupServer()` в `src/test/setup.ts`, `onUnhandledRequest: 'error'`) — никакого ручного мока `fetch`/`apiClient`
- [ ] **изоляция кеша между тестами**: `createCachedFetcher` персистит error-снапшоты (403/404-cooldown) в `sessionStorage` при `import.meta.env.DEV` (в Vitest это `true`); глобальный `afterEach` в `src/test/setup.ts` сбрасывает только in-memory состояние, не `sessionStorage` — тесты на ошибочные сценарии обязаны использовать уникальный `id`/ключ на кейс (по образцу `getMovieDetail.test.ts`: 101/102/666/555) либо явно чистить `sessionStorage` в `beforeEach`
- [ ] **e2e**: у проекта есть Playwright-спеки в `e2e/*.spec.ts`
  - [ ] изменения UI → добавить/обновить e2e в той же задаче, что и код UI
  - [ ] относиться к e2e так же строго, как к юнит-тестам (должны проходить до следующей задачи)
  - [ ] новый спек кладётся в `e2e/`, `knip.jsonc` править **не нужно** — его `entry` уже содержит глоб `"e2e/**/*.spec.ts"`
  - [ ] помнить про квоту демо-тарифа API (200 запросов/день): один сценарий на журнал, один `checkA11y(page)` на спек, а не на каждый таб/клик
  - [ ] перед `make e2e` обязателен `make build-only` — `webServer` в `playwright.config.ts` поднимает `vite preview` над уже собранным `dist/`, сам не собирает
- [ ] **a11y**: `checkA11y(page)` из `e2e/utils/a11y.ts` (критичные нарушения axe) — на новой странице как минимум один вызов
- [ ] **бюджеты**: `make size` после `make build-only` — новая запись `page-person` должна проходить

## Отслеживание прогресса

- [ ] отмечать выполненные пункты `[x]` сразу по факту
- [ ] новые обнаруженные задачи добавлять с префиксом ➕
- [ ] проблемы/блокеры фиксировать с префиксом ⚠️
- [ ] обновлять план, если реализация отклоняется от исходного scope
- [ ] держать план в синхроне с реально сделанной работой

## Обзор решения

**Выбранная архитектура: отдельный entity-слайс `@entities/person` + отдельный page-слайс `src/pages/person/`, зеркально `@entities/movie` + `src/pages/movie/`.**

Рассмотренные альтернативы:

- **Вариант 1 (выбран): новый entity-слайс `@entities/person`.** Данные персоны — самостоятельный домен: свой DTO, свой эндпоинт, свой маппер, свой Suspense-хук. Полностью повторяет уже работающую схему `@entities/movie` (`getMovieDetail` тоже используется ровно одной страницей — это не аргумент против entity-слоя, а действующий прецедент репозитория). Плюсы: соответствует конвенции FSD и существующему коду; фетчер сразу получает TTL/cooldown/инвалидацию через `createCachedFetcher`; будущий `/person/search` или карусель «другие работы» подключится без переездов. Минус: `@entities/person` попадёт в чанк `shared` (группа `{ name: 'shared', test: /\/(widgets|features|entities|shared)\// }` стоит раньше page-групп), то есть ~1 kB маппера/фетчера будет грузиться на всех роутах, включая те, где персон нет. Принято как компромисс — переупорядочивать группы ради одного слайса нельзя, это сломает всю схему `shared` (см. AGENTS.md, «Performance budgets»).
- **Вариант 2 (отклонён): держать данные персоны внутри `@entities/movie`.** Формально «работает» (там уже лежат `CastMember`/`CrewMember`), но смешивает два домена в одном слайсе и делает барель `@entities/movie` свалкой. Отклонён.
- **Вариант 3 (отклонён): всё в page-слайсе `src/pages/person/` (api + model прямо там, без entity).** Единственный реальный плюс — весь код персоны попал бы в ленивый чанк `page-person`, а не в `shared`. Минусы перевешивают: нарушает конвенцию «данные домена живут в `entities`», запрещает переиспользование из любого другого слайса, и `model/`-фасад в page-слайсе конвенцией предназначен для _композиции нескольких нижних слайсов_ (как `useMovieCatalog`), а не для единственного доменного фетча. Отклонён.

**Выбранный формат фильмографии: Вариант C — компактный текстовый список кредитов со ссылками, без постеров.**

- **Вариант A (отклонён): замапить `MovieInPerson` → `Movie` с дефолтами (`type: 'movie'`, `genre: []`, `poster: undefined`, `hue: hashHue(id)`) и переиспользовать `Card`.** Прецедент в репозитории есть (`mapDocToMovie` для `/popular` тоже подставляет дефолты — «accepted default»). Но: у реальной персоны (проверено на id 6317) 94 кредита, и ни один не несёт `poster`/`year`/`genre`. `Card` рендерит `movie.year ? movie.year : 'Unknown'` — то есть получится сетка из 94 одинаковых градиентных заглушек с подписью «Unknown» и без жанра. Это хуже честного списка и при этом требует кормить общий компонент выдуманными полями.
- **Вариант B (отклонён на этот этап): догрузить реальные карточки через `getMoviesByIds()` по id из `movies[]`.** Даёт настоящие постеры/годы/жанры, но стоит N запросов на визит при квоте демо-тарифа 200/день (даже с ограничением «первые N» это N запросов на каждую новую персону). Оставлен в Post-Completion как возможное улучшение «Known for» top-N.
- **Вариант C (выбран): собственный компактный список кредитов.** Каждая строка — `<Link to={/movie/:id}>` с названием, рейтингом и ролью (`description` — имя персонажа) — ровно те поля, которые API реально отдаёт. 0 дополнительных запросов, 0 выдуманных данных, спокойно масштабируется на 94+ записей (сворачивание за порогом). Группировка по `enProfession` (actor/producer/director/...) с предпочтительным порядком.

**Ключевые решения и обоснование:**

- **`createCachedFetcher` переезжает в `@shared/lib`.** Первоначальный вариант плана предлагал импортировать его напрямую из `@entities/movie` — но это ровно тот кросс-импорт двух entity-слайсов одного уровня, который план сам запрещает для `formatDate` (см. ниже). `@entities/person` не может законно зависеть от `@entities/movie`. Поскольку `createCachedFetcher` — инфраструктурная утилита без доменной логики (её единственная реальная зависимость — `createSessionCache` из `@shared/lib`; `Movie` использовался только как дефолт дженерика), правильное место для неё — `@shared/lib`, рядом с `createSessionCache`. Это отдельная задача (Задача 2), выполняемая до того, как `@entities/person` начнёт её использовать.
- **Без табов.** `/movie/:id` использует `MovieTabsNav` с 4 табами, потому что у фильма 4 больших разных раздела. У персоны содержательных блока три (герой, фильмография, факты) — обычная скроллируемая страница с секциями проще и не требует ремаунта по `key`. Не копируем `MovieTabsNav` ради симметрии.
- **`formatDate` вызывается из page-слоя, не из маппера.** `formatDate` живёт в `@entities/movie`; импорт из `@entities/person` был бы кросс-импортом двух entity-слайсов одного уровня — это нарушение FSD (тот же принцип, что и у `createCachedFetcher` выше, только тут решение — не тащить `formatDate` в `@shared/lib`, а просто форматировать в page-слое, где кросс-импорт `@entities/movie` уже легален). Маппер возвращает сырые ISO-строки, форматирование делает `PersonHero` (слой `pages`, импортировать `@entities/movie` ему законно).
- **Фолбэк-градиент вместо `hashHue`.** `hashHue` не экспортируется из бареля `@entities/movie` (он внутренний), а расширять публичный API ради одного градиента не нужно. Берём фиксированный `FALLBACK_HUE = 220` — ровно тот же приём, что уже применён в `CastTab.tsx` для персон без фото. Дублирование константы между двумя page-компонентами сознательно предпочтено преждевременной абстракции.
- **Факты очищаются от HTML-тегов в маппере, рендерятся как обычный текст.** `dangerouslySetInnerHTML` не используется нигде в `src/` (проверено при внедрении CSP), а политика содержит `require-trusted-types-for 'script'` — заводить его ради `facts[]` не стоит. Но Kinopoisk иногда кладёт в `facts[].value` HTML-разметку (`<span class="...">`), и если просто рендерить это текстом, пользователь увидит сырые теги. Решение: `mapDtoToPersonDetail` вырезает теги простым `replace(/<[^>]*>/g, '')` перед тем, как положить строку в `PersonDetail.facts` — не ослабляет CSP/Trusted Types (это не выполнение разметки, а её отбрасывание) и закрывается одной строкой кода плюс одним тестом. **Принятое ограничение:** HTML-сущности (`&laquo;`, `&nbsp;` и т.п.) при этом не декодируются и могут отрендериться как есть — это не полная санитизация текста, декодирование сущностей осталось за рамками этой задачи.
- **`sex` не входит в `PersonDetail`, `deathPlace` — входит и рендерится.** Ни одно поле не должно попадать в тип/маппер без реального потребителя (YAGNI). `sex` не показывается нигде в UI по этой задаче — не мапим его вовсе. `deathPlace`, наоборот, получает собственную строку «Died in» в `PersonHero` (см. Задачу 6) — иначе это было бы точно такое же неиспользуемое поле.
- **`PERSON_CHROME` обязателен.** В `AppLayout` `config` резолвится как `ROUTE_CHROME[pathname]` с точечными исключениями через `useMatch`. Без явного конфига для `/person/:id` `config` будет `undefined`, из-за чего на мобильном не отрендерится `BottomNav` (`{isMobile && config && <BottomNav .../>}`) и не будет кнопки «назад». Берём форму `MOVIE_CHROME` (`active: 'search'`, `onBack: true`, `showSearch: false`), но **без** `rightAction` — кнопка «поделиться» там появилась как повторение поведения удалённого `MovieMobile.tsx`, у персоны такого исторического поведения нет, и заводить её «для симметрии» не нужно (подтверждено при планировании).

## Технические детали

**Новые типы (`src/entities/person/model/types.ts`):**

```ts
// Один кредит фильмографии. Намеренно НЕ `Movie`: `MovieInPerson` не отдаёт
// poster/type/genre/year, поэтому приведение к `Movie` потребовало бы выдуманных
// дефолтов (см. «Обзор решения», отклонённый вариант A).
export type PersonMovieCredit = {
  id: number
  title: string
  rating?: number
  // `description` в DTO — имя персонажа для актёров; для остальных профессий обычно пусто.
  role?: string
  // сырой `enProfession` (actor/producer/director/...); маппинг в человекочитаемую
  // подпись делает page-слой, чтобы entity не занимался презентацией.
  profession?: string
}

export type PersonDetail = {
  id: number
  name: string
  enName?: string
  photo?: string
  // ISO-строки как есть — форматирование локалью живёт в page-слое (formatDate).
  birthday?: string
  death?: string
  age?: number
  growth?: number
  birthPlace: string[]
  deathPlace: string[]
  countAwards?: number
  professions: string[]
  // Теги уже вырезаны в мапере (см. mapDtoToPersonDetail) — компонент рендерит как есть.
  facts: string[]
  movies: PersonMovieCredit[]
}
```

**Маппер (`src/entities/person/api/mapDtoToPersonDetail.ts`):**

- `name: dto.name ?? dto.enName ?? ''` — у части персон заполнено только `enName`.
- `enName`: не дублировать, если совпало с `name` (`dto.enName && dto.enName !== name ? dto.enName : undefined`).
- `birthPlace`/`deathPlace`: `dto.birthPlace?.map(p => p.value).filter((v): v is string => !!v) ?? []`.
- `professions`: `dto.profession?.map(p => p.value).filter(Boolean) ?? []` — дедуплицировать через `Set` (API возвращает повторы).
- `facts`: `dto.facts?.map(f => f.value).filter(Boolean).map(v => v.replace(/<[^>]*>/g, '').trim()).filter(Boolean) ?? []` — вырезать HTML-теги (см. «Ключевые решения»), затем отбросить то, что стало пустой строкой после очистки.
- `movies`: `dto.movies?.map(...)`, `title: m.name ?? m.alternativeName ?? ''`; записи с пустым `title` отбрасываются (ссылка без имени бесполезна и ломает доступное имя ссылки).
- `sex` из DTO **не мапится** — нет потребителя в этой задаче (YAGNI, см. «Ключевые решения»).
- Все `null` из DTO нормализуются в `undefined` (в остальном коде репозитория так же).

**Перенос `createCachedFetcher` в `@shared/lib`:**

- Новый путь: `src/shared/lib/cachedFetcher/createCachedFetcher.ts` + `index.ts`, реэкспорт из `src/shared/lib/index.ts` (та же двухуровневая структура барелей, что у `viewport`/`storage`/`sessionCache`/`debounce`/`lazyNamed`/`analytics`).
- Сигнатура теряет дефолт дженерика: было `createCachedFetcher<P, R = Movie[]>`, станет `createCachedFetcher<P, R>` — `@shared/lib` не может знать о `Movie` из `@entities/movie` (это был бы обратный кросс-импорт `shared → entities`, прямо запрещённый направлением FSD). TypeScript выводит `R` из аргумента `fetcher` на каждом существующем вызове, так что удаление дефолта не требует правок на местах вызова — только смены пути импорта.
- Внутренний импорт `createSessionCache` меняется с алиаса `@shared/lib` на относительный `../sessionCache` — иначе барель `@shared/lib` ссылался бы сам на себя.
- Логика (TTL, `sessionStorage`-persist в DEV, 403-cooldown, `.invalidate()`/`.clear()`) не меняется — переносится как есть.

**Фетчер (`src/entities/person/api/getPersonDetail.ts`):**

```ts
import { createCachedFetcher } from '@shared/lib'

const fetchPersonDetail = async (id: number): Promise<PersonDetail> => {
  const response = await apiClient.getV15PersonById({ path: { id } })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return mapDtoToPersonDetail(response.data)
}

export const getPersonDetail = createCachedFetcher<number, PersonDetail>(
  'person-detail',
  fetchPersonDetail,
)
```

**Хук (`src/entities/person/hooks/usePersonDetail.ts`):**

- `export const usePersonDetail = (id: number): PersonDetail => use(getPersonDetail(id))`.
- `export const invalidatePersonDetail = (id: number): void => { getPersonDetail.invalidate(id) }`.
- В отличие от `useMovieDetail` **не нужен** `bundleCache`: там он был нужен только потому, что хук комбинировал два промиса через `Promise.allSettled` и создавал новую ссылку на каждый рендер. Здесь промис один и приходит прямо из `createCachedFetcher` — ссылка уже стабильна. Зафиксировать это WHY-комментарием, чтобы будущий читатель не «доисправил» по аналогии.

**Поток обработки:**

1. `/person/:id` → `PersonPage` валидирует `id` из `useParams` (целое > 0, иначе сразу `ErrorState` «Person not found» без запроса).
2. `AsyncBoundary` с `fallback={<PersonDetailSkeleton />}`, `errorFallback` (404 → «Person not found», прочее → generic) и `onRetry={() => invalidatePersonDetail(numericId)}`.
3. Внутренний `PersonDetailContent` вызывает `usePersonDetail(id)` и рендерит `<Person key={id} person={detail} />` (`key` — чтобы состояние «показать все кредиты» сбрасывалось при переходе между персонами, по прецеденту `MoviePage`).
4. `Person` компонует `PersonHero` + `Filmography` + `PersonFacts`.

**Группировка фильмографии (`src/pages/person/lib/groupCreditsByProfession.ts`):**

- Вход `PersonMovieCredit[]`, выход `Array<{ profession: string; label: string; credits: PersonMovieCredit[] }>`.
- Предпочтительный порядок групп: `actor`, `director`, `writer`, `producer`, `composer`, `operator`, далее всё остальное в порядке первого появления.
- `label` — из локальной карты `PROFESSION_LABELS` (`actor → Actor`, `producer → Producer`, `cameo → Cameo`, `uncredited → Uncredited`, ...), с фолбэком на сырой `enProfession` (по тому же принципу, что `getGenreLabel` в `@features/catalog-filter`: неизвестное значение показываем как есть, а не выкидываем).
- Внутри группы порядок API сохраняется (он близок к обратно-хронологическому).

**Ограничение объёма:** `VISIBLE_CREDITS = 12` на группу; если в группе больше — кнопка «Show all N» разворачивает её (локальный `useState` в `Filmography`). Текст/`aria-label` кнопки включает `label` группы (например, `Show all 94 actor credits`), а не голое число — иначе у двух групп с одинаковым количеством кредитов совпадёт доступное имя кнопки (тот же класс проблемы, что уже описан в AGENTS.md для `Dismiss`/`Close` в `BottomSheet`).

## Что куда идёт

- **Шаги реализации** (чекбоксы `[ ]`): всё, что делается в этом репозитории — код, тесты, конфиги сборки, документация.
- **После завершения** (без чекбоксов): ручная проверка на живом API, визуальная проверка в светлой теме, замер квоты, возможные апгрейды (реальные постеры в фильмографии, страница наград).

## Шаги реализации

### Задача 1: Типы `PersonDetail`/`PersonMovieCredit` и маппер DTO → `PersonDetail`

**Файлы:**

- Create: `src/entities/person/model/types.ts`
- Create: `src/entities/person/api/mapDtoToPersonDetail.ts`
- Create: `src/entities/person/api/mapDtoToPersonDetail.test.ts`

- [ ] создать `src/entities/person/model/types.ts` с `PersonMovieCredit` и `PersonDetail` по форме из «Технических деталей» (только `type`, не `interface`, без поля `sex`)
- [ ] добавить WHY-комментарий на русском, почему `PersonMovieCredit` — не `Movie` (в `MovieInPerson` нет `poster`/`type`/`genre`/`year`)
- [ ] создать `mapDtoToPersonDetail(dto: Person): PersonDetail` — нормализация `null → undefined`, фолбэк `name ?? enName ?? ''`, дедупликация `professions` через `Set`, фильтрация пустых `birthPlace`/`deathPlace`
- [ ] реализовать очистку `facts[]` от HTML-тегов (`replace(/<[^>]*>/g, '').trim()`) с отбрасыванием строк, ставших пустыми после очистки — добавить WHY-комментарий на русском со ссылкой на то, что Kinopoisk иногда кладёт разметку в `facts[].value`
- [ ] в маппинге `movies[]`: `title: m.name ?? m.alternativeName ?? ''`, отбрасывать записи с пустым `title`
- [ ] написать тесты маппера на успешный случай (полный DTO со всеми полями → ожидаемый `PersonDetail`)
- [ ] написать тесты маппера на краевые случаи: пустой DTO (только `id`/`updatedAt`/`createdAt`), `name: null` с заполненным `enName`, `enName === name` (не дублируется), дубли в `profession[]`, `movies[]` без `name` но с `alternativeName`, `movies[]` с пустым и `name`, и `alternativeName` (запись отбрасывается)
- [ ] написать тест маппера: `facts[].value` с HTML-тегами (`'<span class="x">факт</span>'`) → тег вырезан, остаётся только текст; факт, состоящий только из тегов, отбрасывается целиком
- [ ] запустить `make test` — должны пройти до перехода к задаче 2

### Задача 2: Перенести `createCachedFetcher` в `@shared/lib` (устранить кросс-импорт entity↔entity)

**Файлы:**

- Create: `src/shared/lib/cachedFetcher/createCachedFetcher.ts`
- Create: `src/shared/lib/cachedFetcher/createCachedFetcher.test.ts`
- Create: `src/shared/lib/cachedFetcher/index.ts`
- Delete: `src/entities/movie/api/createCachedFetcher.ts`
- Delete: `src/entities/movie/api/createCachedFetcher.test.ts`
- Modify: `src/entities/movie/index.ts`
- Modify: `src/shared/lib/index.ts`
- Modify: `src/entities/movie/api/getMovies.ts`, `getSearchMovies.ts`, `getMoviesPage.ts`, `getMovieDetail.ts`, `getMovieImages.ts`, `getMoviesByIds.ts`, `getPopularMovies.ts`
- Modify: `src/test/setup.ts`

- [ ] перенести код `createCachedFetcher.ts` (включая тип `CachedFetcher` и функцию `resetAllCachedFetchers`) в `src/shared/lib/cachedFetcher/createCachedFetcher.ts` без изменения логики (TTL, `sessionStorage`-persist в DEV, 403-cooldown, `.invalidate()`/`.clear()`); создать `src/shared/lib/cachedFetcher/index.ts` с реэкспортом — по образцу остальных поддиректорий `src/shared/lib/*` (`viewport`, `storage`, `sessionCache`, `debounce`, `lazyNamed`, `analytics`), каждая из которых отдаёт свой `index.ts`, а `src/shared/lib/index.ts` реэкспортирует из директории, а не из файла напрямую
- [ ] заменить внутри перенесённого файла `import { createSessionCache } from '@shared/lib'` на относительный `import { createSessionCache } from '../sessionCache'` — внутри `src/shared/lib/**` алиас `@shared/lib` на собственный барель нигде не используется (только относительные импорты), а после переноса `@shared/lib` стал бы ссылаться сам на себя (`index.ts → cachedFetcher → index.ts`) — паразитный цикл в самом широко импортируемом барреле приложения
- [ ] убрать дефолт дженерика `R = Movie[]` — сделать `R` обязательным параметром типа (`@shared/lib` не может импортировать `Movie` из `@entities/movie`, это было бы обратным кросс-импортом `shared → entities`); TypeScript и так выводит `R` из аргумента `fetcher` на каждом текущем вызове (`createCachedFetcher('movies', fetchMovies)` и т.п.) — дефолт использовался только как fallback при неудачном выводе, поэтому **менять сигнатуры вызовов на местах не нужно**, только путь импорта
- [ ] добавить WHY-комментарий на русском: почему файл переехал именно сейчас (первый случай, когда двум entity-слайсам одного уровня нужна одна и та же инфраструктурная утилита — `@entities/person` не может законно импортировать `@entities/movie`)
- [ ] экспортировать `createCachedFetcher`/`resetAllCachedFetchers` из `src/shared/lib/index.ts`
- [ ] обновить импорты `createCachedFetcher` на `@shared/lib` в семи реальных потребителях: `getMovies.ts`, `getSearchMovies.ts`, `getMoviesPage.ts`, `getMovieDetail.ts`, `getMovieImages.ts`, `getMoviesByIds.ts`, `getPopularMovies.ts` — **`getGenreDictionary.ts` сюда не входит**, он кеширует через отдельный `genreDictionaryCache.ts`/`createStorageSlot` и `createCachedFetcher` не импортирует
- [ ] обновить `src/test/setup.ts`: `resetAllCachedFetchers` импортируется из `@shared/lib`
- [ ] удалить из публичного барреля `@entities/movie` (`src/entities/movie/index.ts`) строку `export { resetAllCachedFetchers } from './api/createCachedFetcher'` — файл-источник удалён этой же задачей, реэкспорт становится безусловно недействителен, а не «условно, если был опубликован ради переиспользования»
- [ ] перенести `createCachedFetcher.test.ts` вместе с кодом; тесты по существу не переписывать (bare-вызовы `createCachedFetcher('ns', fetcher)` в тестах тоже продолжат работать без явного `R` — см. предыдущий чекбокс про вывод типов)
- [ ] запустить `make test` — весь существующий набор тестов `@entities/movie` должен остаться зелёным после переноса — обязательное условие перед задачей 3

### Задача 3: Фетчер `getPersonDetail` с кешем и `ApiError`

**Файлы:**

- Create: `src/entities/person/api/getPersonDetail.ts`
- Create: `src/entities/person/api/getPersonDetail.test.ts`

- [ ] создать `getPersonDetail` через `createCachedFetcher<number, PersonDetail>('person-detail', fetchPersonDetail)`, импортируя `createCachedFetcher` из `@shared/lib` (см. Задачу 2) — **не** из `@entities/movie`
- [ ] внутри `fetchPersonDetail` вызвать `apiClient.getV15PersonById({ path: { id } })` и сузить тип через `if ('statusCode' in response.data)` → `throw new ApiError(response.data.message, response.data.statusCode)` (тот же комментарий «нужно чтобы сузить тип», что в `getMovieDetail.ts`)
- [ ] написать тест успешного пути: MSW мокает `*/v1.5/person/:id` валидным `Person` → возвращается замапленный `PersonDetail`
- [ ] написать тест кеширования: два последовательных вызова `getPersonDetail(id)` возвращают одну и ту же ссылку на промис и делают ровно один сетевой запрос
- [ ] написать тесты ошибок: MSW отдаёт `{ statusCode: 404, message: ... }` → отклонение с `ApiError`, у которого `status === 404`; то же для 403 — **каждый сценарий использует свой уникальный `id`** (по образцу `getMovieDetail.test.ts`: 101/102/666/555), чтобы error-снапшот с cooldown в `sessionStorage` от одного теста не утёк в соседний
- [ ] написать тест `getPersonDetail.invalidate(id)` — после инвалидации следующий вызов снова ходит в сеть
- [ ] запустить `make test` — должны пройти до перехода к задаче 4

### Задача 4: Suspense-хук `usePersonDetail` + `invalidatePersonDetail` + публичный барель слайса

**Файлы:**

- Create: `src/entities/person/hooks/usePersonDetail.ts`
- Create: `src/entities/person/hooks/index.ts`
- Create: `src/entities/person/hooks/usePersonDetail.test.tsx`
- Create: `src/entities/person/index.ts`

- [ ] создать `usePersonDetail(id): PersonDetail` как `use(getPersonDetail(id))`
- [ ] добавить WHY-комментарий на русском: почему здесь **не нужен** `bundleCache` как в `useMovieDetail` (там комбинировались два промиса через `Promise.allSettled`, что порождало новую ссылку на каждый рендер; тут промис один и стабилен по построению `createCachedFetcher`)
- [ ] добавить companion-инвалидатор `invalidatePersonDetail(id)`
- [ ] создать `src/entities/person/index.ts` — публичный барель: `PersonDetail`, `PersonMovieCredit`, `usePersonDetail`, `invalidatePersonDetail`
- [ ] правок `vite.config.ts`/`tsconfig.app.json` не требуется — алиас `@entities` директорный (`path.resolve(__dirname, 'src/entities')` / `"./src/entities/*"`), новый слайс `@entities/person` подхватывается автоматически
- [ ] написать тест хука: рендер внутри `<Suspense>`, MSW отдаёт персону → после резолва в DOM видно имя
- [ ] написать тест ошибочного пути: MSW отдаёт 404 → ошибка пробрасывается в `ErrorBoundary`, а не глотается
- [ ] написать тест стабильности: два рендера подряд не вызывают повторный сетевой запрос (защита от бесконечного ре-саспенса)
- [ ] запустить `make test` — должны пройти до перехода к задаче 5

### Задача 5: Скелет страницы `PersonPage` + `PersonDetailSkeleton`

**Файлы:**

- Create: `src/pages/person/PersonPage.tsx`
- Create: `src/pages/person/index.tsx`
- Create: `src/pages/person/ui/PersonDetailSkeleton/index.tsx`
- Create: `src/pages/person/ui/PersonDetailSkeleton/PersonDetailSkeleton.tsx`
- Create: `src/pages/person/ui/PersonDetailSkeleton/PersonDetailSkeleton.module.css`
- Create: `src/pages/person/ui/Person/index.tsx`
- Create: `src/pages/person/ui/Person/Person.tsx`
- Create: `src/pages/person/ui/Person/Person.module.css`
- Create: `src/pages/person/PersonPage.test.tsx`

- [ ] создать `PersonPage.tsx` по образцу `MoviePage.tsx`: валидация `id` из `useParams` (`Number.isInteger(numericId) && numericId > 0`), иначе `ErrorState` «Person not found» / «This person doesn't exist or was removed.» без сетевого запроса
- [ ] обернуть контент в `AsyncBoundary` с `fallback={<PersonDetailSkeleton />}`, `errorFallback` (различает `error instanceof ApiError && error.status === 404`) и `onRetry={() => invalidatePersonDetail(numericId)}`
- [ ] вынести внутренний `PersonDetailContent` (вызывает `usePersonDetail(id)`), рендерить `<Person key={id} person={detail} />` с WHY-комментарием про сброс локального состояния при переходе между персонами
- [ ] создать `src/pages/person/index.tsx` с именованным реэкспортом `export { PersonPage } from './PersonPage'` (важно для `lazyNamed`)
- [ ] создать `PersonDetailSkeleton` по образцу `MovieDetailSkeleton` — блок фото + строки имени/меты + строки фильмографии, через `Skeleton` из `@shared/ui`, CSS mobile-first с `@media (min-width: 720px)`
- [ ] создать заглушку `Person.tsx`, рендерящую пока только `<h1>{person.name}</h1>` (наполнение — задачи 6-9), и `Person.module.css`
- [ ] написать тест `PersonPage.test.tsx`: невалидный `id` (`/person/abc`, `/person/0`, `/person/-1`) → `ErrorState` «Person not found», запроса в сеть нет
- [ ] написать тест `PersonPage.test.tsx`: MSW 404 → `ErrorState` «Person not found» с кнопкой Retry
- [ ] написать тест `PersonPage.test.tsx`: MSW 500 / другая ошибка → generic `ErrorState`, а не «Person not found»
- [ ] написать тест `PersonPage.test.tsx`: успешная загрузка → отображается имя персоны
- [ ] написать тест `PersonPage.test.tsx`: клик по Retry после ошибки реально повторяет запрос (проверить счётчиком MSW-хендлера)
- [ ] запустить `make test` — должны пройти до перехода к задаче 6

### Задача 6: Компонент `PersonHero` — фото, имя, профессии, биометрия

**Файлы:**

- Create: `src/pages/person/ui/PersonHero/index.tsx`
- Create: `src/pages/person/ui/PersonHero/PersonHero.tsx`
- Create: `src/pages/person/ui/PersonHero/PersonHero.module.css`
- Create: `src/pages/person/ui/PersonHero/PersonHero.test.tsx`

- [ ] отрендерить фото: `<img src={person.photo} alt={person.name} />`; при отсутствии `photo` — градиентная заглушка через локальную константу `FALLBACK_HUE = 220` (тот же приём и то же значение, что в `CastTab.tsx`; добавить WHY-комментарий, что дублирование константы предпочтено вынесению в shared)
- [ ] отрендерить `<h1>` с `person.name` и, если есть и отличается, `person.enName` подзаголовком
- [ ] отрендерить профессии как ряд пиллов (по образцу `TagPill` в `MovieHero.tsx`, но локально в этом модуле — общий компонент не заводить)
- [ ] отрендерить мета-строки, каждую только при наличии данных: `Born` (`formatDate(person.birthday)` из `@entities/movie`), `Died` (`formatDate(person.death)`), `Age` (`person.age`), `Height` (`${growth} cm`), `Born in` (`birthPlace.join(', ')`), `Died in` (`deathPlace.join(', ')`, только если есть `death`), `Awards` (`countAwards`)
- [ ] **не** передавать `locale` в `formatDate` явно из компонента — дефолт `navigator.language` (как во всех остальных вызовах в репозитории)
- [ ] написать CSS mobile-first: на мобильном фото сверху и информация под ним, на десктопе (`@media (min-width: 720px)`) — две колонки; только `var(--token)`, ни одного хардкоженного цвета
- [ ] написать тест: полная персона → видны имя (роль `heading`, уровень 1), `enName`, все профессии, все мета-строки, включая `Died in`
- [ ] написать тест: персона без `photo` → рендерится заглушка, а не `<img>` с пустым `src`
- [ ] написать тест: персона без `death`/`growth`/`countAwards`/`birthPlace` → соответствующие строки отсутствуют (не «—» и не пустые лейблы)
- [ ] написать тест: дата рождения рендерится в формате дефолтной локали jsdom (`en-US`) — сравнить с конкретной ожидаемой строкой, по образцу `src/entities/movie/lib/formatDate.test.ts` (`formatDate('2024-03-14')` → `'March 14, 2024'`), не добавляя компоненту проп `locale`
- [ ] запустить `make test` — должны пройти до перехода к задаче 7

### Задача 7: Фильмография — группировка и список кредитов со ссылками

**Файлы:**

- Create: `src/pages/person/lib/groupCreditsByProfession.ts`
- Create: `src/pages/person/lib/groupCreditsByProfession.test.ts`
- Create: `src/pages/person/ui/Filmography/index.tsx`
- Create: `src/pages/person/ui/Filmography/Filmography.tsx`
- Create: `src/pages/person/ui/Filmography/Filmography.module.css`
- Create: `src/pages/person/ui/Filmography/Filmography.test.tsx`
- Create: `src/pages/person/ui/Filmography/CreditGroup/index.tsx`
- Create: `src/pages/person/ui/Filmography/CreditGroup/CreditGroup.tsx`
- Create: `src/pages/person/ui/Filmography/CreditGroup/CreditGroup.module.css`

- [ ] создать `groupCreditsByProfession(credits)` → `Array<{ profession, label, credits }>` с предпочтительным порядком групп (`actor`, `director`, `writer`, `producer`, `composer`, `operator`, затем остальные в порядке появления) и картой `PROFESSION_LABELS` с фолбэком на сырое значение
- [ ] добавить WHY-комментарий: почему фолбэк на сырой `enProfession`, а не отбрасывание неизвестной профессии (тот же принцип, что у `getGenreLabel` для жанров вне словаря)
- [ ] создать `Filmography.tsx`: секция с заголовком `Filmography` в `<h2>` (реальный семантический заголовок — в отличие от нетабового `sectionHead`-`div` во вкладках `/movie/:id`, где заголовок декоративен, т.к. активная вкладка уже даёт доступное имя панели; здесь страница — один длинный скролл из нескольких секций, и `<h1>` у `PersonHero` нуждается в настоящей иерархии `<h2>` под собой); секция рендерит по одному `CreditGroup` на группу из `groupCreditsByProfession`
- [ ] создать `CreditGroup.tsx` (сворачиваемая группа): владеет собственным `useState<boolean>` разворота — состояние сворачивания per-группа, а не одно общее булево на всю `Filmography` (иначе разворот одной группы разворачивал бы все и тест на разные `aria-label` у двух групп был бы бессмысленным); каждая строка кредита — `<Link to={`/movie/${credit.id}`}>` с названием, рядом рейтинг (`credit.rating != null ? credit.rating.toFixed(1) : null` — именно `!= null`, а не truthy-проверка, иначе реальный рейтинг `0` у непроголосованных фильмов будет молча скрыт) и роль (`credit.role`, если есть)
- [ ] ключ строки кредита — составной `key={`${credit.id}-${credit.profession ?? ''}`}` (не голый `credit.id`): один и тот же фильм может повторяться в `movies[]` с разными `enProfession`, а внутри одной профессии дублей по `id` не бывает — по прецеденту `key={`${c.id}-${c.role}`}` в `CastTab.tsx`
- [ ] реализовать сворачивание внутри `CreditGroup`: `VISIBLE_CREDITS = 12`, кнопка разворачивает группу (настоящий `<button type='button'>`, не `div`); текст/`aria-label` кнопки включает `label` группы (например, `Show all 94 actor credits`), чтобы у двух групп с одинаковым числом кредитов не совпали доступные имена кнопок
- [ ] отрендерить `EmptyState` (`@shared/ui`) при пустой фильмографии вместо пустой секции
- [ ] написать CSS mobile-first: одна колонка на мобильном, две колонки на десктопе (`@media (min-width: 720px)`); ссылки без `text-decoration`, с видимым `:focus-visible`-состоянием
- [ ] написать тесты `groupCreditsByProfession`: порядок групп по предпочтительному списку, неизвестная профессия попадает в конец с сырым лейблом, `undefined` профессия не роняет функцию, порядок внутри группы сохраняется
- [ ] написать тесты `Filmography`/`CreditGroup`: кредиты отрендерены как ссылки с корректным `href` (`/movie/:id`), видны рейтинг и роль; кредит с `rating: 0` показывает «0.0», а не скрывает рейтинг
- [ ] написать тесты `Filmography`/`CreditGroup`: группа из >12 кредитов показывает 12 и кнопку разворота с текстом, включающим label группы; клик разворачивает **только свою** группу, соседние группы остаются свёрнутыми
- [ ] написать тест `Filmography`: две группы с одинаковым количеством скрытых кредитов дают кнопки с разными доступными именами (регрессия на a11y)
- [ ] написать тест `Filmography`: пустой список → `EmptyState`
- [ ] запустить `make test` — должны пройти до перехода к задаче 8

### Задача 8: Секция фактов `PersonFacts`

**Файлы:**

- Create: `src/pages/person/ui/PersonFacts/index.tsx`
- Create: `src/pages/person/ui/PersonFacts/PersonFacts.tsx`
- Create: `src/pages/person/ui/PersonFacts/PersonFacts.module.css`
- Create: `src/pages/person/ui/PersonFacts/PersonFacts.test.tsx`

- [ ] отрендерить секцию `Facts` с заголовком в `<h2>` (та же семантика, что у `Filmography` в Задаче 7 — реальная иерархия заголовков под `<h1>` из `PersonHero`) и списком `<ul>`/`<li>` со значениями `person.facts` (теги уже вырезаны в мапере, см. Задачу 1 — компонент получает чистый текст)
- [ ] рендерить факты через обычный текстовый узел, без `dangerouslySetInnerHTML` (двойная защита поверх очистки в мапере: в `src/` этого API нет нигде, а CSP содержит `require-trusted-types-for 'script'`)
- [ ] не рендерить секцию вовсе, если `facts` пуст (в отличие от фильмографии, у фактов нет смысла в отдельном empty-state)
- [ ] написать CSS mobile-first, только `var(--token)`
- [ ] написать тест: непустые факты → все пункты видны, обёрнуты в список
- [ ] написать тест: пустые факты → секция не рендерится (заголовок `Facts` отсутствует)
- [ ] запустить `make test` — должны пройти до перехода к задаче 9

### Задача 9: Композиция `Person` и раскладка страницы

**Файлы:**

- Modify: `src/pages/person/ui/Person/Person.tsx`
- Modify: `src/pages/person/ui/Person/Person.module.css`
- Create: `src/pages/person/ui/Person/Person.test.tsx`

- [ ] собрать `Person.tsx` из `PersonHero` + `Filmography` + `PersonFacts` (в этом порядке)
- [ ] добавить WHY-комментарий на русском: почему выбраны секции, а не `MovieTabsNav`-подобные табы (три содержательных блока, ремаунт по `key` не нужен, копировать табы ради симметрии с `/movie/:id` — карго-культ)
- [ ] дописать `Person.module.css`: mobile-first отступы между секциями, десктопные оверрайды в `@media (min-width: 720px)`; проверить, что компонент один и парных `*Desktop`/`*Mobile` файлов не заведено
- [ ] написать тест: полная персона → присутствуют имя, секция `Filmography` и секция `Facts`
- [ ] написать тест: персона без фактов и без фильмографии → имя есть, `Facts` нет, `Filmography` показывает `EmptyState`
- [ ] запустить `make test` — должны пройти до перехода к задаче 10

### Задача 10: Роут `/person/:id` и chrome-конфиг в `AppLayout`

**Файлы:**

- Modify: `src/app/router.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `src/app/layouts/AppLayout.test.tsx`

- [ ] в `router.tsx` добавить `const PersonPage = lazyNamed(() => import('../pages/person'), 'PersonPage')` и маршрут `{ path: '/person/:id', element: <PersonPage /> }` в `children` у `AppLayout`
- [ ] обновить комментарий в шапке `router.tsx` (там сказано «Все шесть роутов» — станет семь)
- [ ] в `AppLayout.tsx` добавить константу `PERSON_CHROME: RouteChromeConfig = { active: 'search', onBack: true, showSearch: false }` рядом с `MOVIE_CHROME`
- [ ] добавить WHY-докблок на русском: почему отдельная константа, а не запись в `ROUTE_CHROME` (ключи карты сравниваются с `pathname` напрямую, `/person/123` не совпадёт с литералом `/person/:id`); почему `active: 'search'` (у detail-страницы персоны нет своего пункта `BottomNav`, ближайший по смыслу — каталог/поиск, так же как у `/movie/:id`); почему **нет** `rightAction` (кнопка Share у `MOVIE_CHROME` воспроизводила поведение удалённого `MovieMobile.tsx`, у персоны такой истории нет — решение подтверждено пользователем при планировании)
- [ ] добавить `const isPersonRoute = useMatch('/person/:id') != null` и включить его в цепочку выбора `config` (порядок: movie → person → search → `ROUTE_CHROME[pathname]`)
- [ ] обновить таблицу соответствия `Header.activeNav` ↔ `BottomNav.active` в докблоке `ROUTE_CHROME` строкой `person detail`
- [ ] написать тест в `AppLayout.test.tsx`: на `/person/123` в мобильном вьюпорте рендерится `MobileHeader` с кнопкой «назад» и `BottomNav` с активным пунктом `search`
- [ ] написать тест в `AppLayout.test.tsx`: на `/person/123` в десктопном вьюпорте рендерится `Header` без подсвеченного nav-pill (`activeNav` не задан) и `variant='default'`
- [ ] написать тест: `trackPageview()` вызывается при переходе на `/person/:id`
- [ ] запустить `make test` — должны пройти до перехода к задаче 11

### Задача 11: Карточки актёров в `CastTab` становятся ссылками на `/person/:id`

**Файлы:**

- Modify: `src/pages/movie/ui/tabs/CastTab/CastTab.tsx`
- Modify: `src/pages/movie/ui/tabs/CastTab/CastTab.module.css`
- Create: `src/pages/movie/ui/tabs/CastTab/CastTab.test.tsx`

- [ ] заменить внешний `<div className={s.castCard}>` на `<Link to={`/person/${c.id}`} className={s.castCard}>` из `react-router`, **только когда `c.name` непусто** — если `mapDtoToMovieDetail` отдал `name: ''` (DTO не гарантирует имя), рендерить как раньше (`<div>`, без ссылки), а не пустую по доступному имени `<Link>` (axe-правило `link-name` критично, упало бы на `checkA11y` в Задаче 14 при живых данных)
- [ ] добавить WHY-комментарий на русском: почему здесь достаточно обычного `<Link>`-обёртки, а не stretched-link паттерна из `Card` (в карточке персоны нет вложенных интерактивных элементов, вкладывать `<button>` в `<a>` не приходится), и отдельно — почему ссылка не рендерится при пустом `name`
- [ ] сохранить существующий ключ `key={`${c.id}-${c.role}`}` и комментарий про дубли персон в `persons`
- [ ] у фото проставлен `alt={c.name}` — проверить, что доступное имя ссылки не задваивается (имя уже есть в `.actorName`); при необходимости сменить `alt` фото на `''` (декоративное), оставив текстовое имя единственным источником доступного имени
- [ ] дописать в `CastTab.module.css` для `.castCard`: `text-decoration: none`, `color: inherit`, видимое `:focus-visible`-состояние через `var(--accent-warm)`; не менять существующую сетку/размеры
- [ ] написать тест: карточки каста рендерятся как ссылки с `href="/person/:id"`
- [ ] написать тест: у персоны без фото рендерится градиентная заглушка, и ссылка всё равно имеет доступное имя (имя актёра)
- [ ] написать тест: персона с пустым `c.name` рендерится как обычный `<div>` без `<Link>` (регрессия на a11y — ссылка без доступного имени не создаётся)
- [ ] написать тест: две записи одной персоны с разными ролями рендерятся обе (регрессия на ключ)
- [ ] проверить, что `Movie.test.tsx` и `MoviePage.test.tsx` по-прежнему зелёные (оба уже рендерят внутри `MemoryRouter`, так что `<Link>` не должен их сломать)
- [ ] запустить `make test` — должны пройти до перехода к задаче 12

### Задача 12: Имена съёмочной группы в `OverviewTab` становятся ссылками

**Файлы:**

- Modify: `src/pages/movie/lib/groupCrewByProfession.ts`
- Modify: `src/pages/movie/lib/groupCrewByProfession.test.ts`
- Modify: `src/pages/movie/ui/tabs/OverviewTab/OverviewTab.tsx`
- Modify: `src/pages/movie/ui/tabs/OverviewTab/OverviewTab.module.css`
- Create: `src/pages/movie/ui/tabs/OverviewTab/OverviewTab.test.tsx`

- [ ] изменить `groupCrewByProfession` так, чтобы он возвращал `Array<{ profession: string; members: CrewMember[] }>` вместо склеенной строки `names` — из строки ссылки не построить
- [ ] обновить `MetaRow` в `OverviewTab.tsx`: принимать `ReactNode` вместо `string` в `value` и рендерить `members` как `<Link to={`/person/${m.id}`}>` через разделитель `, `; для записи с пустым `m.name` рендерить обычный текстовый узел без `<Link>` (та же причина, что в Задаче 11 — `<Link>` без доступного имени критично для axe `link-name` и упадёт в `checkA11y` из Задачи 14)
- [ ] добавить WHY-комментарий на русском, почему `names: string` пришлось развернуть в `members: CrewMember[]`, и отдельно — почему запись с пустым `name` не оборачивается в ссылку
- [ ] дописать стили ссылок crew в `OverviewTab.module.css` (цвет `var(--accent-warm)` при hover, `:focus-visible`), не ломая существующую вёрстку мета-строк
- [ ] обновить существующие тесты `groupCrewByProfession.test.ts` под новую форму возврата (порядок профессий, порядок членов внутри профессии, дубли)
- [ ] написать тест `groupCrewByProfession.test.ts` на пустой вход → пустой массив
- [ ] создать `OverviewTab.test.tsx` (сейчас у компонента нет отдельного тест-файла): проверить, что имена crew отрендерены как ссылки с `href="/person/:id"`, разделитель между несколькими именами присутствует, а остальной контент вкладки (synopsis, мета-строки) не сломан переходом `value: string → ReactNode`; отдельным кейсом — член съёмочной группы с пустым `name` рендерится текстом без `<Link>`
- [ ] запустить `make test` — должны пройти до перехода к задаче 13

### Задача 13: Группа код-сплиттинга `page-person` и бюджет `size-limit`

**Файлы:**

- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] добавить в `build.rolldownOptions.output.codeSplitting.groups` запись `{ name: 'page-person', test: /\/pages\/person\// }` — **после** группы `shared` и рядом с остальными page-группами (порядок важен: `shared` должен ловить `@entities`/`@widgets` раньше page-групп)
- [ ] выполнить `make build-only` и убедиться, что в `dist/assets/` появился отдельный `page-person-*.js`, а не «растворился» в `page-movie`/`shared`
- [ ] проверить, что `dist/assets/page-person-*.js` не импортируется статически из других page-чанков (грепом по `import{...}from"./page-person`) — то есть изоляция роутов не нарушена
- [ ] **измерить** реальный gzip-размер `page-person-*.js` после сборки (`make size` покажет размеры имеющихся записей; для новой можно посмотреть вывод сборки) — **не гадать число заранее**
- [ ] добавить в секцию `"size-limit"` в `package.json` запись `{ "name": "page-person", "path": "dist/assets/page-person-*.js", "gzip": true, "limit": "<измеренный размер + 15%>" }` (15% — тот же буфер, что у всех существующих записей)
- [ ] **перепроверить остальные бюджеты**: `shared` вырастет за счёт `@entities/person` и переехавшего `createCachedFetcher`, `page-movie` может измениться из-за правок `CastTab`/`OverviewTab` — если `make size` красный, пересчитать затронутые лимиты по фактическим замерам и зафиксировать это в плане с префиксом ➕
- [ ] запустить `make size` — должен быть зелёным до перехода к задаче 14
- [ ] запустить `make knip` — убедиться, что новые экспорты `@entities/person` и перенесённого `createCachedFetcher` не помечены как unused (у всех есть реальный потребитель; если помечены — исправлять источником, а не записью в `ignore`)
- [ ] запустить `make test` и `make lint` — должны пройти до перехода к задаче 14

### Задача 14: E2E-спек `person-detail.spec.ts` с a11y-проверкой

**Файлы:**

- Create: `e2e/person-detail.spec.ts`

- [ ] написать сценарий навигации: `page.goto('/movie/<стабильный id>')` → клик по табу `Cast` → клик по первой карточке актёра → URL совпадает с `/\/person\/.+/`, виден `heading` уровня 1
- [ ] использовать **фиксированный** id фильма с гарантированно непустым кастом (подобрать живым запросом заранее и зафиксировать в комментарии `[decision]`, по образцу `9999999` в `movie-detail.spec.ts`), а не «первую карточку с главной» — живые данные главной не гарантируют наличие каста, это реальный источник флейка
- [ ] добавить мягкие (не блокирующие) проверки наличия секций `Filmography`/`Facts` через `count() > 0`, по образцу проверок `Trailer`/`Screenshots` в `movie-detail.spec.ts` — у произвольной персоны фактов может не быть
- [ ] добавить сценарий 404: `page.goto('/person/9999999')` → виден `ErrorState` «Person not found» и кнопка `Попробовать снова`; **проверить живым `curl`**, что этот id действительно 404-ит на `/v1.5/person/`, а не 400-ит (у `/v1.5/movie/` это подтверждено, у person — нет)
- [ ] вызвать `checkA11y(page)` из `e2e/utils/a11y.ts` **один раз** на успешной странице персоны и один раз на 404-странице — не на каждом клике (экономия квоты 200 запросов/день)
- [ ] проверить, что `knip.jsonc` править не нужно: его `entry` уже содержит глоб `"e2e/**/*.spec.ts"`
- [ ] прогнать `make build-only && make e2e` — новый спек должен проходить (помнить про квоту: полный прогон всех спеков стоит ~40-50 запросов)
- [ ] запустить `make test` — юнит-тесты должны оставаться зелёными

### Задача 15: Проверка критериев приёмки

- [ ] проверить, что все требования из «Обзора» реализованы: страница `/person/:id` с фото, именем, датой рождения/возрастом, профессиями, фильмографией со ссылками и фактами
- [ ] проверить, что клик по актёру в `CastTab` ведёт на страницу персоны
- [ ] проверить, что клик по имени члена съёмочной группы в `OverviewTab` ведёт на страницу персоны
- [ ] проверить, что клик по фильму в фильмографии ведёт обратно на `/movie/:id`
- [ ] проверить краевые случаи: невалидный `id` в URL, 404 от API, персона без фото, без фактов, с пустой фильмографией, с 90+ кредитами (сворачивание работает), факты с HTML-разметкой (теги вырезаны)
- [ ] проверить, что на мобильном (`< 720px`) есть `MobileHeader` с кнопкой «назад» и `BottomNav`, а на десктопе — `Header`
- [ ] проверить, что нигде не заведено пар `*Desktop`/`*Mobile` и весь адаптив сделан через `@media (min-width: 720px)`
- [ ] проверить, что ни `@entities/person`, ни `@entities/movie` не импортируют друг друга напрямую — вся общая инфраструктура идёт через `@shared/lib`
- [ ] запустить полный набор тестов: `make test`
- [ ] запустить e2e: `make build-only && make e2e`
- [ ] запустить полную валидацию: `make check` (lint + build), `make size`, `make knip`
- [ ] проверить покрытие: `make coverage` — новые файлы покрыты не хуже соседних по слайсу

### Задача 16: [Финальная] Обновление документации

- [ ] обновить `AGENTS.md`, секция «Routing»: добавить `/person/:id` в перечисление маршрутов
- [ ] обновить `AGENTS.md`, секция «Key public APIs»: добавить строку `@entities/person` с `PersonDetail`, `PersonMovieCredit`, `usePersonDetail()`, `invalidatePersonDetail()`; переместить `createCachedFetcher`/`resetAllCachedFetchers` из строки `@entities/movie` (если она там документирована) в строку `@shared/lib`
- [ ] обновить `AGENTS.md`, секция «Data state»: добавить пункт про шестую live-data интеграцию — `/person/:id`, включая решение по фильмографии (почему список, а не `Card`-сетка, и почему не догружаем постеры через `getMoviesByIds`), и упомянуть перенос `createCachedFetcher` в `@shared/lib` в описании, где сейчас фиксируется его история обобщения (`createCachedFetcher<P, R = Movie[]>`)
- [ ] обновить `AGENTS.md`, секция «Performance budgets»: упомянуть группу `page-person` и то, что `@entities/person` осознанно попадает в чанк `shared`
- [ ] обновить `AGENTS.md`, секция «CSP headers»: зафиксировать, что фото персоны проверено живым запросом и отдаётся с уже разрешённого `avatars.mds.yandex.net` — правки `vercel.json` не потребовались
- [ ] удалить `docs/backlog/actor-detail-page.md` — пункт бэклога закрыт (жизненный цикл «создать → удалить»)
- [ ] проверить, нужно ли обновлять `README.md` (если там перечислены маршруты)
- [ ] перенести этот план в `docs/plans/completed/`

## После завершения

_Пункты, требующие ручного вмешательства или внешних систем — без чекбоксов, информационно_

**Ручная проверка:**

- Открыть `/person/:id` для нескольких реальных персон разного профиля: плодовитый актёр (94+ кредита, например id 6317), режиссёр (кредиты в группе `director`), персона без фото, персона без фактов, живущая персона (нет `death`, есть `age`).
- Проверить обе темы: переключить на светлую (`data-theme='light'`) и убедиться, что ни один цвет не «залип» тёмным — это главный симптом хардкоженного hex/rgba вместо `var(--token)`.
- Проверить на реальном мобильном устройстве / в device toolbar: кнопка «назад» в `MobileHeader`, `BottomNav` с активным `search`, сетка фильмографии в одну колонку.
- Проверить поведение при медленной сети (throttling): `PersonDetailSkeleton` виден, потом контент; кнопка Retry на 404 реально повторяет запрос.
- Проверить клавиатурную навигацию: Tab по карточкам каста и ссылкам фильмографии даёт видимый `:focus-visible`, Enter переходит; Tab по кнопкам «Show all» в разных группах — доступные имена не совпадают.

**Стоимость квоты API:**

- Демо-тариф — 200 запросов/день. Выбранный вариант фильмографии добавляет **0** запросов сверх одного `GET /v1.5/person/{id}` на визит. Новый e2e-спек добавляет ~3-4 запроса к полному прогону (сейчас ~40-50). Если после релиза окажется, что квоты не хватает, первым кандидатом на сокращение остаётся e2e (он и так запускается только по лейблу `run-e2e`).

**Возможные улучшения (отдельными пунктами бэклога, не в этом плане):**

- **Реальные постеры в фильмографии** (отклонённый вариант B): секция «Known for» с top-N кредитов, догруженных через `getMoviesByIds()` и отрендеренных существующим `Card`. Стоит N запросов на каждую новую персону — заводить только если квота позволит или появится не-демо-тариф.
- **Награды персоны**: `apiClient.getV15PersonAwards` уже сгенерирован (`PersonControllerFindManyAwardsV15`), сейчас показываем только счётчик `countAwards`. Отдельный запрос — отдельная задача.
- **Галерея фото персоны**: отдельного эндпоинта нет — `/v1.5/image` фильтруется только по `movieId` (см. `getMovieImages.ts`), поэтому «фото» из формулировки бэклога закрыто единственным полем `photo`. Галерея потребует другого источника данных.
- **Поиск по персонам**: `apiClient.getV15PersonSearch` сгенерирован и не используется — потенциальная вкладка в `/search`.

**Внешние системы:**

- Изменений в `vercel.json` (CSP/заголовки безопасности) **не требуется** — подтверждено живым запросом: `photo` приходит с `https://avatars.mds.yandex.net`, хост уже в `img-src`; `st.kp.yandex.net` (второй возможный домен фото персон) там тоже уже есть. Если в будущем фото начнут отдаваться с третьего домена, `img-src` придётся обновить вручную — это внешний факт, который никакой тест не поймает.
- После деплоя проверить в Sentry, что на `/person/:id` не посыпались новые ошибки, и в Plausible — что pageview для нового маршрута регистрируется (`AppLayout` вызывает `trackPageview()` по смене `pathname`, отдельной проводки не нужно).
