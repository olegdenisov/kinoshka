import { seedStorage } from '../../../test/seedStorage'
import { useWatchlistStore } from './watchlistStore'

afterEach(() => vi.restoreAllMocks())

describe('useWatchlistStore', () => {
  it('toggle добавляет и убирает id, пишет в kinoshka:watchlist', () => {
    useWatchlistStore.getState().toggle(1)
    expect(useWatchlistStore.getState().ids).toEqual([1])
    expect(JSON.parse(localStorage.getItem('kinoshka:watchlist')!)).toEqual([1])

    useWatchlistStore.getState().toggle(1)
    expect(useWatchlistStore.getState().ids).toEqual([])
    expect(JSON.parse(localStorage.getItem('kinoshka:watchlist')!)).toEqual([])
  })

  it('два toggle в одном тике не затирают друг друга', () => {
    const { toggle } = useWatchlistStore.getState()
    toggle(1)
    toggle(2)

    expect(useWatchlistStore.getState().ids).toEqual([1, 2])
  })

  it('rehydrate подхватывает сохранённое значение', () => {
    seedStorage('kinoshka:watchlist', JSON.stringify([5, 6]))

    expect(useWatchlistStore.getState().ids).toEqual([5, 6])
  })

  it('неудачная запись не меняет ids и не бросает', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(() => useWatchlistStore.getState().toggle(1)).not.toThrow()
    expect(useWatchlistStore.getState().ids).toEqual([])
    expect(localStorage.getItem('kinoshka:watchlist')).toBeNull()
  })
})
