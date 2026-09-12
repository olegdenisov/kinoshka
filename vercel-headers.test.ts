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

// Бросает понятную ошибку вместо невнятного `undefined`, если правило/заголовок отсутствует —
// покрыто отдельным edge-case тестом ниже (намеренно испорченный/неполный vercel.json).
function getHeaderRule(config: VercelConfig, source: string): VercelHeaderRule {
  const rule = config.headers?.find(r => r.source === source)
  if (!rule) {
    throw new Error(
      `vercel.json: правило headers с source "${source}" не найдено (доступные source: ${
        config.headers?.map(r => r.source).join(', ') ?? '—'
      })`,
    )
  }
  return rule
}

function getHeaderValue(rule: VercelHeaderRule, key: string): string {
  const entry = rule.headers.find(h => h.key === key)
  if (!entry) {
    throw new Error(
      `vercel.json: заголовок "${key}" не найден среди [${rule.headers.map(h => h.key).join(', ')}]`,
    )
  }
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

const config = readVercelConfig()
const rule = getHeaderRule(config, '/(.*)')
const csp = getHeaderValue(rule, 'Content-Security-Policy-Report-Only')
const directives = parseCspDirectives(csp)

describe('vercel.json — Content-Security-Policy-Report-Only', () => {
  it('default-src ограничен self', () => {
    expect(getDirective(directives, 'default-src')).toEqual(new Set(["'self'"]))
  })

  it('script-src содержит self/hash/plausible и не содержит unsafe-inline', () => {
    const scriptSrc = getDirective(directives, 'script-src')
    expect(scriptSrc.has("'self'")).toBe(true)
    expect(scriptSrc.has('https://plausible.io')).toBe(true)
    expect([...scriptSrc].some(v => v.startsWith("'sha256-"))).toBe(true)
    expect(scriptSrc.has("'unsafe-inline'")).toBe(false)
  })

  it('style-src содержит self/unsafe-inline/fonts.googleapis.com', () => {
    const styleSrc = getDirective(directives, 'style-src')
    expect(styleSrc).toEqual(
      new Set(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']),
    )
  })

  it('font-src — self + fonts.gstatic.com', () => {
    expect(getDirective(directives, 'font-src')).toEqual(
      new Set(["'self'", 'https://fonts.gstatic.com']),
    )
  })

  it('img-src — self + avatars.mds.yandex.net + st.kp.yandex.net (без image.tmdb.org)', () => {
    expect(getDirective(directives, 'img-src')).toEqual(
      new Set([
        "'self'",
        'https://avatars.mds.yandex.net',
        'https://st.kp.yandex.net',
      ]),
    )
  })

  it('connect-src содержит self/api/plausible/sentry-ingest', () => {
    const connectSrc = getDirective(directives, 'connect-src')
    expect(connectSrc.has("'self'")).toBe(true)
    expect(connectSrc.has('https://api.poiskkino.dev')).toBe(true)
    expect(connectSrc.has('https://plausible.io')).toBe(true)
    expect(
      connectSrc.has('https://o4512052151844864.ingest.us.sentry.io'),
    ).toBe(true)
  })

  it('object-src/base-uri/form-action/frame-ancestors — hardening-директивы', () => {
    expect(getDirective(directives, 'object-src')).toEqual(new Set(["'none'"]))
    expect(getDirective(directives, 'base-uri')).toEqual(new Set(["'self'"]))
    expect(getDirective(directives, 'form-action')).toEqual(new Set(["'self'"]))
    expect(getDirective(directives, 'frame-ancestors')).toEqual(
      new Set(["'none'"]),
    )
  })

  it('report-uri указывает на Sentry security-endpoint с sentry_key', () => {
    const reportUri = getDirective(directives, 'report-uri')
    const [value] = reportUri
    expect(value).toContain('o4512052151844864.ingest.us.sentry.io')
    expect(value).toContain('sentry_key=')
  })

  it('хеш инлайн-скрипта в script-src совпадает с независимо пересчитанным из index.html', () => {
    // Пересчитываем хеш заново из исходного index.html (а не сравниваем с захардкоженной
    // строкой) — так тест сам ловит рассинхрон при будущей правке инлайн-скрипта.
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf-8')
    const scriptTags = [
      ...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g),
    ]
    const inlineScripts = scriptTags.filter(
      ([, attrs]) => !attrs.includes('src='),
    )

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
    expect(getHeaderValue(rule, 'X-Frame-Options')).toBe('DENY')
  })

  it('Referrer-Policy: strict-origin-when-cross-origin', () => {
    expect(getHeaderValue(rule, 'Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    )
  })

  it('X-Content-Type-Options: nosniff', () => {
    expect(getHeaderValue(rule, 'X-Content-Type-Options')).toBe('nosniff')
  })
})

describe('getHeaderRule/getHeaderValue — edge case (испорченный/неполный конфиг)', () => {
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
})
