import { hashHue } from './hashHue'

describe('hashHue', () => {
  it('возвращает значение в диапазоне [0, 360)', () => {
    for (const id of [0, 1, 2, 42, 1000, 123456, 2 ** 31 - 1]) {
      const hue = hashHue(id)

      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('детерминирована — один и тот же id всегда даёт один и тот же hue', () => {
    expect(hashHue(42)).toBe(hashHue(42))
  })

  it('соседние id дают заметно разные значения (не id % 360)', () => {
    expect(hashHue(1)).not.toBe(hashHue(2))
    expect(hashHue(2)).not.toBe(hashHue(3))
  })

  it('id: 0 — не падает и возвращает валидный hue', () => {
    expect(hashHue(0)).toBe(0)
  })
})
