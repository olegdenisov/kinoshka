# Lighthouse CI (roadmap 2.5.6)

## Overview

Пункт 2.5.6 роадмапа: прогон Lighthouse (Performance/A11y/SEO/Best Practices) в CI против preview-деплоя, с бюджетами и fail-условием на просадку. Задача закрывает последний измеримый пункт Phase 2.5 (pre-launch readiness) перед Phase 3 — Sentry (2.5.1), Web Vitals (2.5.2), bundle budgets (2.5.3), CSP (2.5.4) и E2E (2.5.5) уже сделаны.

Kinoshka — CSR SPA, поэтому любая навигация Lighthouse по реальной странице (`/`, `/search`, `/movie/:id`) дёргает живой Kinopoisk API (demo-тариф, 200 запросов/сутки, уже разделяемых с E2E). Ориентировочно 10-20 запросов на прогон трёх URL при `numberOfRuns: 1` — это и определяет решения по квоте ниже.

**Ревизия #2 после двух раундов auto-review** (`planning:plan-review`, обычная модель + Opus). Раунд 1 нашёл и исправил: импорт `.cjs` из TS-теста не проходил `tsc -b`, в workflow не было `permissions` (комментарий в PR не запостился бы), пороги ставились без замера базлайна (в `index.html` нет `<meta name="description">`, `public/robots.txt` не существует). Раунд 2 (Opus) нашёл структурную проблему в самой ревизии раунда 1 и три более мелких:

1. **Vercel помечает preview-деплои `X-Robots-Tag: noindex`** — Lighthouse-аудит `is-crawlable` (часть категории SEO) проверяет именно этот заголовок, не только `<meta name="robots">`. На preset `desktop` категория SEO — это ~10 равновесных аудитов; один гарантированный провал `is-crawlable` не даёт SEO подняться выше ≈0.9 — ниже заявленного порога `error@0.95`. Роадмап явно требует гонять именно по preview-URL — то есть это не побочный эффект, а встроенное противоречие исходной ревизии, если его не разрулить явно (см. Task 4).
2. **Локальный `vite preview` — не авторизует пороги для CI-гейта.** `vite preview` не применяет `vercel.json`'s заголовки (то же самое уже задокументировано в AGENTS.md для E2E — «CSP headers CSP are не exercised»), не даёт `X-Robots-Tag`, не даёт CDN-сжатие Vercel. Значит «замерить локально → зафиксировать пороги» из ревизии №1 измеряло не ту среду, по которой реально будет гоняться гейт. Локальный прогон остаётся как быстрый dev-smoke-луп, а авторитетный базлайн — отдельный шаг против реального Vercel preview (Task 4).
3. `lighthouse-config.test.ts`'s эскиз читал `require('../lighthouserc.cjs')`, а файл теста лежит в корне (как и конфиг) — должно быть `./lighthouserc.cjs`.
4. Утверждение в Context «`e2e/movie-detail.spec.ts` уже использует id `666`» было неверным — этот спек ходит по первой карточке с главной (`firstMovieCard`, динамический id) и использует `9999999` для 404-кейса; `666` нигде под `e2e/` не встречается. Единственное упоминание `666` в репозитории — одноразовый ручной `curl`/`GET` во время CSP-задачи (см. AGENTS.md), не закреплённая тестовая фикстура.

**Ревизия #3 (внешнее ревью, codex)** нашла, что фикс из ревизии №2 для находки №1 сам был неверным: `'is-crawlable': ['off', {}]` рядом с `'categories:seo': ['error', {minScore: 0.95}]` не решает проблему — LHCI-ассерт на конкретный аудит выключает только проверку этого аудита, а не пересчитывает `categories.seo.score`, который Lighthouse считает сам по весам всех аудитов категории; проваленный `is-crawlable` с нулём остаётся в агрегате, и категорийный порог 0.95 всё равно не достигается. Исправлено — вместо категорийного `categories:seo`-ассерта заводится набор явных per-audit ассертов (все SEO-аудиты категории кроме `is-crawlable`), см. Task 4/Technical Details. Заодно нашла, что `wait-for-vercel-preview` сам делает HTTP-проверку готовности preview до Lighthouse — если preview защищён Deployment Protection, bypass-заголовок нужен и в его собственных входах (`vercel_protection_bypass_header`/`vercel_password`), не только в Lighthouse-конфиге (см. Task 4). И третье — `lighthouse-config.test.ts` не проверял `ci.collect.settings.preset === 'desktop'`, ключевое антифлейк-решение, которое могло быть случайно удалено незамеченным — добавлен отдельный ассерт.

Всё это исправлено ниже.

## Context (from discovery)

