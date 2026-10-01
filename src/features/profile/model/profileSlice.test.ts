import { makeStore } from '../../../test/renderWithStore'
import {
  nameSet,
  profileHydrated,
  profileReducer,
  selectName,
} from './profileSlice'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('profileSlice — редьюсеры', () => {
  it('nameSet меняет имя', () => {
    expect(profileReducer({ name: '' }, nameSet('Oleg'))).toEqual({
      name: 'Oleg',
    })
  })

  it('hydrated меняет имя', () => {
    const next = profileReducer({ name: '' }, profileHydrated('Ann'))

    expect(selectName({ profile: next })).toBe('Ann')
  })
})

describe('profileSlice — стор', () => {
  it('начальное состояние читается из слота', () => {
    localStorage.setItem('kinoshka:profile', JSON.stringify('Oleg'))

    expect(selectName(makeStore().getState())).toBe('Oleg')
  })

  it('без значения в слоте имя пустое', () => {
    expect(selectName(makeStore().getState())).toBe('')
  })

  it('nameSet пишет значение в localStorage', () => {
    const store = makeStore()

    store.dispatch(nameSet('Oleg'))

    expect(localStorage.getItem('kinoshka:profile')).toBe('"Oleg"')
  })

  it('отказ записи откатывает имя синхронно', () => {
    const store = makeStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    store.dispatch(nameSet('Oleg'))

    expect(selectName(store.getState())).toBe('')
  })
})
