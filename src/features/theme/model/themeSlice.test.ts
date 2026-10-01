import { makeStore } from '../../../test/renderWithStore'
import {
  selectTheme,
  themeHydrated,
  themeReducer,
  themeSet,
} from './themeSlice'

beforeEach(() => localStorage.clear())

describe('themeSlice — редьюсеры', () => {
  it('themeSet меняет тему', () => {
    const next = themeReducer({ theme: 'system' }, themeSet('dark'))

    expect(next).toEqual({ theme: 'dark' })
  })

  it('hydrated меняет тему', () => {
    const next = themeReducer({ theme: 'system' }, themeHydrated('light'))

    expect(selectTheme({ theme: next })).toBe('light')
  })
})

describe('themeSlice — стор', () => {
  it('начальное состояние читается из слота', () => {
    localStorage.setItem('kinoshka:theme', JSON.stringify('light'))

    expect(selectTheme(makeStore().getState())).toBe('light')
  })

  it('без значения в слоте начальное состояние — system', () => {
    expect(selectTheme(makeStore().getState())).toBe('system')
  })

  it('themeSet пишет значение в localStorage', () => {
    const store = makeStore()

    store.dispatch(themeSet('dark'))

    expect(localStorage.getItem('kinoshka:theme')).toBe('"dark"')
  })

  it('отказ записи откатывает тему', () => {
    const store = makeStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    store.dispatch(themeSet('dark'))

    expect(selectTheme(store.getState())).toBe('system')
    vi.restoreAllMocks()
  })
})

describe('themeSlice — другая вкладка', () => {
  it('storage-событие по своему ключу попадает в стейт', () => {
    const store = makeStore()

    localStorage.setItem('kinoshka:theme', JSON.stringify('light'))
    window.dispatchEvent(new StorageEvent('storage', { key: 'kinoshka:theme' }))

    expect(selectTheme(store.getState())).toBe('light')
  })
})
