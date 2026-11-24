import {
  atom,
  context,
  reatomSet,
  withLocalStorage,
  type PersistRecord,
} from '@reatom/core'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { seedPersisted } from '../../../test/persist'
import { PERSIST_FOREVER_MS, persistOptions } from './persistOptions'

const KEY = 'kinoshka:persist-test'

const createCounter = () =>
  atom(0, 'test.persistCounter').extend(
    withLocalStorage(
      persistOptions({ key: KEY, schema: z.number(), fallback: 0 }),
    ),
  )

const createSet = () =>
  reatomSet<number>([], 'test.persistSet').extend(
    withLocalStorage(
      persistOptions({
        key: KEY,
        schema: z.array(z.number()),
        fallback: new Set<number>(),
        fromValid: ids => new Set(ids),
        toSnapshot: ids => [...ids],
      }),
    ),
  )

const readRecord = () => JSON.parse(localStorage.getItem(KEY)!) as PersistRecord

describe('persistOptions', () => {
  it('значение переживает пересоздание контекста', () => {
    createCounter().set(5)

    const restored = context.start(() => createCounter()())

    expect(restored).toBe(5)
  })

  it('Set пишется конвертом с массивом и восстанавливается с тем же порядком', () => {
    const ids = createSet()
    ids.add(3)
    ids.add(1)
    ids.add(2)

    expect(readRecord().data).toEqual([3, 1, 2])

    const restored = createSet()
    expect([...restored()]).toEqual([3, 1, 2])
  })

  it('невалидный JSON даёт дефолт', () => {
    localStorage.setItem(KEY, '{not json')

    expect(createCounter()()).toBe(0)
  })

  it('значение без конверта даёт дефолт', () => {
    localStorage.setItem(KEY, '5')

    expect(createCounter()()).toBe(0)
  })

  it('снапшот, не прошедший схему, даёт дефолт без исключения', () => {
    seedPersisted(KEY, 'not a number')
    expect(createCounter()()).toBe(0)

    seedPersisted(KEY, ['a'])
    expect(createSet()().size).toBe(0)
  })

  it('читает валидный засеянный снапшот', () => {
    seedPersisted(KEY, [7, 8])

    expect([...createSet()()]).toEqual([7, 8])
  })

  it('запись не истекает', () => {
    createCounter().set(1)

    expect(readRecord().to).toBeGreaterThan(Date.now() + 365 * 24 * 3600 * 1000)
  })

  it('сбой setItem не бросает, значение обновлено в памяти', () => {
    const counter = createCounter()
    counter()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })

    expect(() => counter.set(9)).not.toThrow()
    expect(counter()).toBe(9)

    setItem.mockRestore()
    warn.mockRestore()
  })

  it('событие storage обновляет подключённый атом', async () => {
    const counter = createCounter()
    const unsubscribe = counter.subscribe(() => {})
    // Подписка на storage ставится в connect-hook, асинхронно после subscribe.
    await new Promise(resolve => setTimeout(resolve, 0))
    const record: PersistRecord = {
      data: 11,
      id: 1,
      timestamp: Date.now(),
      version: 0,
      to: PERSIST_FOREVER_MS,
    }
    const value = JSON.stringify(record)
    localStorage.setItem(KEY, value)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: KEY,
        newValue: value,
        storageArea: localStorage,
      }),
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(counter()).toBe(11)
    unsubscribe()
  })
})
