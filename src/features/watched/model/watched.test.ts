import { context } from '@reatom/core'

import { readPersisted, seedPersisted } from '../../../test/persist'
import { favoriteIds } from '../../favorites/model/favorites'
import { watchedIds } from '../../watched/model/watched'
import { watchlistIds } from '../../watchlist/model/watchlist'

const KEY = 'kinoshka:watched'
const list = watchedIds

describe('watchedIds', () => {
  it('по умолчанию список пуст', () => {
    expect(list().size).toBe(0)
  })

  it('toggle добавляет отсутствующий id и убирает присутствующий', () => {
    list.toggle(1)
    expect([...list()]).toEqual([1])

    list.toggle(1)
    expect([...list()]).toEqual([])
  })

  it('два toggle подряд не затирают друг друга, порядок вставки сохраняется', () => {
    list.toggle(3)
    list.toggle(1)
    list.toggle(2)
    expect([...list()]).toEqual([3, 1, 2])
  })

  it('пишет в localStorage конверт с массивом id', () => {
    list.toggle(7)
    list.toggle(9)

    expect(readPersisted(KEY)).toEqual([7, 9])
  })

  it('читает значение из seedPersisted при старте', () => {
    seedPersisted(KEY, [4, 2])

    expect([...context.start(() => list())]).toEqual([4, 2])
  })

  it('мусор в хранилище даёт пустой набор', () => {
    seedPersisted(KEY, ['a', 'b'])

    expect(context.start(() => list()).size).toBe(0)
  })

  it('не зависит от двух других списков', () => {
    list.add(1)

    const others = [favoriteIds, watchedIds, watchlistIds].filter(
      x => x !== list,
    )
    expect(others.every(x => x().size === 0)).toBe(true)
  })
})
