import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// Регрессионный тест на WCAG-контраст токенов, найденных и пофикшенных
// Lighthouse a11y (axe color-contrast, severity "serious") на light-теме — см.
// AGENTS.md, "Lighthouse CI". Значения парсятся из самого global.css (тот же
// принцип, что vercel-headers.test.ts's пересчёт SHA-256 из index.html — не
// хардкодить числа во втором месте), а не переносятся сюда буквенно: если
// кто-то случайно вернёт --text-faint/--accent-warm к дореформенным значениям
// (#b0a29a/#9c5a30), тест ловит регресс контраста, а не факт "поменялось ли
// значение токена".
const CSS_PATH = path.join(__dirname, 'global.css')
const WCAG_AA_NORMAL_TEXT_RATIO = 4.5

function extractLightThemeBlock(css: string): string {
  const match = css.match(/:root\[data-theme=['"]light['"]\]\s*{([^}]*)}/s)
  if (!match) {
    throw new Error(
      ":root[data-theme='light'] block not found in global.css — has the selector changed?",
    )
  }
  return match[1]
}

function extractToken(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  if (!match) {
    throw new Error(
      `--${name} not found as a solid hex value in the light-theme block`,
    )
  }
  return match[1]
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

// WCAG relative-luminance formula (см. также AGENTS.md, "CSP headers" — та же
// формула упоминается для SHA-хэша не относится, но контраст-формула
// стандартна: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA))
  const lB = relativeLuminance(hexToRgb(hexB))
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('light-theme WCAG contrast (regression for Lighthouse a11y color-contrast fixes)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8')
  const light = extractLightThemeBlock(css)

  const textFaint = extractToken(light, 'text-faint')
  const accentWarm = extractToken(light, 'accent-warm')
  const bgPrimary = extractToken(light, 'bg-primary')
  const bgSecondary = extractToken(light, 'bg-secondary')

  it('--text-faint on --bg-primary meets 4.5:1 (footer copyright, search-hint, ...)', () => {
    expect(contrastRatio(textFaint, bgPrimary)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT_RATIO,
    )
  })

  it('--text-faint on --bg-secondary meets 4.5:1 (radio-count, pagination count-text, ...)', () => {
    expect(contrastRatio(textFaint, bgSecondary)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT_RATIO,
    )
  })

  it('--accent-warm on --bg-secondary meets 4.5:1 (active NavPill/toggle)', () => {
    expect(contrastRatio(accentWarm, bgSecondary)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT_RATIO,
    )
  })
})
