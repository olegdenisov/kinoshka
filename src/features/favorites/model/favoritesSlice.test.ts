import { makeStore } from '../../../test/renderWithStore'
import {
  favoritesHydrated,
  favoritesReducer,
  favoritesToggled,
  selectFavoriteIds,
} from './favoritesSlice'

beforeEach(() => localStorage.clear())

afterEach(() => vi.restoreAllMocks())

describe('favoritesSlice — редьюсеры', () => {
  it('toggled добавляет отсутствующий id и убирает присутствующий', () => {
    const added = favoritesReducer({ ids: [] }, favoritesToggled(1))
    expect(added).toEqual({ ids: [1] })

    expect(favoritesReducer(added, favoritesToggled(1))).toEqual({ ids: [] })
  })

  it('toggled убирает id из середины, сохраняя порядок остальных', () => {
    expect(favoritesReducer({ ids: [1, 2, 3] }, favoritesToggled(2))).toEqual({
      ids: [1, 3],
    })
  })

  it('hydrated заменяет список', () => {
    const next = favoritesReducer({ ids: [1] }, favoritesHydrated([2, 3]))

    expect(selectFavoriteIds({ favorites: next })).toEqual([2, 3])
  })
})

describe('favoritesSlice — стор', () => {
  it('начальное состояние читается из слота', () => {
    localStorage.setItem('kinoshka:favorites', JSON.stringify([5]))

    expect(selectFavoriteIds(makeStore().getState())).toEqual([5])
  })

  it('toggled напрямую НЕ пишет в слот — единственный путь записи mutation toggleFavorite', () => {
    const store = makeStore()

    store.dispatch(favoritesToggled(1))

    expect(selectFavoriteIds(store.getState())).toEqual([1])
    expect(localStorage.getItem('kinoshka:favorites')).toBeNull()
  })

  it('storage-событие из другой вкладки попадает в стор', () => {
    const store = makeStore()

    localStorage.setItem('kinoshka:favorites', JSON.stringify([4, 2]))
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'kinoshka:favorites',
        newValue: JSON.stringify([4, 2]),
      }),
    )

    expect(selectFavoriteIds(store.getState())).toEqual([4, 2])
  })
})
