// @lhci/cli конфиг для Lighthouse CI (roadmap 2.5.6). `.cjs`, а не `lighthouserc.json` —
// JSON не может нести inline WHY-комментарии к каждому порогу/решению (квота, preset,
// is-crawlable-исключение); тот же выбор уже сделан для knip.jsonc vs knip.json (см.
// AGENTS.md, 2.5.3). `.cjs`, а не `lighthouserc.js` — package.json имеет "type": "module",
// а @lhci/cli грузит конфиг через require(); .cjs — расширение, которое Node всегда
// трактует как CommonJS независимо от "type", и единственное, которое @lhci/cli сегодня
// реально поддерживает (.mjs/полноценный ESM-конфиг там до сих пор открытый feature request,
// см. GoogleChrome/lighthouse-ci#973).

// Vercel Deployment Protection закрывает preview-деплои 401'ым для любого
// анонимного запроса — реальный Chrome, который поднимает
// treosh/lighthouse-ci-action, упирается в ту же стену, что и шаг
// "Wait for Vercel preview" (тот отдельно решает её своим
// vercel_protection_bypass_header, см. .github/workflows/lighthouse.yml).
// Секрет читается из env, а не хардкодится и не навешивается на URL'ы
// query-параметром `?x-vercel-protection-bypass=...`: URL'ы прогона попадают
// в steps.lhci.outputs.links, которые публикуются в открытом PR-комментарии
// (.github/scripts/lighthouse-comment.cjs) — в query-варианте секрет утёк бы
// туда в открытый доступ. Заголовок — единственный способ передать его так,
// чтобы он не оказался в публикуемом артефакте.
//
// Имя заголовка — `x-vercel-protection-bypass` (сверено с документацией
// Vercel "Protection Bypass for Automation" и с исходником
// patrickedqvist/wait-for-vercel-preview@v1.3.3's action.js:65-67, который
// кладёт значение своего input'а ровно в этот заголовок — то есть оба шага
// job'а используют один и тот же секрет и один и тот же заголовок).
// `x-vercel-set-bypass-cookie` намеренно НЕ выставляется: Lighthouse ставит
// extraHeaders через CDP Network.setExtraHTTPHeaders, то есть заголовок уходит
// со ВСЕМИ запросами страницы (включая сабресурсы), cookie-механика не нужна,
// а её редирект с Set-Cookie добавил бы лишний хоп в измеряемый FCP/LCP.
//
// Gate по env, а не безусловный заголовок: без секрета (локальный
// `make lighthouse` против vite preview, форк-PR, ещё не заведённый секрет)
// отправлять пустой `x-vercel-protection-bypass: ''` бессмысленно, а на
// незащищённом preview заголовок вообще не нужен.
const vercelProtectionBypass = process.env.VERCEL_PROTECTION_BYPASS