- **CI-инфраструктура**: `.github/workflows/{ci,e2e,codeql}.yml`. `e2e.yml` — отдельный файл, лейбл-триггер `run-e2e`, исключает форк-PR, чекаутит `github.event.pull_request.head.sha`. Тот же паттерн — под лейблом `run-lighthouse`.
- **`permissions`-блок** не подразумевается по умолчанию в этом репо: `codeql.yml` явно объявляет свой набор. `lighthouse.yml` должен сделать то же самое (`pull-requests: write` для комментария, `deployments`/`statuses: read` для ожидания Vercel-деплоя).
- **Деплой**: Vercel, `vercel.json`'s `ignoreCommand` **ограничивает preview-деплои коммитами автора `olegdenisov`** — на PR от бота/другого автора preview не создастся вообще. Job должен ждать деплой через GitHub Deployments API и корректно фейлиться по таймауту, если его не будет (см. Post-Completion). Это предполагает, что Vercel вообще создаёт GitHub Deployments для этого репо (обычное поведение официальной GitHub-интеграции Vercel, не CLI-деплоя) — проверяется вместе с Deployment Protection одним визитом в дашборд (Task 4).
- **Vercel добавляет `X-Robots-Tag: noindex` на все preview-деплои** (стандартное поведение платформы, не специфика этого проекта) — Lighthouse's `is-crawlable`-аудит (SEO) читает этот заголовок и провалит его на любом preview независимо от контента страницы. Это нужно подтвердить `curl -I` по реальному preview и, если подтверждено, уйти от категорийного `categories:seo`-ассерта к набору per-audit ассертов, исключающему только `is-crawlable` — простое `'is-crawlable': ['off', {}]` рядом с категорийным ассертом **не работает**: оно выключает проверку этого одного аудита, но не меняет `categories.seo.score`, который Lighthouse считает сам по весам всех аудитов категории, включая проваленный (см. ревизия #3, Task 4/Technical Details).
- **Vercel Deployment Protection не проверена** — если preview защищён Vercel Authentication, Lighthouse проаудитит страницу логина, а не приложение. Проверяется тем же визитом в дашборд, до первого реального прогона (Task 4).
- **Root-level конфиги с юнит-тестами** — устоявшийся паттерн: `sentry.config.ts`/`bundle.config.ts` (программная логика, TS) + тест, `vercel-headers.test.ts` (статичный JSON) — читает `vercel.json` напрямую, не дублирует его в отдельном `*.config.ts`. `lighthouserc.cjs` ближе ко второму случаю (статичные данные), но выбран формат `.cjs`, а не `lighthouserc.json` — **почему**: `@lhci/cli` поддерживает оба, но JSON не может нести inline WHY-комментарии к каждому порогу/решению (квота, `preset`, `is-crawlable`-исключение), а этот репозиторий уже один раз делал ровно этот выбор явно — `knip.jsonc` выбран вместо `knip.json` «специально, потому что `knip.json` не может нести комментарии» (см. AGENTS.md, 2.5.3). Тот же прецедент применяется здесь.
- **`package.json` имеет `"type": "module"`**, а `@lhci/cli` грузит конфиг через `require()` — обычный `lighthouserc.js` упадёт с `ERR_REQUIRE_ESM`. `.cjs` — расширение, которое Node всегда трактует как CommonJS независимо от `"type"`, и единственное, которое `@lhci/cli` сегодня реально поддерживает (проверено через `GoogleChrome/lighthouse-ci#973` — `.cjs` добавлен, `.mjs`/полноценный ESM-конфиг там до сих пор открытый feature request). Отклонение от буквального имени `lighthouserc.js` из roadmap-приложения фиксируется явно.
- **Импорт `.cjs` из TS-теста не проходит `tsc -b` через `import()`** (`tsconfig.node.json` без `allowJs`, `moduleResolution: "bundler"` требует деклараций типов). Решение — `createRequire(import.meta.url)` из `node:module`: TS не резолвит модуль по строке, переданной в рантайм-вызов; `NodeRequire`'s call signature возвращает `any` неявно (не литеральная аннотация — `.oxlintrc.json`'s `no-explicit-any` бьёт по написанному `: any`, не по выведенному типу), поверх — локальный `type LighthouseRc` и `as`-каст. Путь — `./lighthouserc.cjs` (оба файла в корне, `../` был бы ошибкой).
- **`make lint`/`make format-check` покрывают `.cjs`-файлы** — `"lint": "oxlint ."`/`"format:check": "oxfmt --check ."` не ограничены расширением, в отличие от `lint-staged`'s glob (`*.{ts,tsx}` — pre-commit `.cjs` не тронет). `.oxlintrc.json`'s `env` не включает `node` (только `builtin`/`browser`/`vitest`) — нужно на практике проверить, не ругается ли oxlint на `module`/`require` в `.cjs`.
- **`tsconfig.node.json`** — solution-style include-список. `lighthouse-config.test.ts` должен попасть в него явно.
- **`.gitignore` не содержит записи для `.lighthouseci/`** (проверено чтением файла) — `lhci autorun` пишет туда отчёты/lhr-JSON при каждом локальном прогоне; без записи в `.gitignore` это грозит попасть в `git add -A`.
- **`treosh/lighthouse-ci-action` не читает `devDependencies` репозитория** — вендорит собственную версию `@lhci/cli`/Lighthouse. Значит держать `@lhci/cli` как devDependency ради версионной согласованности с CI — ложная посылка; единственный реальный потребитель — локальный `make lighthouse`. Учитывая это, а также что `ci.yml` содержит 7 отдельных job'ов, устанавливающих полный lockfile (лишний install-time на каждый), и что новая devDependency потребовала бы `ignoreDependencies`-исключения в `knip.jsonc` (сейчас там такого ключа нет вовсе) — выбор: **не добавлять `@lhci/cli` в `package.json`**, запускать через `pnpm dlx @lhci/cli@<pinned-version>` с зафиксированной версией прямо в `Makefile`-таргете. Ноль изменений в лок-файле, ноль knip-нагрузки, ноль лишнего install-time в CI.
- **`lhci` запускает Chrome через `chrome-launcher`**, которому нужен системный Chrome — машина только с Playwright-бандлованным Chromium (нет системного Chrome) упадёт с `NO_USABLE_CHROME`. Это фиксируется как известное предусловие для `make lighthouse`, не решается в рамках этого плана.
- **`e2e/movie-detail.spec.ts` НЕ использует id `666`** — ходит по первой карточке с главной (`firstMovieCard(page)`, id динамический) и `9999999` для 404-кейса. Единственное упоминание `666` в репо — одноразовый ручной `GET /v1.5/movie/666` из CSP-задачи (AGENTS.md), не закреплённая фикстура. `666` всё равно используется здесь как фиксированный URL для `/movie/:id` (Lighthouse не умеет «кликнуть по первой карточке» — нужен литеральный URL), но требует живой проверки перед тем, как войти в состав гейта (Task 4), и осознания риска: если запись когда-нибудь пропадёт из каталога, `MoviePage` отрендерит `ErrorState` «Movie not found», и Lighthouse тихо начнёт измерять страницу ошибки вместо приложения — принято как известный риск (Post-Completion), не решается доп. контент-проверкой ради простоты.
- **`index.html` не содержит `<meta name="description">`, `public/` не содержит `robots.txt`** — оба факта проверены чтением файлов напрямую. Оба чинятся в Task 3 как часть локального smoke-прогона; ни один из них не связан с `is-crawlable`/`X-Robots-Tag` (см. выше) — это два независимых источника SEO-просадки.

