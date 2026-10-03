import { readFileSync } from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { seedPersisted } from '../../../test/persist'

// Inline-скрипт из index.html исполняется как есть: тест ловит расхождение формата с конвертом
// persist (его sha256 в CSP проверяет vercel-headers.test.ts).
const html = readFileSync(
  path.resolve(__dirname, '../../../../index.html'),
  'utf-8',
)
const script = [...new JSDOM(html).window.document.querySelectorAll('script')]
  .filter(node => !node.hasAttribute('src'))
  .map(node => node.textContent ?? '')[0]

const runScript = (systemDark: boolean) => {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: systemDark,
    media: query,
  })) as unknown as typeof window.matchMedia
  try {
    new Function(script)()
  } finally {
    window.matchMedia = original
  }
  return document.documentElement.getAttribute('data-theme')
}

afterEach(() => document.documentElement.removeAttribute('data-theme'))

describe('inline-скрипт темы', () => {
  it('читает тему из data конверта', () => {
    seedPersisted('kinoshka:theme', 'dark')
    expect(runScript(false)).toBe('dark')

    seedPersisted('kinoshka:theme', 'light')
    expect(runScript(true)).toBe('light')
  })

  it('system в конверте и пустое хранилище → системная тема', () => {
    seedPersisted('kinoshka:theme', 'system')
    expect(runScript(true)).toBe('dark')

    localStorage.clear()
    expect(runScript(false)).toBe('light')
  })

  it.each([
    ['не JSON', '{oops'],
    ['значение без конверта', '"dark"'],
    ['null', 'null'],
    ['конверт с мусором', JSON.stringify({ data: 42 })],
  ])('мусор в хранилище (%s) → системная тема', (_name, raw) => {
    localStorage.setItem('kinoshka:theme', raw)

    expect(runScript(true)).toBe('dark')
    expect(runScript(false)).toBe('light')
  })
})
