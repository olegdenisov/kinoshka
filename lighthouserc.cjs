// @lhci/cli конфиг для Lighthouse CI (roadmap 2.5.6). `.cjs`, а не `lighthouserc.json` —
// JSON не может нести inline WHY-комментарии к каждому порогу/решению (квота, preset,
// is-crawlable-исключение); тот же выбор уже сделан для knip.jsonc vs knip.json (см.
// AGENTS.md, 2.5.3). `.cjs`, а не `lighthouserc.js` — package.json имеет "type": "module",
// а @lhci/cli грузит конфиг через require(); .cjs — расширение, которое Node всегда
// трактует как CommonJS независимо от "type", и единственное, которое @lhci/cli сегодня
// реально поддерживает (.mjs/полноценный ESM-конфиг там до сих пор открытый feature request,
// см. GoogleChrome/lighthouse-ci#973).
module.exports = {
  ci: {
    collect: {
      // Квота demo-тарифа Kinopoisk API (200 запросов/сутки, разделяемых с E2E) — без
      // медианы из нескольких прогонов, но в 3 раза меньше нагрузки на живой API за то же
      // покрытие трёх роутов (/, /search, /movie/:id).
      numberOfRuns: 1,
      settings: {
        // mobile-preset с simulated throttling — известный источник флейков на shared
        // CI-раннерах; desktop стабильнее и воспроизводимее для CI-гейта. Не то же самое,
        // что mobile-first вёрстка проекта (см. AGENTS.md, "Responsive pattern") — это
        // профиль аудита, не целевая аудитория.
        preset: 'desktop',
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
        // приложения) плюс явное 'off' на is-crawlable (единственный
        // платформенный false positive). Список сверен построчным чтением
        // установленного lighthouse@12.6.1's core/config/default-config.js
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
        'robots-txt': 'error',
        canonical: 'error',
        hreflang: 'error',
        'is-crawlable': ['off', {}],
      },
    },
  },
}
