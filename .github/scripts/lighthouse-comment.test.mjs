// Vitest подхватывает .test.mjs (configDefaults.include's '?(c|m)[jt]s?(x)' matches
// both 'cjs'/'mjs' extensions — см. vite.config.ts's test.exclude). .mjs, а не .cjs — сам
// Vitest поставляется как ESM-only пакет и не резолвится через require('vitest') из
// CommonJS-модуля (проверено реальным прогоном: "Vitest cannot be imported in a CommonJS
// module using require()"). Именованный import из lighthouse-comment.cjs работает через
// Node's CJS/ESM-интероп (cjs-module-lexer статически распознаёт
// `module.exports = { a, b, c }`-паттерн как именованные экспорты).
import { describe, expect, it } from 'vitest'

import {
  MARKER,
  buildCommentBody,
  findStickyComment,
} from './lighthouse-comment.cjs'

describe('buildCommentBody', () => {
  it('явный fallback-текст, если И links, И results пустые (lhci не дошёл до assertion — 401/сетевая ошибка/Wait-шаг упал раньше)', () => {
    const body = buildCommentBody({ links: null, results: null })
    expect(body).toContain(MARKER)
    expect(body).toContain('Lighthouse run failed before assertions ran')
    expect(body).not.toContain('###')
  })

  it('только секция Reports, если links есть, а results нет (assertion ещё не посчитаны)', () => {
    const body = buildCommentBody({
      links: {
        'https://example.com/': 'https://storage.example/report.html',
      },
      results: null,
    })
    expect(body).toContain('### Reports')
    expect(body).toContain(
      '- [https://example.com/](https://storage.example/report.html)',
    )
  })

  it('явно сообщает, что assertions не завершились, когда results === null, но links заполнен (assert упал после успешного collect/upload)', () => {
    // Отличие от кейса "И links, И results пустые" выше: тут links реально
    // пришёл (collect/upload прошли), а отдельный процесс assert упал/не
    // сохранил assertion-results.json — treosh/lighthouse-ci-action не
    // делает status-check на этот шаг. Раньше это ошибочно рендерилось как
    // "All assertions passed." — здесь проверяем, что теперь это другой,
    // явный текст.
    const body = buildCommentBody({
      links: {
        'https://example.com/': 'https://storage.example/report.html',
      },
      results: null,
    })
    expect(body).toContain(
      'Assertions did not complete — check the Lighthouse CI job logs.',
    )
    expect(body).not.toContain('All assertions passed.')
  })

  it('текст "All assertions passed.", если results — пустой массив (а не null) — отличимо от results === null', () => {
    const body = buildCommentBody({
      links: {
        'https://example.com/': 'https://storage.example/report.html',
      },
      results: [],
    })
    expect(body).toContain('All assertions passed.')
    expect(body).not.toContain(
      'Assertions did not complete — check the Lighthouse CI job logs.',
    )
    expect(body).not.toContain('### Blocking')
    expect(body).not.toContain('### Warnings')
  })

  // auditId:'categories'/auditProperty:'<name>' (не составная строка
  // 'categories:accessibility') — реальная форма результата от
  // @lhci/utils@0.15.1 для category-level assertion'ов (единственный вид
  // assertion'ов, реально сконфигурированный в lighthouserc.cjs для
  // performance/accessibility/best-practices): resolveAssertionOptionsAndLhrs
  // сплитит ключ 'categories:accessibility' по /\.|:/ на auditId='categories'
  // + rest=['accessibility'], а getCategoryAssertionResults затем кладёт
  // categoryId именно в auditProperty (проверено чтением
  // node_modules-кэша @lhci/utils/src/assertions.js, найдено code review).

  it('раздел "### Blocking" с колонкой Level для error-уровня результатов', () => {
    const body = buildCommentBody({
      links: null,
      results: [
        {
          url: 'https://example.com/',
          auditId: 'categories',
          auditProperty: 'accessibility',
          operator: '>=',
          expected: 0.95,
          actual: 0.87,
          level: 'error',
        },
      ],
    })
    expect(body).toContain('### Blocking')
    expect(body).toContain('| URL | Audit | Level | Expected | Actual |')
    expect(body).toContain(
      '| https://example.com/ | accessibility | error | >= 0.95 | 0.87 |',
    )
    expect(body).not.toContain('### Warnings')
  })

  it('раздел "### Warnings" (не "### Blocking") для warn-уровня результатов — напр. временный categories:performance warn', () => {
    const body = buildCommentBody({
      links: null,
      results: [
        {
          url: 'https://example.com/',
          auditId: 'categories',
          auditProperty: 'performance',
          operator: '>=',
          expected: 0.9,
          actual: 0.72,
          level: 'warn',
        },
      ],
    })
    expect(body).toContain('### Warnings')
    expect(body).toContain(
      '| https://example.com/ | performance | warn | >= 0.9 | 0.72 |',
    )
    expect(body).not.toContain('### Blocking')
  })

  it('делит смешанные error/warn результаты на отдельные разделы "### Blocking" и "### Warnings", level виден в каждой строке', () => {
    const body = buildCommentBody({
      links: null,
      results: [
        {
          url: 'https://example.com/',
          auditId: 'categories',
          auditProperty: 'accessibility',
          operator: '>=',
          expected: 0.95,
          actual: 0.87,
          level: 'error',
        },
        {
          url: 'https://example.com/',
          auditId: 'categories',
          auditProperty: 'performance',
          operator: '>=',
          expected: 0.9,
          actual: 0.72,
          level: 'warn',
        },
      ],
    })
    const blockingIndex = body.indexOf('### Blocking')
    const warningsIndex = body.indexOf('### Warnings')
    expect(blockingIndex).toBeGreaterThan(-1)
    expect(warningsIndex).toBeGreaterThan(blockingIndex)
    expect(body).toContain(
      '| https://example.com/ | accessibility | error | >= 0.95 | 0.87 |',
    )
    expect(body).toContain(
      '| https://example.com/ | performance | warn | >= 0.9 | 0.72 |',
    )
  })

  it('рендерит auditProperty ("best-practices" из categories:best-practices), не составной auditId', () => {
    const body = buildCommentBody({
      links: null,
      results: [
        {
          url: 'https://example.com/',
          auditId: 'categories',
          auditProperty: 'best-practices',
          operator: '>=',
          expected: 0.9,
          actual: 0.83,
          level: 'error',
        },
      ],
    })
    expect(body).toContain(
      '| https://example.com/ | best-practices | error | >= 0.9 | 0.83 |',
    )
    expect(body).not.toContain('categories:best-practices')
  })

  it('падает обратно на auditId, когда auditProperty не задан (per-audit assertion, напр. document-title)', () => {
    const body = buildCommentBody({
      links: null,
      results: [
        {
          url: 'https://example.com/',
          auditId: 'document-title',
          operator: '==',
          expected: true,
          actual: false,
          level: 'error',
        },
      ],
    })
    expect(body).toContain(
      '| https://example.com/ | document-title | error | == true | false |',
    )
  })

  it('экранирует "|" и переносы строк в ячейках, чтобы значение не разъехало markdown-таблицу', () => {
    // Сегодня в ячейки попадают только числа и id аудитов, но url/actual
    // приходят из assertionResults (а значит — из аудируемой страницы и её
    // URL), ничем от '|' и '\n' не защищённых: одна такая ячейка ломает
    // разметку всей таблицы в PR-комментарии (найдено code review).
    const body = buildCommentBody({
      links: null,
      results: [
        {
          url: 'https://example.com/?a=1|b=2',
          auditId: 'link-text',
          operator: '==',
          expected: true,
          actual: 'Click here\nRead | more\r\nand again',
          level: 'error',
        },
      ],
    })

    // Ровно одна строка данных: перенос строки не должен был породить вторую.
    const dataRows = body
      .split('\n')
      .filter(line => line.startsWith('| https://example.com/'))
    expect(dataRows).toHaveLength(1)
    expect(dataRows[0]).toBe(
      '| https://example.com/?a=1\\|b=2 | link-text | error | == true | Click here<br>Read \\| more<br>and again |',
    )
    // CRLF не даёт двойной <br>.
    expect(body).not.toContain('<br><br>')
  })

  it('экранирует обратный слеш перед "|" раньше самого "|" (CodeQL: incomplete string escaping)', () => {
    // Если сначала экранировать только '|' (без обратного слеша), значение
    // '\|' превратилось бы в '\\|' — в markdown это читается как
    // экранированный '\', за которым снова следует НЕэкранированный '|',
    // то есть таблица разъезжается ровно тем способом, который эта функция
    // должна была починить.
    const body = buildCommentBody({
      links: null,
      results: [
        {
          url: 'https://example.com/',
          auditId: 'link-text',
          operator: '==',
          expected: true,
          actual: 'a\\|b',
          level: 'error',
        },
      ],
    })

    const dataRows = body
      .split('\n')
      .filter(line => line.startsWith('| https://example.com/'))
    expect(dataRows).toHaveLength(1)
    expect(dataRows[0]).toBe(
      '| https://example.com/ | link-text | error | == true | a\\\\\\|b |',
    )
  })
})

describe('findStickyComment', () => {
  it('находит существующий комментарий по маркеру', () => {
    const comments = [
      { id: 1, body: 'какой-то другой комментарий' },
      {
        id: 2,
        body: `${MARKER}\n## Lighthouse CI\n\nAll assertions passed.\n`,
      },
    ]
    expect(findStickyComment(comments)?.id).toBe(2)
  })

  it('возвращает undefined, если маркер не найден ни в одном комментарии', () => {
    const comments = [{ id: 1, body: 'какой-то другой комментарий' }]
    expect(findStickyComment(comments)).toBeUndefined()
  })

  it('не падает на комментарии без body (undefined)', () => {
    const comments = [{ id: 1, body: undefined }]
    expect(() => findStickyComment(comments)).not.toThrow()
    expect(findStickyComment(comments)).toBeUndefined()
  })
})