## Development Approach

- **Testing approach**: Regular (код → тест), как во всех предыдущих задачах Phase 2.5.
- Полное выполнение каждой задачи перед следующей, мелкие изменения.
- Все новые/изменённые куски логики — с тестами, кроме `.github/workflows/*.yml` и `Makefile`-таргетов (прецедент: `e2e.yml`/`ci.yml` тоже без тестов).
- Все тесты, а также `make lint`/`make format-check`/`make typecheck`/`make knip`, должны проходить перед переходом к следующей задаче.
- Обновлять этот файл при отклонениях (➕/⚠️-префиксы) — особенно фактические числа замера базлайна в Task 3/Task 4.

## Testing Strategy

- **Unit-тесты**: `lighthouse-config.test.ts` (Vitest) — проверяет структуру/пороги `lighthouserc.cjs` напрямую из файла через `createRequire`, по прецеденту `vercel-headers.test.ts`. Важная оговорка (в отличие от `vercel-headers.test.ts`, который _пересчитывает_ SHA-256 хэш из `index.html`): этот тест не выводит числа из независимого источника, а хардкодит те же 4 порога, что и конфиг, — он ловит только «забыли обновить тест при правке конфига», не «порог сам по себе неверный». Единственная реальная защита от тихого занижения порога — правило Task 3/Task 4 «не занижать молча, документировать разрыв».
- **E2E**: не требуется — отдельная инфраструктура, не связана с Lighthouse.
- **Ручная/CI-проверка workflow**: `.github/workflows/lighthouse.yml` проверяется реальным прогоном на тестовом PR (Task 4 — предварительный, Task 6 — финальный) — GitHub Actions workflow нельзя юнит-тестировать локально без реального раннера.

## Progress Tracking

Отмечать `[x]` сразу по завершении, ➕ для новых пунктов, ⚠️ для блокеров.

## Solution Overview

