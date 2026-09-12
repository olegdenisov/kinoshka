import { describe, expect, it } from 'vitest'

import { isAnalyzeEnabled } from './bundle.config'

describe('isAnalyzeEnabled', () => {
  it('true только при command === "build" и ANALYZE === "true"', () => {
    expect(
      isAnalyzeEnabled({ command: 'build', env: { ANALYZE: 'true' } }),
    ).toBe(true)
  })

  it('false при command === "serve", даже если ANALYZE === "true"', () => {
    expect(
      isAnalyzeEnabled({ command: 'serve', env: { ANALYZE: 'true' } }),
    ).toBe(false)
  })

  it('false при билде без ANALYZE', () => {
    expect(isAnalyzeEnabled({ command: 'build', env: {} })).toBe(false)
  })

  it('false при билде с ANALYZE, не равным "true" (например "1" или "false")', () => {
    expect(isAnalyzeEnabled({ command: 'build', env: { ANALYZE: '1' } })).toBe(
      false,
    )
    expect(
      isAnalyzeEnabled({ command: 'build', env: { ANALYZE: 'false' } }),
    ).toBe(false)
  })

  // [review phase 1] Оба условия одновременно false (command==='serve' И пустой env) — до этого
  // теста комбинация не была явно покрыта (только 'serve'+ANALYZE:'true' и 'build'+{}
  // покрывались отдельно).
  it('false при command === "serve" и пустом env (обе части предиката false одновременно)', () => {
    expect(isAnalyzeEnabled({ command: 'serve', env: {} })).toBe(false)
  })
})
