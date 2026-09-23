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

// Безусловный :root — тёмная палитра (см. AGENTS.md, Theming pattern). `:root\s*{` не совпадает с
// `:root[data-theme=...]`, так что первое совпадение — именно тёмный блок.
function extractDarkThemeBlock(css: string): string {
  const match = css.match(/:root\s*{([^}]*)}/s)
  if (!match) {
    throw new Error('unconditional :root block not found in global.css')
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

// Стопы --avatar-gradient: axe не умеет считать контраст через градиент (проверка уходит в
// `incomplete`, а не в `violations`), поэтому контраст --avatar-fg проверяем по двум сплошным
// стопам градиента, распарсенным прямо из global.css.
function extractOklchStops(
  block: string,
  name: string,
): [number, number, number][] {
  const decl = block.match(new RegExp(`--${name}:([^;]*);`, 's'))
  if (!decl) throw new Error(`--${name} not found in block`)
  const stops = [
    ...decl[1].matchAll(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g),
  ].map(
    m => [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number],
  )
  if (stops.length < 2) {
    throw new Error(`--${name}: expected at least two oklch() stops`)
  }
  return stops
}

// OKLCH → sRGB (0-255) по эталонным матрицам Оттосона (oklab → linear sRGB → гамма-кодирование);
// значения вне гаммы клампятся — так же поступает браузер при отрисовке в sRGB.
function oklchToRgb([l, c, hDeg]: [number, number, number]): [
  number,
  number,
  number,
] {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  const encode = (x: number) => {
    const clamped = Math.min(1, Math.max(0, x))
    const v =
      clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * clamped ** (1 / 2.4) - 0.055
    return Math.round(v * 255)
  }
  return [encode(linear[0]), encode(linear[1]), encode(linear[2])]
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
  const danger = extractToken(light, 'danger')
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

  it('--danger on --bg-secondary meets 4.5:1 (/profile save-error message)', () => {
    expect(contrastRatio(danger, bgSecondary)).toBeGreaterThanOrEqual(
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

describe('dark-theme и аватар: WCAG-контраст токенов, которые не ловит ни axe, ни Lighthouse', () => {
  const css = readFileSync(CSS_PATH, 'utf-8')
  const dark = extractDarkThemeBlock(css)
  const light = extractLightThemeBlock(css)

  it('--danger (dark) on --bg-secondary (dark) meets 4.5:1 (/profile save-error message)', () => {
    expect(
      contrastRatio(
        extractToken(dark, 'danger'),
        extractToken(dark, 'bg-secondary'),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO)
  })

  it.each([
    ['dark', dark],
    ['light', light],
  ])(
    '--avatar-fg (%s theme) meets 4.5:1 on both solid stops of --avatar-gradient (initials in AvatarCircle)',
    (_theme, block) => {
      const fg = hexToRgb(extractToken(block, 'avatar-fg'))
      for (const stop of extractOklchStops(block, 'avatar-gradient')) {
        expect(contrastRatioRgb(fg, oklchToRgb(stop))).toBeGreaterThanOrEqual(
          WCAG_AA_NORMAL_TEXT_RATIO,
        )
      }
    },
  )
})