1. **`lighthouserc.cjs`** (root) — `ci.assert`/`ci.collect.numberOfRuns`/`ci.collect.settings`. `categories:accessibility`/`categories:best-practices` — `error`; SEO гейтится не категорией целиком, а набором per-audit ассертов, заводимых в Task 4 (см. п.4 ниже и Technical Details — категорийный `categories:seo`-ассерт несовместим с гарантированным `is-crawlable`-провалом на Vercel preview); `categories:performance` — **временно `warn`** (не `error`) на период «soak»: единственный прогон (`numberOfRuns: 1`) живой CSR-страницы на shared CI-раннере даёт статистически шумный Performance-скор, и жёсткий `error`-гейт на нём при отсутствии медианы из нескольких прогонов будет чаще ловить шум раннера, чем реальные регрессии — поднимается до `error` одновременно с переводом `lighthouse`-job'а в required check (тот же отложенный шаг, что уже принят для `e2e`-job'а, см. Post-Completion). `collect.url`/`collect.startServerCommand` в общий конфиг не идут — оба контекстно-зависимы и передаются CLI-флагами отдельно в CI и локально.
2. **`make lighthouse`** — локальный dev-smoke-луп через `pnpm dlx @lhci/cli`, поднимает `vite preview` через встроенный `--collect.startServerCommand`, апает отчёты на `filesystem` (не наружу). **Не авторитетный источник порогов** — среда отличается от Vercel preview (заголовки, сжатие, `X-Robots-Tag`).
3. **Замер базлайна локально** (Task 3) — быстрая итерация на дешёвых, средово-независимых проблемах (`<meta name="description">`, `robots.txt`, a11y `color-contrast`, очевидные perf-узкие места), не сам факт готовности к гейту.
4. **`.github/workflows/lighthouse.yml`** (Task 4) — включает: проверку Vercel Deployment Protection/GitHub Deployments, проверку `X-Robots-Tag` и `is-crawlable`-исключение, проверку живости `/movie/666`, и **авторитетный** замер базлайна на реальном preview — только после него пороги считаются зафиксированными.
5. **`lighthouse-config.test.ts`** — юнит-тест на структуру/пороги/исключения внутри `lighthouserc.cjs`.

Не реализуется в этом плане (пункт 2.5.7 роадмапа): алёрты/дашборд поверх Lighthouse/Sentry/Web Vitals.

## Technical Details

**`lighthouserc.cjs`** (эскиз, финальные числа/исключения — по факту Task 1/Task 4):

```js
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1, // квота demo-тарифа — без медианы из 3 прогонов, но в 3 раза
      // меньше нагрузки на живой API за то же покрытие роутов
      settings: {
        preset: 'desktop', // mobile-preset с simulated throttling — известный источник
        // флейков на shared CI-раннерах; desktop стабильнее и воспроизводимее для
        // CI-гейта. Не то же самое, что mobile-first вёрстка проекта — это профиль
        // аудита, не целевая аудитория.
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }], // временно warn, не
        // error — см. Solution Overview, п.1. Поднять до error одновременно с
        // переводом lighthouse-job'а в required check (см. Post-Completion).
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        // Нет 'categories:seo' — намеренно, добавляется в Task 4 не как
        // категория целиком, а как набор ассертов по отдельным SEO-аудитам,
        // ПОСЛЕ подтверждения через `curl -I` реального preview-URL, что
        // Vercel шлёт X-Robots-Tag: noindex на все preview-деплои (см.
        // Context). Категорийный 'categories:seo': ['error', {minScore:
        // 0.95}] здесь не работает даже с 'is-crawlable': 'off' рядом —
        // LHCI-ассерт на конкретный аудит выключает только ПРОВЕРКУ этого
        // аудита, а не пересчитывает сам categories.seo.score, который
        // Lighthouse считает внутри себя по весам всех аудитов категории
        // (включая проваленный is-crawlable с нулём) — агрегат всё равно
        // не дотянет до 0.95. Правильная замена — 'document-title': 'error',
        // 'meta-description': 'error', 'http-status-code': 'error',
        // 'link-text': 'error', 'crawlable-anchors': 'error',
        // 'robots-txt': 'error', 'canonical': 'error', 'viewport': 'error',
        // 'is-crawlable': 'off' — гейт по всему, что реально зависит от
        // приложения, минус единственный платформенный false positive.
      },
    },
  },
}
```

`collect.url` и `collect.startServerCommand` сюда не идут — передаются CLI-флагами из каждого места запуска.

Категория `pwa` не включается — в Lighthouse v12+ удалена (roadmap, строка 862).

**`lighthouse-config.test.ts`** (эскиз):

```ts
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

type LighthouseAssertions = Record<string, [string, Record<string, unknown>]>
type LighthouseRc = {
  ci: {
    collect: { numberOfRuns: number }
    assert: { assertions: LighthouseAssertions }
  }
}

const require = createRequire(import.meta.url)
const lighthouserc = require('./lighthouserc.cjs') as LighthouseRc

// ... проверки: ci.collect.settings.preset === 'desktop' (ключевое антифлейк-решение,
// случайное удаление не должно проходить незамеченным); categories:performance ===
// 'warn' (с комментарием "временно, см. Post-Completion"), categories:accessibility/
// categories:best-practices === 'error'; НЕТ ключа categories:seo (после Task 4 —
// вместо него набор per-audit ассертов, см. Technical Details); точные пороги
// 0.9/0.95/0.9 (мандат роадмапа) для трёх оставшихся category-ассертов; numberOfRuns
// — целое ≥ 1; после Task 4 — is-crawlable исключительно 'off', остальные
// перечисленные SEO-аудиты (document-title/meta-description/http-status-code/
// link-text/crawlable-anchors/robots-txt/canonical/viewport) — 'error'
```

