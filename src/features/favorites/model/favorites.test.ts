import { context } from '@reatom/core'
import type * as SharedLib from '@shared/lib'

import { seedPersisted } from '../../../test/persist'
import { favoriteIds, toggleFavorite } from './favorites'

vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

const KEY = 'kinoshka:favorites'

beforeEach(() => vi.mocked(trackEvent).mockClear())

describe('favoriteIds', () => {
  it('add/delete/clear меняют набор, повторный add не дублирует', () => {
    favoriteIds.add(1)
    favoriteIds.add(1)
    favoriteIds.add(2)
    expect([...favoriteIds()]).toEqual([1, 2])

    favoriteIds.delete(1)
    expect([...favoriteIds()]).toEqual([2])

    favoriteIds.clear()
    expect(favoriteIds().size).toBe(0)
  })

  it('порядок вставки сохраняется', () => {
    favoriteIds.add(3)
    favoriteIds.add(1)
    favoriteIds.add(2)
    expect([...favoriteIds()]).toEqual([3, 1, 2])
  })

  it('пишет в localStorage конверт с массивом id', () => {
    favoriteIds.add(5)
    favoriteIds.add(7)

    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({
      data: [5, 7],
    })
  })

  it('читает значение из seedPersisted при старте', () => {
    seedPersisted(KEY, [4, 2])

    expect([...context.start(() => favoriteIds())]).toEqual([4, 2])
  })

  it('мусор в хранилище даёт пустой набор', () => {
    seedPersisted(KEY, ['a', 'b'])

    expect(context.start(() => favoriteIds()).size).toBe(0)
  })
})

describe('toggleFavorite', () => {
  it('добавляет отсутствующий id и убирает присутствующий', () => {
    toggleFavorite(1)
    expect([...favoriteIds()]).toEqual([1])

    toggleFavorite(1)
    expect([...favoriteIds()]).toEqual([])
  })

  it('событие "favorite added" уходит при добавлении', () => {
    toggleFavorite(1)

    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('favorite added')
  })

  it('событие не уходит при удалении', () => {
    toggleFavorite(1)
    vi.mocked(trackEvent).mockClear()

    toggleFavorite(1)

    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('прямой add не шлёт событие', () => {
    favoriteIds.add(1)

    expect(trackEvent).not.toHaveBeenCalled()
  })
})
