import { makeStore } from '../../../test/renderWithStore'
import {
  selectWatchlistIds,
  watchlistHydrated,
  watchlistReducer,
  watchlistToggled,
} from './watchlistSlice'

beforeEach(() => localStorage.clear())

afterEach(() => vi.restoreAllMocks())

describe('watchlistSlice — редьюсеры', () => {
  it('toggled добавляет отсутствующий id и убирает присутствующий', () => {
    const added = watchlistReducer({ ids: [] }, watchlistToggled(1))
    expect(added).toEqual({ ids: [1] })

    expect(watchlistReducer(added, watchlistToggled(1))).toEqual({ ids: [] })
  })

  it('hydrated заменяет список', () => {
    const next = watchlistReducer({ ids: [1] }, watchlistHydrated([2, 3]))

    expect(selectWatchlistIds({ watchlist: next })).toEqual([2, 3])
  })
})

describe('watchlistSlice — стор', () => {
  it('начальное состояние читается из слота', () => {
    localStorage.setItem('kinoshka:watchlist', JSON.stringify([5]))

    expect(selectWatchlistIds(makeStore().getState())).toEqual([5])
  })

  it('два toggled подряд в одном тике не затирают друг друга', () => {
    const store = makeStore()

    store.dispatch(watchlistToggled(1))
    store.dispatch(watchlistToggled(2))

    expect(selectWatchlistIds(store.getState())).toEqual([1, 2])
    expect(JSON.parse(localStorage.getItem('kinoshka:watchlist')!)).toEqual([
      1, 2,
    ])
  })

  it('отказ записи откатывает список', () => {
    const store = makeStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    store.dispatch(watchlistToggled(1))

    expect(selectWatchlistIds(store.getState())).toEqual([])
  })
})

describe('watchlistSlice — другая вкладка', () => {
  it('storage-событие по своему ключу попадает в стейт', () => {
    const store = makeStore()

    localStorage.setItem('kinoshka:watchlist', JSON.stringify([4, 8]))
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'kinoshka:watchlist' }),
    )

    expect(selectWatchlistIds(store.getState())).toEqual([4, 8])
  })
})
