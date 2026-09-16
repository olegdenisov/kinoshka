import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

// Прецедент vercel-headers.test.ts: этот тест не выводит числа из независимого источника
// (в отличие от того теста, пересчитывающего SHA-256 из index.html), а хардкодит те же
// пороги, что и сам конфиг — он ловит «забыли обновить тест при правке конфига», не «порог
// сам по себе неверный» (см. план, Testing Strategy).
// Task 4 добавило SEO per-audit ассерты — часть значений теперь плоская строка
// ('error'), не только [severity, options]-кортеж (см. Technical Details).
type LighthouseAssertions = Record<
  string,
  string | [string, Record<string, unknown>]
>
type LighthouseRc = {
  ci: {
    collect: {
      numberOfRuns: number
      settings: { preset: string }
    }
    assert: { assertions: LighthouseAssertions }
  }
}

// import() строкового пути к .cjs не резолвится tsc -b (tsconfig.node.json без allowJs,
// moduleResolution: "bundler" требует деклараций типов) — createRequire обходит это, так
// как TS не резолвит модуль по строке, переданной в рантайм-вызов require(). NodeRequire's
// call signature возвращает `any` неявно (не литеральная аннотация — .oxlintrc.json's
// no-explicit-any бьёт по написанному `: any`, не по выведенному типу), поверх — локальный
// LighthouseRc и as-каст.
const require = createRequire(import.meta.url)
const lighthouserc = require('./lighthouserc.cjs') as LighthouseRc

// Категорийные ассерты (categories:*) всегда [severity, options] в этом конфиге,
// в отличие от плоских per-audit SEO-ассертов ('error' без options) — этот хелпер
// сужает union-тип LighthouseAssertions[string] обратно к кортежу в местах, где
// это заведомо так.
const asCategoryAssertion = (assertion: LighthouseAssertions[string]) =>
  assertion as [string, Record<string, unknown>]

describe('lighthouserc.cjs', () => {
  it('preset: "desktop" — ключевое антифлейк-решение, случайное удаление не должно проходить незамеченным', () => {
    expect(lighthouserc.ci.collect.settings.preset).toBe('desktop')
  })

  it('numberOfRuns — целое число ≥ 1', () => {
    const { numberOfRuns } = lighthouserc.ci.collect
    expect(Number.isInteger(numberOfRuns)).toBe(true)
    expect(numberOfRuns).toBeGreaterThanOrEqual(1)
  })

  it('categories:performance — warn (временно, см. Post-Completion), с порогом 0.9', () => {
    const [severity, options] = asCategoryAssertion(
      lighthouserc.ci.assert.assertions['categories:performance'],
    )
    expect(severity).toBe('warn')
    expect(options.minScore).toBe(0.9)
  })

  it('categories:accessibility — error, с порогом 0.95', () => {
    const [severity, options] = asCategoryAssertion(
      lighthouserc.ci.assert.assertions['categories:accessibility'],
    )
    expect(severity).toBe('error')
    expect(options.minScore).toBe(0.95)
  })

  it('categories:best-practices — error, с порогом 0.9', () => {
    const [severity, options] = asCategoryAssertion(
      lighthouserc.ci.assert.assertions['categories:best-practices'],
    )
    expect(severity).toBe('error')
    expect(options.minScore).toBe(0.9)
  })

  it('нет categories:seo — заменён набором per-audit ассертов (Task 4), т.к. категорийный порог несовместим с гарантированным провалом is-crawlable на Vercel preview', () => {
    expect(lighthouserc.ci.assert.assertions['categories:seo']).toBeUndefined()
  })

  it.each([
    'document-title',
    'meta-description',
    'http-status-code',
    'link-text',
    'crawlable-anchors',
    'robots-txt',
    'canonical',
    'viewport',
  ])('SEO-аудит %s — error (per-audit замена categories:seo)', audit => {
    expect(lighthouserc.ci.assert.assertions[audit]).toBe('error')
  })

  it('is-crawlable — явно off (единственный платформенный false positive на Vercel preview, X-Robots-Tag: noindex)', () => {
    const assertion = lighthouserc.ci.assert.assertions['is-crawlable']
    expect(Array.isArray(assertion)).toBe(true)
    const [severity] = asCategoryAssertion(assertion)
    expect(severity).toBe('off')
  })
})
