import { z } from 'zod'

import { createStorageSlot } from './storage'

const schema = z.array(z.number())

beforeEach(() => localStorage.clear())

describe('createStorageSlot', () => {
  it('возвращает fallback при невалидном JSON', () => {
    localStorage.setItem('test', 'not-json')
    const slot = createStorageSlot('test', schema, [])
    expect(slot.get()).toEqual([])
  })

  it('Невалидный JSON — get() возвращает fallback (не бросает)', () => {
    const fallback: number[] = []
    const slot = createStorageSlot('test', schema, fallback)

    localStorage.setItem('test', '{invalid json}')
    expect(() => slot.get()).not.toThrow()
    expect(slot.get()).toEqual(fallback)
  })

  it('Несовпадение схемы — значение не соответствует Zod-схеме → fallback', () => {
    const fallback: number[] = []
    const slot = createStorageSlot('test', schema, fallback)

    localStorage.setItem('test', 'not-json')
    expect(slot.get()).toEqual(fallback)
  })

  it('Валидное значение — set → get возвращает его)', () => {
    const value = [4, 5, 7]
    const slot = createStorageSlot('test', schema, [])

    slot.set(value)

    expect(slot.get()).toEqual(value)
  })

  it('remove — после remove() get() возвращает fallback', () => {
    const value = [4, 5, 7]
    const fallback: number[] = []
    const slot = createStorageSlot('test', schema, fallback)

    slot.set(value)

    expect(slot.get()).toEqual(value)
    slot.remove()

    expect(slot.get()).toEqual(fallback)
  })

  it('Cross-tab sync — subscribe вызывает callback при window StorageEvent с нужным key', () => {
    const slot = createStorageSlot('test', schema, [])
    const callback = vi.fn()
    const unsubscribe = slot.subscribe(callback)

    window.dispatchEvent(new StorageEvent('storage', { key: 'test' }))

    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('Изоляция по key — StorageEvent с чужим key не триггерит callback', () => {
    const slot = createStorageSlot('test', schema, [])
    const callback = vi.fn()
    const unsubscribe = slot.subscribe(callback)

    window.dispatchEvent(new StorageEvent('storage', { key: 'key' }))

    expect(callback).toHaveBeenCalledTimes(0)
    unsubscribe()
  })

  it('Отсутствие ключа - get() возвращает fallback', () => {
    const fallback: number[] = [1, 2, 3]
    const slot = createStorageSlot('test', schema, fallback)

    expect(slot.get()).toEqual(fallback)
  })
})