**Workflow `.github/workflows/lighthouse.yml`** (эскиз):

```yaml
name: Lighthouse CI

on:
  pull_request:
    types: [labeled]

concurrency:
  group: lighthouse-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lighthouse:
    if: >
      github.event.label.name == 'run-lighthouse' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      pull-requests: write
      deployments: read
      statuses: read
    steps:
      # Нет setup-node/pnpm install — намеренно: treosh/lighthouse-ci-action
      # вендорит собственный @lhci/cli, ничего из package.json ему не нужно.
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Wait for Vercel preview
        id: wait
        uses: patrickedqvist/wait-for-vercel-preview@<pin-latest-tag>
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300
          # Только если Task 4 подтвердит Deployment Protection на preview:
          # vercel_protection_bypass_header: ${{ secrets.VERCEL_PROTECTION_BYPASS }}
          # — этот шаг сам делает HTTP-проверку готовности preview ДО Lighthouse,
          # без bypass'а здесь упадёт/зависнет по таймауту раньше, чем дело дойдёт
          # до lhci-шага (см. ревизия #3) — это отдельная точка конфигурации,
          # не заменяется extraHeaders у Lighthouse ниже

      - name: Run Lighthouse CI
        id: lhci
        continue-on-error:
          true # чтобы шаг комментария выполнился и при
          # упавших assertion'ах
        uses: treosh/lighthouse-ci-action@<pin-latest-tag>
        with:
          urls: |
            ${{ steps.wait.outputs.url }}
            ${{ steps.wait.outputs.url }}/search
            ${{ steps.wait.outputs.url }}/movie/666
          configPath: ./lighthouserc.cjs
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Comment PR with results
        uses: actions/github-script@<pin-latest-tag>
        with:
          script: |
            // markdown из steps.lhci.outputs.links + assertionResults; если оба
            // outputs пустые (lhci упал на сборе данных — например 401 от Deployment
            // Protection или сетевая ошибка, а не на assertion) — явный текст
            // "Lighthouse run failed before assertions ran", не пустая таблица.
            // Sticky-комментарий по маркеру <!-- lighthouse-ci-comment -->:
            // обновлять существующий, не плодить новые при повторных прогонах.

      - name: Fail on Lighthouse assertion failure
        if: steps.lhci.outcome == 'failure'
        run: exit 1
```

`steps.lhci.outcome` остаётся `'failure'` при `continue-on-error: true` (в отличие от `conclusion`, которое станет `'success'`) — финальный шаг ловит именно это.

**`make lighthouse`** (эскиз, Makefile):

```makefile
lighthouse: build-only
	pnpm dlx @lhci/cli@<pinned-version> autorun --config=./lighthouserc.cjs \
	  --upload.target=filesystem \
	  --collect.startServerCommand='pnpm exec vite preview --port 4173 --strictPort' \
	  --collect.startServerReadyPattern='Local:' \
	  --collect.url=http://localhost:4173 \
	  --collect.url=http://localhost:4173/search \
	  --collect.url=http://localhost:4173/movie/666
```

`--upload.target=filesystem` — явно, чтобы не полагаться на дефолтное поведение `lhci autorun` по загрузке отчётов; локальные прогоны не должны непреднамеренно улетать в `temporary-public-storage` (это осознанно включено только для CI, см. Post-Completion). `@lhci/cli` сам поднимает/ждёт (`startServerReadyPattern` — регэксп по сырому, потенциально цветному stdout; `vite preview` печатает `➜  Local:   http://localhost:4173/`, `'Local:'` должен матчиться безопасно, но если паттерн когда-нибудь перестанет совпадать — `lhci` зависнет до дефолтного `startServerReadyTimeout` (10с) и упадёт с не самой очевидной ошибкой, держать в уме при отладке)/гасит процесс сам — без ручной bash-оркестрации.

**Требует системного Chrome** (`chrome-launcher`) — на машине только с Playwright-бандлованным Chromium `make lighthouse` упадёт с `NO_USABLE_CHROME`; фиксируется как предусловие, не решается в этом плане.

## What Goes Where

- **Implementation Steps** (`[ ]`): код, тесты, конфиги, документация в этом репозитории.
- **Post-Completion**: проверка Vercel Deployment Protection/GitHub Deployments (частично влита в Task 4 как обязательная), наблюдение за стабильностью/квотой, решение про required-check + одновременный перевод `categories:performance` в `error`.

## Implementation Steps

### Task 1: `lighthouserc.cjs` — бюджеты Lighthouse CI + юнит-тест

**Files:**

- Create: `lighthouserc.cjs`
- Create: `lighthouse-config.test.ts`
- Modify: `tsconfig.node.json`

