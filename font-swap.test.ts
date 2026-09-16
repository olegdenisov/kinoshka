import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createContext, runInContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

// public/font-swap.js своп'ает media="print" -> media="all" у Google Fonts
// <link>, чтобы убрать его из цепочки, блокирующей первый рендер (см.
// AGENTS.md, "Lighthouse CI"/Task 3, render-blocking-resources). Файл — plain
// IIFE, ссылающийся на глобальный `document` (script, не модуль) — исполняем
// исходник через node:vm с подставным document вместо переписанной копии
// логики, чтобы тест реально проверял то, что грузится в браузере, а не своё
// же описание этой логики.
const ROOT = __dirname
const SCRIPT_SOURCE = readFileSync(
  path.join(ROOT, 'public/font-swap.js'),
  'utf-8',
)

type FakeLink = {
  media: string
  sheet: unknown
  addEventListener: (event: string, handler: () => void) => void
  dispatchLoad: () => void
}

function createFakeLink(sheet: unknown = null): FakeLink {
  let loadHandler: (() => void) | null = null
  return {
    media: 'print',
    sheet,
    addEventListener(event, handler) {
      if (event === 'load') loadHandler = handler
    },
    dispatchLoad() {
      loadHandler?.()
    },
  }
}

// getElementById-заглушка + запуск скрипта в изолированном vm-контексте — ссылки
// на глобальный `document` внутри font-swap.js резолвятся в этот sandbox, а не в
// какой-то реальный DOM.
function runFontSwapScript(link: FakeLink | null) {
  const sandbox = {
    document: {
      getElementById: (id: string) =>
        id === 'gfonts-stylesheet' ? link : null,
    },
  }
  const context = createContext(sandbox)
  runInContext(SCRIPT_SOURCE, context)
}

describe('public/font-swap.js', () => {
  it('не падает, если #gfonts-stylesheet отсутствует в документе', () => {
    expect(() => runFontSwapScript(null)).not.toThrow()
  })

  it('переключает media на "all" сразу, если стиль уже загружен (link.sheet truthy)', () => {
    const link = createFakeLink({})
    runFontSwapScript(link)
    expect(link.media).toBe('all')
  })

  it('не трогает media сразу, если стиль ещё не загружен (link.sheet falsy), и переключает по событию load', () => {
    const link = createFakeLink(null)
    runFontSwapScript(link)
    expect(link.media).toBe('print')

    link.dispatchLoad()
    expect(link.media).toBe('all')
  })
})

// Silent string coupling: font-swap.js ищет #gfonts-stylesheet по литеральной
// строке id, index.html объявляет <link id="gfonts-stylesheet">. Ничто не
// связывает эти два файла типами — переименование id в одном без другого тихо
// ломает font-swap (шрифты не свопаются, но и ошибки никакой). Тест
// пересчитывает оба id прямо из исходников (тот же принцип, что
// vercel-headers.test.ts's SHA-256-пересчёт из index.html), а не хардкодит
// строку с обеих сторон.
describe('index.html <-> public/font-swap.js id coupling', () => {
  it('id, который font-swap.js ищет через getElementById, совпадает с id Google Fonts <link> в index.html', () => {
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf-8')

    // Lookahead на путь конкретно css2?-стилшита (не просто fonts.googleapis.com —
    // index.html содержит и <link rel="preconnect" href="https://fonts.googleapis.com">
    // без id раньше в документе, который иначе матчился бы первым).
    const linkMatch = html.match(
      /<link\b(?=[^>]*\bhref="https:\/\/fonts\.googleapis\.com\/css2\?)[^>]*>/,
    )
    expect(linkMatch).not.toBeNull()
    const idMatch = linkMatch?.[0].match(/\bid="([^"]+)"/)
    expect(idMatch).not.toBeNull()
    const htmlId = idMatch?.[1]

    const scriptMatch = SCRIPT_SOURCE.match(
      /getElementById\(['"]([^'"]+)['"]\)/,
    )
    expect(scriptMatch).not.toBeNull()
    const scriptId = scriptMatch?.[1]

    expect(htmlId).toBe(scriptId)
  })

  it('index.html подключает /font-swap.js как отдельный same-origin <script>, не инлайн (см. CSP script-src)', () => {
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf-8')
    expect(html).toContain('<script src="/font-swap.js" defer></script>')
  })
})
