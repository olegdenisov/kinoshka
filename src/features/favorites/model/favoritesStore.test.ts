import type * as SharedLib from '@shared/lib'

import { seedStorage } from '../../../test/seedStorage'
import { useFavoritesStore } from './favoritesStore'

vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

beforeEach(() => vi.mocked(trackEvent).mockClear())
afterEach(() => vi.restoreAllMocks())

describe('useFavoritesStore', () => {
  it('toggle добавляет и убирает id, пишет в kinoshka:favorites', () => {
    useFavoritesStore.getState().toggle(1)
    expect(useFavoritesStore.getState().ids).toEqual([1])
    expect(JSON.parse(localStorage.getItem('kinoshka:favorites')!)).toEqual([1])

    useFavoritesStore.getState().toggle(1)
    expect(useFavoritesStore.getState().ids).toEqual([])
  })

  it('add не дублирует, remove и clear работают', () => {
    const { add, remove, clear } = useFavoritesStore.getState()
    add(1)
    add(1)
    add(2)
    expect(useFavoritesStore.getState().ids).toEqual([1, 2])
    remove(1)
    expect(useFavoritesStore.getState().ids).toEqual([2])
    clear()
    expect(useFavoritesStore.getState().ids).toEqual([])
  })

  it('два toggle в одном тике не затирают друг друга', () => {
    const { toggle } = useFavoritesStore.getState()
    toggle(1)
    toggle(2)

    expect(useFavoritesStore.getState().ids).toEqual([1, 2])
  })

  it('trackEvent вызывается при добавлении, но не при удалении и не при add()', () => {
    const { toggle, add } = useFavoritesStore.getState()
    toggle(1)
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('favorite added')

    vi.mocked(trackEvent).mockClear()
    toggle(1)
    add(2)
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('неудачная запись: ids прежние, события аналитики нет', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(() => useFavoritesStore.getState().toggle(1)).not.toThrow()
    expect(useFavoritesStore.getState().ids).toEqual([])
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('cross-tab: storage-событие обновляет стор', () => {
    localStorage.setItem('kinoshka:favorites', JSON.stringify([7, 8]))
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'kinoshka:favorites' }),
    )

    expect(useFavoritesStore.getState().ids).toEqual([7, 8])
  })

  it('seedStorage обновляет уже созданный стор', () => {
    seedStorage('kinoshka:favorites', JSON.stringify([5]))

    expect(useFavoritesStore.getState().ids).toEqual([5])
  })
})
