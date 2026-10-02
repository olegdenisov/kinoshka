import { seedStorage } from '../../../test/seedStorage'
import { useWatchedStore } from './watchedStore'

afterEach(() => vi.restoreAllMocks())

describe('useWatchedStore', () => {
  it('toggle добавляет и убирает id, пишет в kinoshka:watched', () => {
    useWatchedStore.getState().toggle(1)
    expect(useWatchedStore.getState().ids).toEqual([1])
    expect(JSON.parse(localStorage.getItem('kinoshka:watched')!)).toEqual([1])

    useWatchedStore.getState().toggle(1)
    expect(useWatchedStore.getState().ids).toEqual([])
    expect(JSON.parse(localStorage.getItem('kinoshka:watched')!)).toEqual([])
  })

  it('два toggle в одном тике не затирают друг друга', () => {
    const { toggle } = useWatchedStore.getState()
    toggle(1)
    toggle(2)

    expect(useWatchedStore.getState().ids).toEqual([1, 2])
  })

  it('rehydrate подхватывает сохранённое значение', () => {
    seedStorage('kinoshka:watched', JSON.stringify([5, 6]))
    void useWatchedStore.persist.rehydrate()

    expect(useWatchedStore.getState().ids).toEqual([5, 6])
  })

  it('неудачная запись не меняет ids и не бросает', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(() => useWatchedStore.getState().toggle(1)).not.toThrow()
    expect(useWatchedStore.getState().ids).toEqual([])
  })
})
