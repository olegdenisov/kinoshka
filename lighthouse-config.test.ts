import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

// Прецедент vercel-headers.test.ts: этот тест не выводит числа из независимого источника
// (в отличие от того теста, пересчитывающего SHA-256 из index.html), а хардкодит те же
// пороги, что и сам конфиг — он ловит «забыли обновить тест при правке конфига», не «порог
// сам по себе неверный» (см. план, Testing Strategy).
// Один плоский тип вместо двух (LighthouseAssertions/LighthouseRc) — минимально необходимая
// типизация для .cjs, загруженного через createRequire (см. ниже); значения ассертов — либо
// плоская строка ('error'/'off', per-audit SEO-замена из Task 4), либо
// [severity, options]-кортеж (категорийные ассерты, см. Technical Details).
type LighthouseRc = {
  ci: {
    collect: { numberOfRuns: number; settings: { preset: string } }
    assert: {
      assertions: Record<string, string | [string, Record<string, unknown>]>
    }
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
// сужает union-тип обратно к кортежу в местах, где это заведомо так.
const asCategoryAssertion = (
  assertion: LighthouseRc['ci']['assert']['assertions'][string],
) => assertion as [string, Record<string, unknown>]

describe('lighthouserc.cjs', () => {
  it('preset: "desktop" — ключевое антифлейк-решение, случайное удаление не должно проходить незамеченным', () => {
    expect(lighthouserc.ci.collect.settings.preset).toBe('desktop')
  })

  it('numberOfRuns — ровно 1 (квота demo-тарифа 200 запросов/сутки, см. Context/Post-Completion)', () => {
    expect(lighthouserc.ci.collect.numberOfRuns).toBe(1)
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
    'canonical',
    'hreflang',
  ])('SEO-аудит %s — error (per-audit замена categories:seo)', audit => {
    expect(lighthouserc.ci.assert.assertions[audit]).toBe('error')
  })

  it('viewport НЕ ассертится здесь — это не SEO-аудит в lighthouse@12.6.1 (best-practices/performance-diagnostics), уже гейтится через categories:best-practices', () => {
    expect(lighthouserc.ci.assert.assertions.viewport).toBeUndefined()
  })

  it('image-alt НЕ продублирован per-audit-ассертом — тот же аудит уже входит в categories:accessibility (weight 10)', () => {
    expect(lighthouserc.ci.assert.assertions['image-alt']).toBeUndefined()
  })

  it('is-crawlable — явно off (платформенный false positive на Vercel preview, X-Robots-Tag: noindex)', () => {
    const assertion = lighthouserc.ci.assert.assertions['is-crawlable']
    expect(Array.isArray(assertion)).toBe(true)
    const [severity] = asCategoryAssertion(assertion)
    expect(severity).toBe('off')
  })

  it("robots-txt — явно off (второй платформенный false positive: CDP Network.loadNetworkResource не подмешивает extraHeaders, найдено на реальном прогоне против Deployment-Protection'ного preview)", () => {
    const assertion = lighthouserc.ci.assert.assertions['robots-txt']
    expect(Array.isArray(assertion)).toBe(true)
    const [severity] = asCategoryAssertion(assertion)
    expect(severity).toBe('off')
  })

  // AGENTS.md (Profile → Avatar contrast) ссылается на Lighthouse как на реальное покрытие /profile
  // для всего, кроме аватара; без утверждения ниже /profile могли бы тихо убрать из обоих списков.
  it.each([
    ['.github/workflows/lighthouse.yml', '/profile'],
    ['Makefile', 'localhost:4173/profile'],
  ])('%s аудитирует /profile', (file, needle) => {
    expect(readFileSync(file, 'utf-8')).toContain(needle)
  })
})
