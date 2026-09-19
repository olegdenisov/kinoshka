'use strict'

// Вынесено из inline-скрипта actions/github-script в lighthouse.yml — тот же
// принцип, что sentry.config.ts/bundle.config.ts (извлечение чистой логики из
// места, которое иначе непроверяемо юнит-тестами; см. AGENTS.md, "Error tracking
// (Sentry)"/"Performance budgets"). Чистые функции ниже покрыты
// lighthouse-comment.test.mjs без мока Octokit; run() — тонкая
// orchestration-обёртка, вызывающая github.rest.issues.*, оставлена непокрытой
// юнит-тестами (потребовала бы мокать весь Octokit-объект — непропорционально
// для этой обёртки).

const MARKER = '<!-- lighthouse-ci-comment -->'

// Экранирует произвольное значение для подстановки в ячейку markdown-таблицы.
// Сегодня в ячейки попадают только числа и id аудитов, но ничто этого не
// гарантирует: url/actual/expected приходят из assertionResults, то есть в
// конечном счёте из аудируемой страницы и её URL — одна '|' или перенос
// строки разъезжают всю таблицу в PR-комментарии (найдено code review).
// '|' → '\|' (GFM-escape внутри ячейки), перевод строки → '<br>' (ячейка
// markdown-таблицы не может содержать реальный \n — он завершает строку
// таблицы), '\r' выкидывается, чтобы CRLF не давал двойной <br>.
function escapeTableCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br>')
}

// Рендерит один markdown-раздел таблицы assertion-результатов под данным
// заголовком (используется отдельно для error- и warn-уровня — см. buildCommentBody).
function renderResultsTable(heading, rows) {
  let section = `### ${heading}\n\n`
  section += '| URL | Audit | Level | Expected | Actual |\n'
  section += '| --- | --- | --- | --- | --- |\n'
  for (const r of rows) {
    const url = escapeTableCell(r.url)
    const audit = escapeTableCell(r.auditProperty ?? r.auditId)
    const level = escapeTableCell(r.level)
    // operator и expected склеиваются в одну ячейку, но экранируются
    // по отдельности — иначе пробел между ними тоже прошёл бы через
    // String(), а склейка уже экранированных частей безопасна.
    const expected = `${escapeTableCell(r.operator)} ${escapeTableCell(r.expected)}`
    const actual = escapeTableCell(r.actual)
    section += `| ${url} | ${audit} | ${level} | ${expected} | ${actual} |\n`
  }
  section += '\n'
  return section
}

// Собирает markdown-тело PR-комментария из output'ов lhci-шага (links/results).
function buildCommentBody({ links, results }) {
  let body = `${MARKER}\n## Lighthouse CI\n\n`

  if (!links && results === null) {
    // lhci упал ещё на сборе данных (например 401 от Deployment Protection,
    // сетевая ошибка ожидания preview, либо предыдущий шаг Wait for Vercel
    // preview сам упал и lhci вообще не запустился) — а не на assertion'ах.
    // Пустая таблица тут была бы вводящей в заблуждение — явно говорим, что
    // прогон не дошёл до сравнения с порогами.
    body +=
      'Lighthouse run failed before assertions ran (no report links or assertion results were produced). Check the job logs for details.\n'
    return body
  }

  if (links) {
    body += '### Reports\n\n'
    for (const [url, link] of Object.entries(links)) {
      body += `- [${url}](${link})\n`
    }
    body += '\n'
  }

  if (results === null) {
    // Отличие от кейса выше: links мог успеть заполниться (collect/upload
    // прошли), но отдельный процесс assert либо упал, либо не сохранил
    // assertion-results.json — treosh/lighthouse-ci-action's src/index.js не
    // делает status-check для этого шага, в отличие от collect/upload.
    // Раньше это молча рендерилось как "All assertions passed." — то есть
    // "assertions не запускались" неотличимо от "assertions прошли чисто".
    body += 'Assertions did not complete — check the Lighthouse CI job logs.\n'
  } else if (results.length > 0) {
    // level ('error'/'warn') приходит прямо из @lhci/utils'а
    // assertionResults (см. lighthouserc.cjs's temporary
    // 'categories:performance': 'warn') — без разделения warn-провал
    // (некритичный, не валит exit code) выглядел бы в таблице неотличимо
    // от error-провала (блокирующего). Делим на два раздела вместо одной
    // общей таблицы с колонкой Level, чтобы "заблокировано" читалось с
    // первого взгляда, не построчным сравнением.
    const errors = results.filter(r => r.level === 'error')
    const warnings = results.filter(r => r.level !== 'error')

    if (errors.length > 0) {
      body += renderResultsTable('Blocking', errors)
    }
    if (warnings.length > 0) {
      body += renderResultsTable('Warnings', warnings)
    }
  } else {
    body += 'All assertions passed.\n'
  }

  return body
}

// Находит существующий sticky-комментарий по маркеру среди уже полученных
// комментариев PR — обновлять его вместо создания нового при повторных прогонах.
function findStickyComment(comments, marker = MARKER) {
  return comments.find(c => c.body?.includes(marker))
}

// Тонкая orchestration-обёртка для actions/github-script: читает outputs
// lhci-шага из env, строит тело через buildCommentBody, ищет/обновляет/создаёт
// sticky-комментарий через findStickyComment. Вызывается из lighthouse.yml как
// `require('./lighthouse-comment.cjs').run({ github, context })`.
async function run({ github, context }) {
  const links = process.env.LHCI_LINKS
    ? JSON.parse(process.env.LHCI_LINKS)
    : null
  const results = process.env.LHCI_ASSERTION_RESULTS
    ? JSON.parse(process.env.LHCI_ASSERTION_RESULTS)
    : null

  const body = buildCommentBody({ links, results })

  // github.paginate, а не один вызов listComments (у Octokit по умолчанию
  // per_page=30, одна страница) — на PR, накопившем 30+ комментариев за время
  // жизни, sticky-комментарий мог оказаться на второй+ странице, и
  // findStickyComment по одной странице тихо не находил бы его, создавая
  // дубликат вместо обновления на месте (найдено code review).
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  })

  const existing = findStickyComment(comments)

  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    })
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body,
    })
  }
}

module.exports = { MARKER, buildCommentBody, findStickyComment, run }
