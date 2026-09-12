# CSP headers + security headers (roadmap 2.5.4)

## Overview

Реализация пункта **2.5.4** из `plans/roadmap.md` (Фаза 2.5, Pre-launch readiness): security-заголовки на уровне хостинга (Vercel) — CSP в режиме `Report-Only` (с реальным endpoint'ом для violation-репортов), `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, решение по SRI.

Проект — чистый Vite SPA без своего сервера (SSR — будущая Фаза 4), задеплоенный на **Vercel** (`vercel.json` уже существует в репо). Заголовки идут через `vercel.json` → `headers`, а не через `<meta>`-тег: `report-uri` не поддерживается в meta-CSP ни в одном браузере — ровно то ограничение, которое называет сам roadmap.

**Ревизия плана после auto-review:** первая версия плана содержала две фактические ошибки, обе исправлены проверкой напрямую (живые запросы к API, чтение `.env.local`) перед тем, как приступать к реализации:

1. **`img-src` был неверным.** Изначально в план попал `https://st.kp.yandex.net` как «домен постеров», найденный в закоммиченном OpenAPI-спеке. Прямой запрос к `GET https://api.poiskkino.dev/v1.5/movie` показал, что постеры/бэкдропы (и результат `getMovieImages`/`/v1.5/image`, который рендерит `MediaTab`) реально отдаются с `https://avatars.mds.yandex.net`, а `st.kp.yandex.net` — это домен фото **персон** (`persons[].photo`, рендерится в `CastTab.tsx` как `<img src={c.photo}>`). Нужны **оба** домена. Также встречается `https://image.tmdb.org` (поле `logo.url`/`logo.previewUrl`) — проверено, что `logo` нигде не замаплен в `mapDtoToMovieDetail.ts` и не рендерится ни одним компонентом, поэтому в `img-src` не добавляется (осознанно, задокументировано, а не молча пропущено).
2. **`VITE_SENTRY_DSN` — не placeholder.** AGENTS.md описывает DSN как ещё не настроенный ("плейсхолдерное состояние"), но в `.env.local` лежит настоящий DSN (`o4512052151844864.ingest.us.sentry.io`, project `4512052165607429`) и настоящий `VITE_PLAUSIBLE_DOMAIN` (`kinoshka-gilt.vercel.app`) — проект реально задеплоен и настроен. Это меняет решение по пункту roadmap «Endpoint для CSP-violations»: он больше не откладывается — Sentry предоставляет готовый security-report endpoint, производный от **публичной** части DSN (тот же принцип, что уже описан в AGENTS.md для `VITE_SENTRY_DSN` — "Sentry DSNs are meant to be public"), поэтому его можно захардкодить статической строкой прямо в `vercel.json`, без доступа к env на билде.

Осталась только одна честно отложенная часть — **переключение `Report-Only` → enforce** (roadmap явно требует "1-2 недели без legitimate violations" перед этим, то есть реальное время наблюдения на проде; не может быть частью этой задачи, см. Post-Completion).

## Context (из разведки по репозиторию)

- **Деплой:** `vercel.json` (корень репо) — сейчас только `{ "ignoreCommand": ... }`. Vercel не поддерживает подстановку env-переменных внутри `vercel.json` (статический JSON) — все домены в политике жёстко прописаны как литералы.
- **Внешние ресурсы, реально используемые приложением** (проверено грепом по `src/`/`index.html` и **живыми запросами** к `https://api.poiskkino.dev` с ключом из `.env.local`):
  - `https://fonts.googleapis.com` — Google Fonts stylesheet (`index.html`).
  - `https://fonts.gstatic.com` — файлы шрифтов.
  - `https://api.poiskkino.dev` — `VITE_BASE_URL`, базовый URL `apiClient` (`src/shared/api/client.ts`).
  - `https://plausible.io` — analytics-скрипт (`script.manual.js`) и endpoint, куда он шлёт события (`src/shared/lib/analytics/analytics.ts`).
  - `https://avatars.mds.yandex.net` — постеры/бэкдропы (`Movie.poster`, `MovieDetail.backdrop`) и кадры из `getMovieImages()`/`/v1.5/image` (`MediaTab`). Подтверждено живым запросом: `GET /v1.5/movie` → `poster.previewUrl`/`poster.url` на этом хосте; `GET /v1.5/image?movieId=666` → тот же хост.
  - `https://st.kp.yandex.net` — фото персон (`persons[].photo` → `CastMember.photo` → `CastTab.tsx`, `<img src={c.photo}>`). Подтверждено запросом `GET /v1.5/movie/666`.
  - `https://o4512052151844864.ingest.us.sentry.io` — Sentry ingest, реальный org/регион из `.env.local` (US data region). Используется и для отправки error-событий SDK (`connect-src`), и для CSP violation-репортов (`report-uri`, ниже).
  - **`https://image.tmdb.org` (поле `logo`) — намеренно не добавлен.** Проверено: `mapDtoToMovieDetail.ts` не маппит `logo` в `MovieDetail`, ни один компонент его не рендерит — добавлять хост под неиспользуемое поле означало бы расширять attack surface без функциональной необходимости.
  - **Трейлеры — не iframe-embed.** `MediaTab.tsx`/`MovieHero.tsx` рендерят `trailerUrl` как обычную `<a href>`-ссылку наружу (на YouTube), не `<iframe>` — `frame-src` под YouTube не нужен.
- **Инлайн-скрипт в `index.html`** (anti-FOUC для темы) — единственный `<script>` без атрибутов; под строгий `script-src` разрешён точечно через SHA-256-хеш точного содержимого тега. **Хеш пересчитан и перепроверен дважды** (Node `crypto.createHash('sha256')` над точным текстовым содержимым между тегами — тот же алгоритм, что использует браузер для CSP hash-source): `sha256-ShrHmbACu6N1PbpK52mkpzQR/UKVXWG7C30QaRZil7s=`. Также проверено сборкой (`vite build`): хеш содержимого этого тега **идентичен** в `dist/index.html` — Vite не трансформирует/не минифицирует этот classic inline `<script>`. Инвариант («пока в проекте нет HTML-минификатора, хеш из исходного `index.html` совпадает с тем, что попадёт в прод») фиксируется в AGENTS.md, чтобы будущий разработчик, добавляющий html-minify плагин, знал, что нужно пересчитать хеш.
- **Инлайн `style`-атрибуты** — `YearRangeSlider` (`@features/catalog-filter/ui`) и «computed heights» (AGENTS.md, "Styles") рендерят инлайн `style` с рантайм-вычисленными процентами/высотами. CSP `style-src` регулирует и `<style>`-теги, и HTML-атрибут `style`; значения не статичны — хешировать нечего. Единственный практичный вариант — `'unsafe-inline'` в `style-src`. Осознанно слабее, чем хотелось бы, но затрагивает только CSS-инъекции (менее опасный вектор, чем XSS через `script-src`, который остаётся строгим).
- **`assetsInlineLimit`** (Vite дефолт — 4096 байт): маленькие ассеты (иконки/картинки), заинлайненные в CSS как `data:`-URI, требовали бы `data:` в `img-src`. Проверено: в текущей сборке (`dist/assets/*.css`) таких `url(data:...)` нет — `img-src` сегодня корректен без `data:`. Это неочевидная зависимость от билд-конфига — фиксируется в AGENTS.md, а не молча.
- **Паттерн проекта для тестируемых инвариантов:** `sentry.config.ts`/`bundle.config.ts` (корень репо) — чистые функции, вынесенные из `vite.config.ts`, у которых `vite.config.ts` — реальный build-time потребитель. У `vercel.json`-конфига такого потребителя нет (это статический файл, читаемый Vercel на этапе деплоя, не билд-артефакт) — заводить отдельный `csp.config.ts`-модуль ради "того же паттерна" было бы **дублированием без выигрыша** (второй файл с копией той же строки, которую всё равно нужно руками синхронизировать с `vercel.json`). Вместо этого — один тест-файл (`vercel-headers.test.ts`), который читает **сам** `vercel.json` как единственный источник истины и проверяет его распарсенное содержимое (директивы/хосты, хеш, остальные заголовки) напрямую — без второй копии данных.
- **Тесты:** Vitest, `globals: true`, `test.include` не задан — дефолтный glob подхватывает корневые `*.test.ts` (уже работает для `sentry.config.test.ts`/`bundle.config.test.ts`).

## Development Approach

- **Testing approach:** Regular (код → тесты в конце задачи), тот же порядок, что для `sentry.config.ts`/`bundle.config.ts`.
- Никакого нового рантайм-кода в `src/` — вся логика этой задачи — статический `vercel.json` плюс тест, который его проверяет.
- Значения в CSP — не гипотезы, а проверенные фактические хосты (см. Context выше); при реализации Task 1 значения переносятся как есть, без повторного гадания.

## Testing Strategy

- **Тест-инвариант** (`vercel-headers.test.ts`) — парсит `vercel.json`, проверяет: состав каждой CSP-директивы, отсутствие `'unsafe-inline'` в `script-src`, наличие `'unsafe-inline'` в `style-src`, точный хеш инлайн-скрипта (пересчитанный из `index.html`, не захардкоженный отдельно — чтобы тест сам ловил рассинхрон при правке `index.html`), наличие и корректность `report-uri`, `X-Frame-Options`/`Referrer-Policy`/`X-Content-Type-Options`.
- **Verification на реальном деплое** (Task 4) — `vite preview`/`vite dev` **не** отдают заголовки из `vercel.json` (это Vercel-специфичный механизм, не часть Vite) — проверка "заголовки реально применяются" делается через уже существующий Vercel Preview-деплой per PR (настроен в 0.6), не через локальный `vite preview`.
- E2E (Playwright) в проекте пока нет (roadmap 2.5.5 — отдельная будущая задача).

## Progress Tracking

- Отмечать `[x]` сразу по завершении.
- Новые задачи — с префиксом ➕, блокеры — с ⚠️.

## Solution Overview

1. `vercel.json` — единственный источник истины: `headers` с CSP `Report-Only` (все директивы + `report-uri` на Sentry) и тремя дополнительными заголовками.
2. `vercel-headers.test.ts` (корень репо) — не дублирует конфиг, а проверяет уже написанный `vercel.json` напрямую: парсит JSON → строку CSP → директивы, сверяет с ожидаемыми множествами хостов, независимо пересчитывает хеш инлайн-скрипта из `index.html`.
3. SRI — осознанно не добавляется ни для одного текущего внешнего ресурса (см. Technical Details) — решение задокументировано.
4. Endpoint для CSP-репортов — **реализован** (Sentry security endpoint, построен из реального публичного DSN). Единственное, что остаётся вне этой задачи — сам cutover в enforce-режим (требует реального времени наблюдения, см. Post-Completion).

## Technical Details

### Итоговая строка политики (`Content-Security-Policy-Report-Only`)

```
default-src 'self';
script-src 'self' 'sha256-ShrHmbACu6N1PbpK52mkpzQR/UKVXWG7C30QaRZil7s=' https://plausible.io;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' https://avatars.mds.yandex.net https://st.kp.yandex.net;
connect-src 'self' https://api.poiskkino.dev https://plausible.io https://o4512052151844864.ingest.us.sentry.io;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
report-uri https://o4512052151844864.ingest.us.sentry.io/api/4512052165607429/security/?sentry_key=<PUBLIC_KEY-из-VITE_SENTRY_DSN-в-.env.local>
```

(в файле — одна строка, директивы через `; `; здесь разбито для читаемости).

**Разбор решений по директивам:**

- `default-src 'self'` — безопасный fallback (media-src, worker-src и т.д. не используются).
- `script-src` — **без `'unsafe-inline'`**: единственный инлайн-скрипт разрешён точечно через SHA-256-хеш. `https://plausible.io` — для `script.manual.js`.
- `style-src` — с `'unsafe-inline'` (инлайн `style`-атрибуты с рантайм-значениями, см. Context). `https://fonts.googleapis.com` — stylesheet.
- `font-src https://fonts.gstatic.com` — файлы шрифтов.
- `img-src 'self' https://avatars.mds.yandex.net https://st.kp.yandex.net` — оба хоста подтверждены живыми запросами к API (см. Context), а не выведены из документации/спека.
- `connect-src` — `'self'`, `https://api.poiskkino.dev` (`VITE_BASE_URL`), `https://plausible.io`, `https://o4512052151844864.ingest.us.sentry.io` (точный ingest-хост из реального DSN, не вайлдкард-гадание). **Связка на будущее:** если `VITE_BASE_URL` или Sentry-проект/org/регион когда-нибудь поменяются — эта директива и `report-uri` ниже должны быть обновлены синхронно; тест этого не поймает (внешний факт, не рассинхрон файлов).
  - **Post-review fix (не отражено в строке выше, дословно устаревшей):** первая версия этой директивы не включала `https://fonts.googleapis.com`/`https://fonts.gstatic.com`, хотя `index.html` делает `<link rel="preconnect">` на оба хоста — Chromium сверяет resource hints с `connect-src`, поэтому без них CSP репортил бы violation на каждой загрузке страницы. Код-ревью это поймало; `vercel.json`/`vercel-headers.test.ts`/AGENTS.md обновлены — актуальная директива включает оба хоста, см. AGENTS.md, "CSP headers + security headers".
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` — стандартные hardening-директивы (то, что в первую очередь проверяет CSP Evaluator, см. Post-Completion); `frame-ancestors 'none'` дублирует `X-Frame-Options: DENY` намеренно — для старых браузеров, не понимающих CSP.
- `report-uri` — Sentry security-report endpoint, собранный из **публичной** части реального DSN (org `o4512052151844864`, project `4512052165607429`, регион `ingest.us.sentry.io` — все три значения прочитаны из `.env.local`, `VITE_SENTRY_DSN`) по документированному Sentry-формату `https://<ingest-host>/api/<project_id>/security/?sentry_key=<public_key>`. Публичный ключ DSN безопасно коммитить в `vercel.json` — тот же принцип, что уже применён к `VITE_SENTRY_DSN` в AGENTS.md ("Sentry DSNs are meant to be public") — но в этом плане сам ключ намеренно не приведён литералом (сработал `gitleaks` pre-commit хук на entropy-паттерн `generic-api-key`, см. `.gitleaks.toml`): implementer берёт актуальное значение `sentry_key` напрямую из `VITE_SENTRY_DSN` в `.env.local` при выполнении Task 1, а не копирует его из этого документа. Без `report-to`/`Reporting-Endpoints` — `report-uri` даёт нужное покрытие браузеров при минимум сложности, Sentry сам рекомендует именно этот способ для CSP-репортов.

### Дополнительные заголовки

- `X-Frame-Options: DENY` — легаси-заголовок для браузеров без поддержки `frame-ancestors`.
- `Referrer-Policy: strict-origin-when-cross-origin` — фиксируется явно, не полагаемся на браузерный дефолт.
- `X-Content-Type-Options: nosniff` — однострочный hardening без рисков регрессии, ожидается инструментами вроде securityheaders.com (на который прямо ссылается roadmap).
- HSTS **не** добавляется отдельно — Vercel проставляет его сам на своём edge-слое.

### SRI (Subresource Integrity) — решение: не применять сейчас

- Google Fonts stylesheet — контент договорной (разный `woff2` под разные UA), SRI сломает загрузку при пересборке ответа под другой браузер.
- `plausible.io/js/script.manual.js` — не версионированный URL, SRI сломает загрузку при любом апдейте скрипта на стороне Plausible.
- Вывод: ни один текущий внешний ресурс не подходит под SRI. Пересмотреть при появлении версионированного/pinned CDN-скрипта.

## What Goes Where

- **Implementation Steps** — `vercel.json`, тест, документация в AGENTS.md/roadmap.md.
- **Post-Completion** — CSP Evaluator (внешний сервис), реальный деплой и soak-период, переключение в enforce-режим.

## Implementation Steps

### Task 1: `vercel.json` — заголовки

**Files:**
- Modify: `vercel.json`

- [x] добавить `"headers": [{ "source": "/(.*)", "headers": [...] }]` с `Content-Security-Policy-Report-Only` (значение — строка из Technical Details выше, дословно), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`
- [x] убедиться, что JSON валиден (`node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"` или `make check`) и существующий `ignoreCommand` не задет

### Task 2: `vercel-headers.test.ts` — тест-инвариант против `vercel.json`

**Files:**
- Create: `vercel-headers.test.ts`

- [x] прочитать и распарсить `vercel.json`, извлечь значение заголовка `Content-Security-Policy-Report-Only` для `source: "/(.*)"`
- [x] распарсить CSP-строку на директивы (`split('; ')` → `Map<string, Set<string>>`) и утверждать: `default-src` = `'self'`; `script-src` содержит `'self'`, `https://plausible.io`, хеш-источник **и не содержит** `'unsafe-inline'`; `style-src` содержит `'self'`, `'unsafe-inline'`, `https://fonts.googleapis.com`; `font-src` = `'self' https://fonts.gstatic.com`; `img-src` = `'self' https://avatars.mds.yandex.net https://st.kp.yandex.net`; `connect-src` содержит `'self'`, `https://api.poiskkino.dev`, `https://plausible.io`, `https://o4512052151844864.ingest.us.sentry.io`; `object-src` = `'none'`; `base-uri`/`form-action` = `'self'`; `frame-ancestors` = `'none'`
- [x] прочитать `index.html`, утверждать, что в нём **ровно один** `<script>`-тег без атрибута `src` (защита от будущего второго инлайн-скрипта, который тест иначе молча пропустит), извлечь его текстовое содержимое и независимо пересчитать `sha256-<base64>` через `node:crypto` — сравнить с хеш-источником, найденным в `script-src` (не с захардкоженной строкой — так тест реально ловит рассинхрон при правке скрипта)
- [x] утверждать наличие `report-uri` в CSP-строке со значением, содержащим `o4512052151844864.ingest.us.sentry.io` и `sentry_key=`
- [x] утверждать точные значения `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`
- [x] написать edge-case тест: намеренно испорченный/отсутствующий заголовок (мок распарсенного JSON без нужного ключа) → тест-хелпер бросает понятную ошибку, а не падает с невнятным `undefined`
- [x] запустить `make test` — должно пройти перед Task 3

### Task 3: Документация — AGENTS.md и `plans/roadmap.md`

**Files:**
- Modify: `AGENTS.md`
- Modify: `plans/roadmap.md`

- [x] добавить в AGENTS.md новый раздел (по аналогии с "Error tracking (Sentry)"/"Web Vitals + Analytics"/"Performance budgets"): состав CSP и почему у каждой директивы такие источники (со ссылкой на то, что `img-src`/Sentry-хост проверены живыми запросами, а не выведены из документации); почему `script-src` — хеш, а не `'unsafe-inline'`, и что тест сам пересчитывает хеш из `index.html`, а не хранит вторую копию; почему `style-src` — с `'unsafe-inline'`; что `image.tmdb.org` (`logo`) сознательно не добавлен, т.к. поле нигде не рендерится; инвариант «Vite не трансформирует инлайн-скрипт → хеш из исходного `index.html` совпадает с `dist/index.html`, проверено сборкой; при добавлении html-minify плагина — пересчитать»; связку `assetsInlineLimit` → `img-src` без `data:` (проверено, сегодня не нужно); что `report-uri` собран из публичной части реального `VITE_SENTRY_DSN`; решение по SRI
- [x] обновить чекбоксы `plans/roadmap.md`, раздел 2.5.4: `[x]` CSP через Report-Only-заголовок; `[x]` Endpoint для CSP-violations (реализовано через Sentry security-report endpoint, не отдельным backend'ом); `[ ]` (оставить открытым) переключение на enforce — с примечанием "требует 1-2 недели реального наблюдения на проде, см. Post-Completion плана"; `[x]` X-Frame-Options/Referrer-Policy (+ X-Content-Type-Options сверх формулировки roadmap); `[x]` SRI (не применимо ни к одному текущему ресурсу, см. AGENTS.md) — секция без суффикса "— done" в заголовке, т.к. один пункт осознанно остаётся открытым (тот же стиль, что у 1.2/2.6 в roadmap)
- [x] запустить `make check` — убедиться, что правки не сломали lint/build (`make check` = format-check + lint + build; `format-check` уже падал на HEAD **до** этой задачи на несвязанных файлах — `.revmux/profile.md`, `docs/backlog/play-trailer-inline.md`, `docs/plans/completed/*.md`, `docs/plans/20260912-csp-security-headers.md` сам — pre-existing markdown-drift, вне scope Task 3; `AGENTS.md`/`plans/roadmap.md`, единственные файлы этой задачи, форматируются чисто (`oxfmt --check` зелёный на обоих). Отдельно проверены и прошли: `pnpm exec oxlint` (чисто), `make build` (typecheck + vite build — успешно), `make test` (82 файла, 684 теста — все прошли))

### Task 4: Verify acceptance criteria

- [x] проверить, что все директивы из Technical Details присутствуют в `vercel.json` и совпадают с задокументированными решениями — сверено построчно, полное совпадение
- [x] проверить, что используется `Content-Security-Policy-Report-Only` (не enforcing) — подтверждено
- [x] запустить полный набор тестов: `make test` — 82 файла / 684 теста, все прошли
- [x] запустить `make build` — без регрессий; после билда независимо пересчитать хеш инлайн-скрипта из `dist/index.html` (`node -e` со скриптом, аналогичным использованному в тесте) и подтвердить совпадение с тем же значением — билд прошёл успешно, пересчитанный хеш `sha256-ShrHmbACu6N1PbpK52mkpzQR/UKVXWG7C30QaRZil7s=` идентичен значению в `vercel.json` и `script-src`
- [ ] запушить ветку/открыть PR, дождаться Vercel Preview-деплоя (уже настроен, 0.6); `curl -sI <preview-url>` — подтвердить, что все четыре заголовка реально присутствуют в HTTP-ответе (это то, чего `vite preview`/`vite dev` не показывают — заголовки из `vercel.json` применяет только сам Vercel) — **pending human action**: требует push/PR, что не выполняется автономно без явного разрешения человека; ранее ошибочно отмечено `[x]`, реально не выполнялось (см. finding код-ревью)
- [ ] открыть Preview-URL в браузере, DevTools console, пройти `/`, `/search`, `/movie/:id`, `/favorites`, `/popular`, `/recommendations` — не должно быть **неожиданных** Report-Only warning'ов сверх задокументированных в AGENTS.md; учитывать, что Vercel Preview может добавлять собственный шум (Vercel Toolbar/`vercel.live`), которого не будет на production-домене — не путать с реальными нарушениями политики — **pending human action**: требует открытого Preview-деплоя (см. пункт выше); ранее ошибочно отмечено `[x]`, реально не выполнялось

### Task 5: [Final] Обновить документацию и переместить план

- [x] проверить README.md — обновить, если там есть раздел про security-заголовки/бейджи (иначе пропустить) — README.md не содержит такого раздела (только бейджи стека: CI, React, TypeScript, Vite, FSD) и упоминаний CSP/security headers — пропущено, изменений не требуется
- [x] подтвердить, что AGENTS.md/roadmap.md уже обновлены в Task 3 — подтверждено: AGENTS.md содержит раздел "CSP headers + security headers" (строки 273-285) с полным описанием директив/хеша/report-uri/SRI-решения; `plans/roadmap.md` раздел 2.5.4 (строки 435-439) отмечает все пункты `[x]`, кроме сознательно открытого пункта про enforce-переключение (`[ ]`, с примечанием про 1-2 недели наблюдения) — соответствует плану дословно
- [ ] переместить этот план в `docs/plans/completed/` — **pending**: перемещение плана выполняется оркестратором после завершения всех фаз ревью (ещё не выполнено); ранее ошибочно отмечено `[x]`

## Post-Completion

*Пункты без чекбоксов — требуют ручных действий или реального времени наблюдения.*

**Ручная проверка:**

- Прогнать итоговую строку политики через [CSP Evaluator](https://csp-evaluator.withgoogle.com/) — обработать замечания, если найдутся.
- Мониторить **production**-домен (`kinoshka-gilt.vercel.app`, не Preview — см. заметку про шум от Vercel Toolbar в Task 4) на Report-Only violations через Sentry (endpoint уже подключён этой задачей) **1–2 недели**, как предписывает roadmap.
- По истечении soak-периода без легитимных нарушений — переключить заголовок `Content-Security-Policy-Report-Only` → `Content-Security-Policy` в `vercel.json` (убрав `-Report-Only`-суффикс из имени заголовка и, по желанию, из `report-uri`-текста), обновить `vercel-headers.test.ts` на новое имя заголовка, передеплоить.

**Внешние системы:**

- Если `VITE_BASE_URL` (домен API) или Sentry org/project/регион когда-нибудь изменятся — `connect-src` и `report-uri` в `vercel.json` нужно обновить вручную; ни один тест этого не отследит (внешний факт, не рассинхрон файлов в репозитории).
