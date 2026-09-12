import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

type VercelHeaderEntry = { key: string; value: string }
type VercelHeaderRule = { source: string; headers: VercelHeaderEntry[] }
type VercelConfig = { headers?: VercelHeaderRule[] }

const ROOT = __dirname

// vercel.json — единственный источник истины для CSP + security-заголовков (см. AGENTS.md,
// "CSP headers + security headers"). Этот тест не дублирует его содержимое во втором
// конфиг-файле, а парсит и проверяет уже написанный vercel.json напрямую.
function readVercelConfig(): VercelConfig {
  const raw = readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8')
  return JSON.parse(raw) as VercelConfig
}

// Единственный generic find-or-throw хелпер вместо трёх почти идентичных — бросает понятную
// ошибку вместо невнятного `undefined`, если правило/заголовок/директива отсутствует.
// Покрыто edge-case тестами ниже (намеренно испорченный/неполный vercel.json, отсутствующая
// директива).
function findOrThrow<T>(
  collection: T[],
  predicate: (item: T) => boolean,
  label: string,
  available: string[],
): T {
  const found = collection.find(predicate)
  if (!found) {
    throw new Error(`${label} (доступно: [${available.join(', ')}])`)
  }
  return found
}

function getHeaderRule(config: VercelConfig, source: string): VercelHeaderRule {
  const headers = config.headers ?? []
  return findOrThrow(
    headers,
    r => r.source === source,
    `vercel.json: правило headers с source "${source}" не найдено`,
    headers.map(r => r.source),
  )
}

function getHeaderValue(rule: VercelHeaderRule, key: string): string {
  const entry = findOrThrow(
    rule.headers,
    h => h.key === key,
    `vercel.json: заголовок "${key}" не найден`,
    rule.headers.map(h => h.key),
  )
  return entry.value
}

// CSP-строка — директивы через '; ', каждая директива — имя + значения через пробел.
function parseCspDirectives(csp: string): Map<string, Set<string>> {
  const directives = new Map<string, Set<string>>()
  for (const part of csp.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [name, ...values] = trimmed.split(/\s+/)
    directives.set(name, new Set(values))
  }
  return directives
}

function getDirective(
  directives: Map<string, Set<string>>,
  name: string,
): Set<string> {
  const values = directives.get(name)
  if (!values) {
    throw new Error(
      `CSP: директива "${name}" не найдена среди [${[...directives.keys()].join(', ')}]`,
    )
  }
  return values
}

// Читается лениво (не на верхнем уровне модуля) — битый/невалидный vercel.json должен уронить
// конкретный `it`, а не весь test-файл сырой ошибкой парсинга.
function getCsp(): {
  rule: VercelHeaderRule
  directives: Map<string, Set<string>>
} {
  const config = readVercelConfig()
  const rule = getHeaderRule(config, '/(.*)')
  const csp = getHeaderValue(rule, 'Content-Security-Policy-Report-Only')
  return { rule, directives: parseCspDirectives(csp) }
}