module.exports = {
  ci: {
    collect: {
      // Квота demo-тарифа Kinopoisk API (200 запросов/сутки, разделяемых с E2E) — без
      // медианы из нескольких прогонов, но в разы меньше нагрузки на живой API за то же
      // покрытие четырёх роутов (/, /search, /movie/:id, /profile). /profile не добавляет
      // расхода квоты вовсе: страница обращается только к localStorage-хукам
      // (useProfile()/useFavorites()/useTheme()), без единого запроса к API.
      numberOfRuns: 1,
      settings: {
        // mobile-preset с simulated throttling — известный источник флейков на shared
        // CI-раннерах; desktop стабильнее и воспроизводимее для CI-гейта. Не то же самое,
        // что mobile-first вёрстка проекта (см. AGENTS.md, "Responsive pattern") — это
        // профиль аудита, не целевая аудитория.
        preset: 'desktop',
        // Спред, а не безусловный ключ — см. WHY-блок про
        // VERCEL_PROTECTION_BYPASS над module.exports. Объект (а не JSON-строка)
        // здесь корректен: @lhci/cli сериализует collect.settings в temp-файл и
        // передаёт его Lighthouse через --cli-flags-path (node-runner.js), а
        // coerceExtraHeaders в lighthouse@12's cli/cli-flags.js на `typeof
        // value === 'object'` возвращает значение как есть, без парсинга.
        ...(vercelProtectionBypass
          ? {
              extraHeaders: {
                'x-vercel-protection-bypass': vercelProtectionBypass,
              },
            }
          : {}),
      },
    },
    assert: {
      assertions: {
        // Временно 'warn', не 'error' — единственный прогон (numberOfRuns: 1) живой
        // CSR-страницы на shared CI-раннере даёт статистически шумный Performance-скор;
        // жёсткий error-гейт без медианы из нескольких прогонов будет чаще ловить шум
        // раннера, чем реальные регрессии. Поднять до 'error' одновременно с переводом
        // lighthouse-job'а в required check (см. план, Post-Completion).
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        // Нет 'categories:seo' — намеренно. Vercel помечает preview-деплои
        // X-Robots-Tag: noindex (подтверждено ревью #2/#3 как задокументированное
        // платформенное поведение, см. план Task 4), что гарантированно валит
        // Lighthouse-аудит is-crawlable (часть категории SEO) на любом preview
        // независимо от контента страницы. Категорийный 'categories:seo':
        // ['error', {minScore: 0.95}] здесь не работает даже с 'is-crawlable':
        // ['off', {}] рядом — LHCI-ассерт на конкретный аудит выключает только
        // ПРОВЕРКУ этого аудита, а не пересчитывает сам categories.seo.score,
        // который Lighthouse считает внутри себя по весам всех аудитов категории
        // (включая проваленный is-crawlable с нулём) — агрегат всё равно не
        // дотянет до 0.95. Замена — явные per-audit ассерты по остальным
        // взвешенным SEO-аудитам категории (всё, что реально зависит от
        // приложения) плюс явное 'off' на is-crawlable/robots-txt (два
        // платформенных false positive, см. ниже). Список сверен построчным
        // чтением установленного lighthouse@12.6.1's core/config/default-config.js
        // (categories.seo.auditRefs), а не по памяти:
        //   is-crawlable (weight 93/23), document-title (1), meta-description (1),
        //   http-status-code (1), link-text (1), crawlable-anchors (1),
        //   robots-txt (1), image-alt (1), hreflang (1), canonical (1),
        //   structured-data (weight 0, manual-only — не гейтится).
        // 'hreflang' — реальный взвешенный SEO-аудит (weight 1); был пропущен в
        // ревизии #3, восполнено (обнаружено code review). 'image-alt' — тоже
        // взвешенный SEO-аудит (weight 1), но НЕ продублирован здесь: тот же
        // аудит входит и в категорию accessibility с weight 10 (см. default-config.js),
        // уже гейтится через 'categories:accessibility': error/0.95 выше — отдельный
        // per-audit assert не добавляет реальной защиты. 'viewport' сюда
        // намеренно НЕ включён (в отличие от более ранней ревизии) — по факту
        // это не аудит категории SEO вовсе: в lighthouse@12.6.1 viewport числится
        // только в best-practices (weight 1) и в performance-diagnostics
        // (weight 0), уже гейтится через 'categories:best-practices': error/0.9.
        'document-title': 'error',
        'meta-description': 'error',
        'http-status-code': 'error',
        'link-text': 'error',
        'crawlable-anchors': 'error',
        canonical: 'error',
        hreflang: 'error',
        'is-crawlable': ['off', {}],
        // 'robots-txt' тоже 'off' — второй платформенный false positive,
        // найден на реальном прогоне против Deployment-Protection'ного preview
        // (job 35452468428, все 3 URL, actual: 0). Причина другая, чем у
        // is-crawlable, но тот же класс проблемы: сам public/robots.txt валиден
        // ("User-agent: *\nAllow: /"), но lighthouse's robots-txt-гатерер
        // (core/gather/gatherers/seo/robots-txt.js) фетчит файл НЕ через обычную
        // навигацию, где действует наш extraHeaders/x-vercel-protection-bypass
        // (см. WHY-блок про VERCEL_PROTECTION_BYPASS выше) — он идёт через
        // Fetcher._fetchResourceOverProtocol → CDP Network.loadNetworkResource
        // (core/gather/fetcher.js), которая НЕ подмешивает
        // Network.setExtraHTTPHeaders. На защищённом preview этот запрос ловит
        // 302 на Vercel SSO (проверено вручную: curl -i .../robots.txt без
        // bypass-заголовка), а не содержимое файла. Явное 'off', а не
        // ['error', {minScore: 0.9}] с надеждой на будущий фикс — то же решение,
        // что уже принято для is-crawlable.
        'robots-txt': ['off', {}],
      },
    },
  },
}
