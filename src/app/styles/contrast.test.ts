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

// Полупрозрачный токен (--accent-warm-soft и родня) — нужен для composite-теста
// ниже: реальный фон под текстом это не сам rgba(), а результат его наложения
// на непрозрачный фон контейнера.
function extractRgbaToken(
  block: string,
  name: string,
): { rgb: [number, number, number]; alpha: number } {
  const match = block.match(
    new RegExp(
      `--${name}:\\s*rgba\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*([\\d.]+)\\s*\\)\\s*;`,
    ),
  )
  if (!match) {
    throw new Error(
      `--${name} not found as an rgba() value in the light-theme block`,
    )
  }
  return {
    rgb: [Number(match[1]), Number(match[2]), Number(match[3])],
    alpha: Number(match[4]),
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

// Alpha-композитинг полупрозрачного слоя поверх непрозрачного фона — то же
// "source-over"-смешение, что делает браузер (и что учитывает axe
// color-contrast, считая эффективный фон элемента).
function compositeOver(
  layer: { rgb: [number, number, number]; alpha: number },
  backdropHex: string,
): [number, number, number] {
  const backdrop = hexToRgb(backdropHex)
  return layer.rgb.map(
    (c, i) => layer.alpha * c + (1 - layer.alpha) * backdrop[i],
  ) as [number, number, number]
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

function contrastRatioRgb(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const lA = relativeLuminance(a)
  const lB = relativeLuminance(b)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

function contrastRatio(hexA: string, hexB: string): number {
  return contrastRatioRgb(hexToRgb(hexA), hexToRgb(hexB))
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

  // Голого --accent-warm на плоском --bg-secondary недостаточно: в реальных
  // "активных" состояниях фильтров текст этого цвета лежит НЕ на самом
  // --bg-secondary, а на полупрозрачном --accent-warm-soft поверх него, что
  // тянет эффективный фон к цвету текста и роняет контраст (прямой
  // --bg-secondary даёт ~5.57:1, композит — ~4.52:1, то есть почти впритык к
  // порогу). Если проверять только плоский вариант, будущий сдвиг токена
  // может тихо увести реальный контраст ниже 4.5 и завалить Lighthouse
  // a11y-гейт при зелёном тесте (найдено code review PR #74).
  //
  // Базовый фон — --bg-secondary, потому что именно он стоит у обоих
  // контейнеров, где такое сочетание живёт: SearchSidebar's `.sidebar`
  // (desktop) и BottomSheet's `.sheet` (mobile-вариант фильтров) — см.
  // SearchSidebar.module.css / BottomSheet.module.css. ActiveFilterChips
  // рендерятся выше, на --bg-primary, где контраст заведомо больше
  // (композит ~4.97:1), так что --bg-secondary — худший из реальных случаев.
  const accentWarmSoft = extractRgbaToken(light, 'accent-warm-soft')

  it('--accent-warm on --accent-warm-soft composited over --bg-secondary meets 4.5:1 (GenreSelector.chipActive, SearchSidebar.ratingBtnActive, ActiveFilterChips.chip)', () => {
    expect(
      contrastRatioRgb(
        hexToRgb(accentWarm),
        compositeOver(accentWarmSoft, bgSecondary),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO)
  })
})
