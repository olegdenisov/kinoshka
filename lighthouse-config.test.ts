import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

// Прецедент vercel-headers.test.ts: этот тест не выводит числа из независимого источника
// (в отличие от того теста, пересчитывающего SHA-256 из index.html), а хардкодит те же
// пороги, что и сам конфиг — он ловит «забыли обновить тест при правке конфига», не «порог
// сам по себе неверный» (см. план, Testing Strategy).
type LighthouseAssertions = Record<string, [string, Record<string, unknown>]>
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
    const [severity, options] =
      lighthouserc.ci.assert.assertions['categories:performance']
    expect(severity).toBe('warn')
    expect(options.minScore).toBe(0.9)
  })

  it('categories:accessibility — error, с порогом 0.95', () => {
    const [severity, options] =
      lighthouserc.ci.assert.assertions['categories:accessibility']
    expect(severity).toBe('error')
    expect(options.minScore).toBe(0.95)
  })

  it('categories:best-practices — error, с порогом 0.9', () => {
    const [severity, options] =
      lighthouserc.ci.assert.assertions['categories:best-practices']
    expect(severity).toBe('error')
    expect(options.minScore).toBe(0.9)
  })

  it('нет categories:seo — заводится в Task 4 как набор per-audit ассертов, не категория целиком', () => {
    expect(lighthouserc.ci.assert.assertions['categories:seo']).toBeUndefined()
  })
})