- [ ] создать `lighthouserc.cjs` в корне: `categories:accessibility`/`categories:best-practices` — `error` с порогами 0.95/0.9; `categories:performance` — `warn` с порогом 0.9 (временно, см. Technical Details); `ci.collect.numberOfRuns: 1`; `ci.collect.settings.preset: 'desktop'` — каждое решение с WHY-комментарием. **Пока без `categories:seo`** — этот ассерт заводится в Task 4 не как категория целиком, а как набор per-audit ассертов (см. Task 4/Technical Details) — в Task 1 достаточно зафиксировать комментарием-заглушкой, почему его здесь ещё нет
- [ ] явно НЕ добавлять `collect.url`/`collect.startServerCommand` в конфиг — зафиксировать комментарием в файле, почему (CLI-флаги по контексту запуска)
- [ ] написать `lighthouse-config.test.ts` (root): читать `lighthouserc.cjs` через `createRequire(import.meta.url)` + `require('./lighthouserc.cjs')` (не `'../...'` — оба файла в корне) + локальный `type LighthouseRc` + `as`-каст
- [ ] тест: `categories:performance` === `'warn'`, `categories:accessibility`/`categories:best-practices` === `'error'` (не унифицированная проверка «все error» — раз severity намеренно разная); `ci.collect.settings.preset === 'desktop'` — отдельным ассертом (ключевое антифлейк-решение, случайное удаление не должно проходить незамеченным)
- [ ] тест: точные пороги 0.9/0.95/0.9 (мандат роадмапа, для трёх заведённых в Task 1 category-ассертов) + `numberOfRuns` — целое число ≥ 1
- [ ] добавить `lighthouse-config.test.ts` в `tsconfig.node.json`'s `include`
- [ ] `make test`, `make typecheck`, `make lint`, `make format-check` — все четыре должны пройти (в т.ч. новый `.cjs`-файл — не покрыт `lint-staged`'s glob; проверить, не ругается ли oxlint на `module`/`require` при отсутствующем `node`-env в `.oxlintrc.json`, и если да — точечное решение)

### Task 2: `make lighthouse` — локальный dev-smoke-луп

**Files:**

- Modify: `Makefile`
- Modify: `.gitignore`

- [ ] добавить `lighthouse: build-only` таргет в `Makefile` по эскизу из Technical Details — `pnpm dlx @lhci/cli@<pinned-version>` (запинить конкретную версию в самой команде — **не** добавлять `@lhci/cli` в `package.json`'s `devDependencies`, см. Context: `treosh/lighthouse-ci-action` вендорит свою версию и не читает лок-файл репозитория, а `pnpm dlx` не тянет install-time во все 7 job'ов `ci.yml` и не требует `knip.jsonc`-исключения), `--upload.target=filesystem`, `--collect.startServerCommand`/`--collect.startServerReadyPattern`, три `--collect.url`
- [ ] добавить `lighthouse` в `.PHONY`-список в начале `Makefile`
- [ ] добавить `.lighthouseci/` в `.gitignore` (сейчас отсутствует — `lhci autorun` пишет отчёты в эту директорию при каждом прогоне)
- [ ] задокументировать предусловие «нужен системный Chrome» прямо в Makefile-комментарии над таргетом (см. Technical Details)
- [ ] тесты не применимы (shell-таргет) — вместо этого: один ручной локальный прогон `make lighthouse` завершается (не зависает, репорт пишется в `.lighthouseci/` и не публикуется наружу) — фактическая проверка идёт в Task 3

### Task 3: Замер базлайна локально + починка выявленных разрывов

**Files:**

- Modify: `index.html`
- Create: `public/robots.txt`

Важно: этот прогон — **быстрый dev-smoke-луп, не авторитетный источник порогов** для CI-гейта (`vite preview` не отдаёт заголовки `vercel.json`, не даёт `X-Robots-Tag`/CDN-сжатие — см. Context/Overview). Цель этой задачи — починить дешёвые, средово-независимые проблемы до того, как они замаскируют реальные находки на настоящем preview в Task 4.

- [ ] прогнать `make lighthouse` локально, зафиксировать сырые числа по всем 4 категориям × 3 роутам
- [ ] добавить `<meta name="description" content="...">` в `<head>` `index.html`
- [ ] создать `public/robots.txt` (`User-agent: *\nAllow: /`) — реальный статик-файл в `public/` попадает в `dist/` и перехватывается Vercel'ом раньше SPA-rewrite'а (filesystem-check перед rewrites)
- [ ] проинспектировать accessibility-находки, специально — `color-contrast` (axe severity `serious`, Lighthouse a11y weight 7): E2E-сьют (2.5.5) проверяет только `impact === 'critical'`, `color-contrast` туда не попадает — это реальный, не гипотетический риск нового провала именно здесь
- [ ] проинспектировать performance-находки, специально — render-blocking Google Fonts (`index.html`'s `<link rel="stylesheet">` на `fonts.googleapis.com`) и LCP на CSR-раскладке (первый рейл ждёт живой API-ответ)
- [ ] повторно прогнать `make lighthouse`, зафиксировать в этом плане (➕) итоговые числа и что было исправлено
- [ ] `make test`, `make typecheck` — должны пройти

### Task 4: `.github/workflows/lighthouse.yml` + авторитетный базлайн на реальном preview

**Files:**

- Create: `.github/workflows/lighthouse.yml`
- Modify: `lighthouserc.cjs`
- Modify: `lighthouse-config.test.ts`

- [ ] **до** написания workflow — один визит в Vercel dashboard: (а) подтвердить, что для этого репо преview-деплои создаются через официальную GitHub-интеграцию (появляются как GitHub Deployments — предпосылка для `wait-for-vercel-preview`), (б) подтвердить статус Vercel Authentication/Deployment Protection на preview-окружении
- [ ] если preview защищён — решить: отключить protection для preview-окружения, либо прокинуть bypass-секрет **в двух независимых местах** (это не одна настройка, а две): (а) `patrickedqvist/wait-for-vercel-preview`'s собственные входы `vercel_protection_bypass_header`/`vercel_password` — сам этот шаг делает HTTP-проверку готовности preview _до_ Lighthouse, и без bypass'а именно здесь упадёт/зависнет по таймауту, ещё до того как до Lighthouse вообще дойдёт очередь; (б) `collect.settings.extraHeaders` в `lighthouserc.cjs` — отдельно для самого Lighthouse-прогона. Задокументировать выбор здесь (⚠️ при отклонении от эскиза)
- [ ] `curl -I` по любому реальному текущему preview-URL, подтвердить заголовок `X-Robots-Tag: noindex`; если подтверждено — **не** отключать assert конкретного аудита (`'is-crawlable': ['off', {}]` рядом с `'categories:seo': ['error', {minScore: 0.95}]`) — LHCI-ассерт на аудит только выключает проверку конкретно этого аудита, но не меняет сам `categories.seo.score`, который Lighthouse считает внутри себя по весам всех аудитов категории, включая проваленный `is-crawlable` с нулём; агрегированный `categories:seo`-порог 0.95 продолжит падать даже с выключенным ассертом на `is-crawlable`. Правильный фикс — **заменить** `'categories:seo': ['error', {minScore: 0.95}]` на явные ассерты по отдельным SEO-аудитам категории кроме `is-crawlable` (`'document-title': 'error'`, `'meta-description': 'error'`, `'http-status-code': 'error'`, `'link-text': 'error'`, `'crawlable-anchors': 'error'`, `'robots-txt': 'error'`, `'canonical': 'error'`, `'viewport': 'error'`, `'is-crawlable': 'off'`) — с WHY-комментарием (см. Technical Details), обновить `lighthouse-config.test.ts` (проверка: `categories:seo`-ключа больше нет, каждый из перечисленных аудитов явно `error`, `is-crawlable` явно `off`)
- [ ] проверить живьём `GET /v1.5/movie/666` возвращает 200 (не 404) — если нет, подобрать другой стабильный id перед тем, как вписывать его в `urls`
- [ ] создать `lighthouse.yml` с собственным `on: pull_request: types: [labeled]` (не трогать `ci.yml`)
- [ ] `if:` на `github.event.label.name == 'run-lighthouse'` и `github.event.pull_request.head.repo.full_name == github.repository`
- [ ] `permissions: { contents: read, pull-requests: write, deployments: read, statuses: read }`, `timeout-minutes: 20`
- [ ] `actions/checkout@v7` с `ref: ${{ github.event.pull_request.head.sha }}`
- [ ] шаг `patrickedqvist/wait-for-vercel-preview` (запинить актуальный тег на marketplace) — `token: secrets.GITHUB_TOKEN`, `max_timeout: 300`
- [ ] шаг `treosh/lighthouse-ci-action` (запинить версию) с `continue-on-error: true` — `urls` из трёх строк, `configPath: ./lighthouserc.cjs`, `uploadArtifacts: true`, `temporaryPublicStorage: true`
- [ ] шаг `actions/github-script` (запинить версию, тем же способом, что остальные два экшена) — markdown-таблица из `assertionResults`/`links`, явный фолбэк-текст на случай пустых outputs (сбор данных упал раньше assertion'ов), sticky-комментарий по маркеру
- [ ] финальный шаг `if: steps.lhci.outcome == 'failure'` → `exit 1`
- [ ] `concurrency: { group: lighthouse-${{ github.ref }}, cancel-in-progress: true }`
- [ ] создать тестовый PR, повесить лейбл `run-lighthouse`, дождаться реального прогона против настоящего Vercel preview — зафиксировать в этом плане (➕) фактические числа по всем 4 категориям × 3 роутам; если что-то всё ещё не дотягивает до порога по причине, не устранённой Task 3 (`is-crawlable`-класса, платформенной, а не связанной с кодом приложения) — задокументировать здесь, а не тихо ослаблять порог
- [ ] `make typecheck`, `make lint` — должны пройти (задеты `lighthouserc.cjs`/`lighthouse-config.test.ts`)

### Task 5: Verify acceptance criteria

- [ ] все 4 категории и их пороги/severity заданы в `lighthouserc.cjs` и покрыты `lighthouse-config.test.ts`
- [ ] `.github/workflows/lighthouse.yml` реально фейлит PR (через финальный `exit 1`-шаг) при просадке любой `error`-категории
- [ ] PR-бот реализован — комментарий со ссылками на отчёты и assertion-результатами, обновляется, а не дублируется, с осмысленным фолбэком при пустых outputs
- [ ] `make lighthouse` работает локально, не публикует отчёты наружу (`--upload.target=filesystem`), `.lighthouseci/` в `.gitignore`
- [ ] `make check` (`format-check lint build`), `make test`, `make knip` — всё зелёное
- [ ] E2E не трогали — `make e2e` не запускать в рамках этой задачи

### Task 6: [Final] Документация

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `plans/roadmap.md`

- [ ] добавить в `AGENTS.md` раздел «Lighthouse CI» по образцу существующих подразделов Phase 2.5 — зафиксировать: `.cjs` vs `lighthouserc.json` и почему (WHY-комментарии, прецедент `knip.jsonc`), отсутствие `collect.url`/`collect.startServerCommand` в общем конфиге, `preset: 'desktop'`, `categories:performance: 'warn'` как временное решение (условие перехода в `error` — required-check promotion), `numberOfRuns: 1`, `is-crawlable`-исключение и его причина (Vercel `X-Robots-Tag: noindex` на preview), `/movie/666` как живая, но не гарантированно вечная запись, `pnpm dlx @lhci/cli` вместо devDependency и почему, фактические числа базлайна из Task 3/Task 4
- [ ] добавить `make lighthouse` в Commands-блок AGENTS.md и в README.md (там, где перечислены `make e2e`/`make knip`/остальные таргеты)
- [ ] попутно поправить описание `make check` в обоих файлах на «lint + build» → фактическое «format-check + lint + build» (расхождение обнаружено при discovery этого плана, не связано с Lighthouse напрямую, но раз уже редактируем оба файла — исправить)
- [ ] отметить пункт 2.5.6 в `plans/roadmap.md` как выполненный (`[x]`), с пометкой отклонений (`.cjs` вместо `.js`, лейбл вместо авто-триггера, фиксированный `/movie/666`, `desktop`-preset, `performance: warn` на период soak)
- [ ] завести на GitHub лейбл `run-lighthouse` (аналогично `run-e2e`)
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка** (обязательна, без неё Task 6 не закрыт):

- реальный прогон workflow на живом PR с лейблом `run-lighthouse` (уже сделан один раз в Task 4 ради базлайна — здесь финальное подтверждение, что комментарий обновляется корректно при повторном прогоне на том же PR)

**Известные ограничения / осознанно принятые компромиссы:**

- **Dependabot/чужие PR с лейблом `run-lighthouse` будут таймаутиться на шаге ожидания preview** — `vercel.json`'s `ignoreCommand` не создаёт деплой для коммитов не от `olegdenisov`. Тот же прецедент, что у `e2e.yml`.
- **`numberOfRuns: 1`** — экономия квоты ценой статистической стабильности. Пересмотреть, если квота перестанет быть узким местом.
- **`categories:performance: 'warn'`, не `'error'`** — временно, до перевода `lighthouse`-job'а в required check (см. следующий пункт); момент перехода — одновременное действие, не забыть про оба при промоушене.
- **`preset: 'desktop'`** — стабильность на shared CI-раннере важнее буквального mobile-скора.
- **`/movie/666` может однажды пропасть из каталога** — тогда гейт начнёт тихо измерять `ErrorState`-страницу вместо приложения. Принято как риск с низкой вероятностью ради простоты (без доп. контент-проверки); если проявится — заменить на другой стабильный id.
- **`temporaryPublicStorage: true` только в CI, не локально** — отчёты (скриншоты, сетевые запросы, сам preview-URL) уезжают в публичное хранилище по ссылке. Приемлемо для portfolio-проекта без чувствительных данных на этих страницах (тот же уровень риска, что уже принят для инлайненного `VITE_API_KEY`), но не «бесплатно» — при необходимости переключить на `uploadArtifacts`-only.
- **Версии Lighthouse в CI и локально могут расходиться** — `treosh/lighthouse-ci-action` вендорит свою версию, локальный `pnpm dlx @lhci/cli@<pinned-version>` — свою, независимую.
- **Required branch-protection check** — как и `e2e`-job, `lighthouse`-job не подключается как обязательная проверка сразу; нужно сначала понаблюдать стабильность на нескольких реальных PR.
- **Пункт 2.5.7 (Telemetry-дашборд)** — не в рамках этого плана.