describe('vercel.json — Content-Security-Policy-Report-Only', () => {
  it('default-src ограничен self', () => {
    const { directives } = getCsp()
    expect(getDirective(directives, 'default-src')).toEqual(new Set(["'self'"]))
  })

  it('script-src — ровно self/hash/plausible, без unsafe-inline', () => {
    const { directives } = getCsp()
    const scriptSrc = getDirective(directives, 'script-src')
    const hashSource = [...scriptSrc].find(v => v.startsWith("'sha256-"))
    if (!hashSource) {
      throw new Error('script-src: sha256-источник не найден')
    }
    // Точное множество (а не .has()-проверки) — иначе незамеченное добавление постороннего
    // хоста в script-src тест пропустит молча.
    expect(scriptSrc).toEqual(
      new Set(["'self'", hashSource, 'https://plausible.io']),
    )
  })

  it('style-src содержит self/unsafe-inline/fonts.googleapis.com', () => {
    const { directives } = getCsp()
    const styleSrc = getDirective(directives, 'style-src')
    expect(styleSrc).toEqual(
      new Set(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']),
    )
  })

  it('font-src — self + fonts.gstatic.com', () => {
    const { directives } = getCsp()
    expect(getDirective(directives, 'font-src')).toEqual(
      new Set(["'self'", 'https://fonts.gstatic.com']),
    )
  })

  it('img-src — self + avatars.mds.yandex.net + st.kp.yandex.net (без image.tmdb.org)', () => {
    const { directives } = getCsp()
    expect(getDirective(directives, 'img-src')).toEqual(
      new Set([
        "'self'",
        'https://avatars.mds.yandex.net',
        'https://st.kp.yandex.net',
      ]),
    )
  })

  it('connect-src — ровно self/api/plausible/sentry-ingest/fonts (preconnect-хосты)', () => {
    const { directives } = getCsp()
    // Точное множество — fonts.googleapis.com/fonts.gstatic.com обязаны присутствовать здесь
    // тоже: index.html делает <link rel="preconnect"> на оба хоста, а Chromium сверяет
    // resource-hints с connect-src, иначе на каждой загрузке страницы будет CSP violation.
    expect(getDirective(directives, 'connect-src')).toEqual(
      new Set([
        "'self'",
        'https://api.poiskkino.dev',
        'https://plausible.io',
        'https://o4512052151844864.ingest.us.sentry.io',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
      ]),
    )
  })

  it('object-src/base-uri/form-action/frame-ancestors — hardening-директивы', () => {
    const { directives } = getCsp()
    expect(getDirective(directives, 'object-src')).toEqual(new Set(["'none'"]))
    expect(getDirective(directives, 'base-uri')).toEqual(new Set(["'self'"]))
    expect(getDirective(directives, 'form-action')).toEqual(new Set(["'self'"]))
    expect(getDirective(directives, 'frame-ancestors')).toEqual(
      new Set(["'none'"]),
    )
  })

  it('report-uri указывает на Sentry security-endpoint с sentry_key', () => {
    const { directives } = getCsp()
    const reportUri = getDirective(directives, 'report-uri')
    const [value] = reportUri
    expect(value).toContain('o4512052151844864.ingest.us.sentry.io')
    expect(value).toContain('sentry_key=')
  })

  it('хеш инлайн-скрипта в script-src совпадает с независимо пересчитанным из index.html', () => {
    const { directives } = getCsp()
    // Пересчитываем хеш заново из исходного index.html (а не сравниваем с захардкоженной
    // строкой) — так тест сам ловит рассинхрон при будущей правке инлайн-скрипта.
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf-8')
    const scriptTags = [
      ...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g),
    ]
    // `src=` substring check намеренно избегается — ловит и будущий `data-src=`. Инлайн-скрипт
    // определяется отсутствием атрибута `src` как отдельного токена в списке атрибутов тега.
    const inlineScripts = scriptTags.filter(([, attrs]) => {
      const attrNames = [...attrs.matchAll(/([a-zA-Z-]+)\s*=/g)].map(m => m[1])
      return !attrNames.includes('src')
    })

    // Защита от будущего второго инлайн-скрипта, который иначе тест молча пропустит.
    expect(inlineScripts).toHaveLength(1)

    const [, , content] = inlineScripts[0]
    const recomputedHash = createHash('sha256').update(content).digest('base64')
    const expectedSource = `'sha256-${recomputedHash}'`

    const scriptSrc = getDirective(directives, 'script-src')
    const hashSource = [...scriptSrc].find(v => v.startsWith("'sha256-"))
    expect(hashSource).toBe(expectedSource)
  })
})

describe('vercel.json — дополнительные security-заголовки', () => {
  it('X-Frame-Options: DENY', () => {
    const { rule } = getCsp()
    expect(getHeaderValue(rule, 'X-Frame-Options')).toBe('DENY')
  })

  it('Referrer-Policy: strict-origin-when-cross-origin', () => {
    const { rule } = getCsp()
    expect(getHeaderValue(rule, 'Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    )
  })

  it('X-Content-Type-Options: nosniff', () => {
    const { rule } = getCsp()
    expect(getHeaderValue(rule, 'X-Content-Type-Options')).toBe('nosniff')
  })

  it('не отдаёт энфорсящий Content-Security-Policy (только -Report-Only) — soak-период ещё не завершён', () => {
    const { rule } = getCsp()
    expect(rule.headers.some(h => h.key === 'Content-Security-Policy')).toBe(
      false,
    )
  })
})

describe('findOrThrow/getDirective — edge case (испорченный/неполный конфиг)', () => {
  it('getHeaderRule бросает понятную ошибку, если source не найден', () => {
    const broken: VercelConfig = {
      headers: [{ source: '/other', headers: [] }],
    }
    expect(() => getHeaderRule(broken, '/(.*)')).toThrow(
      /source "\/\(\.\*\)" не найдено/,
    )
  })

  it('getHeaderValue бросает понятную ошибку, если заголовок отсутствует', () => {
    const incompleteRule: VercelHeaderRule = {
      source: '/(.*)',
      headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
    }
    expect(() =>
      getHeaderValue(incompleteRule, 'Content-Security-Policy-Report-Only'),
    ).toThrow(/заголовок "Content-Security-Policy-Report-Only" не найден/)
  })

  it('getDirective бросает понятную ошибку, если директива отсутствует в CSP', () => {
    const directives = parseCspDirectives("default-src 'self'")
    expect(() => getDirective(directives, 'script-src')).toThrow(
      /директива "script-src" не найдена/,
    )
  })
})
