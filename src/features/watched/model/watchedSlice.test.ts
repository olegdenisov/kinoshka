import { makeStore } from '../../../test/renderWithStore'
import {
  selectWatchedIds,
  watchedHydrated,
  watchedReducer,
  watchedToggled,
} from './watchedSlice'

beforeEach(() => localStorage.clear())

afterEach(() => vi.restoreAllMocks())

describe('watchedSlice — редьюсеры', () => {
  it('toggled добавляет отсутствующий id и убирает присутствующий', () => {
    const added = watchedReducer({ ids: [] }, watchedToggled(1))
    expect(added).toEqual({ ids: [1] })

    expect(watchedReducer(added, watchedToggled(1))).toEqual({ ids: [] })
  })

  it('hydrated заменяет список', () => {
    const next = watchedReducer({ ids: [1] }, watchedHydrated([2, 3]))

    expect(selectWatchedIds({ watched: next })).toEqual([2, 3])
  })
})

describe('watchedSlice — стор', () => {
  it('начальное состояние читается из слота', () => {
    localStorage.setItem('kinoshka:watched', JSON.stringify([5]))

    expect(selectWatchedIds(makeStore().getState())).toEqual([5])
  })

  it('два toggled подряд в одном тике не затирают друг друга', () => {
    const store = makeStore()

    store.dispatch(watchedToggled(1))
    store.dispatch(watchedToggled(2))

    expect(selectWatchedIds(store.getState())).toEqual([1, 2])
    expect(JSON.parse(localStorage.getItem('kinoshka:watched')!)).toEqual([
      1, 2,
    ])
  })

  it('отказ записи откатывает список', () => {
    const store = makeStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    store.dispatch(watchedToggled(1))

    expect(selectWatchedIds(store.getState())).toEqual([])
  })
})

describe('watchedSlice — другая вкладка', () => {
  it('storage-событие по своему ключу попадает в стейт', () => {
    const store = makeStore()

    localStorage.setItem('kinoshka:watched', JSON.stringify([4, 8]))
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'kinoshka:watched' }),
    )

    expect(selectWatchedIds(store.getState())).toEqual([4, 8])
  })
})
