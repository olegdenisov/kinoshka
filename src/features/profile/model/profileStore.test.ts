import { seedStorage } from '../../../test/seedStorage'
import { useProfileStore } from './profileStore'

afterEach(() => vi.restoreAllMocks())

describe('useProfileStore', () => {
  it('успешная запись → true и новое значение, голый JSON в хранилище', () => {
    expect(useProfileStore.getState().setName('  Ada  ')).toBe(true)

    expect(useProfileStore.getState().name).toBe('Ada')
    expect(localStorage.getItem('kinoshka:profile')).toBe(JSON.stringify('Ada'))
  })

  it('имя без видимых символов нормализуется в пустое', () => {
    useProfileStore.getState().setName('Ada')
    useProfileStore.getState().setName('​')

    expect(useProfileStore.getState().name).toBe('')
  })

  it('clearName пишет пустую строку и возвращает true', () => {
    useProfileStore.getState().setName('Ada')

    expect(useProfileStore.getState().clearName()).toBe(true)
    expect(useProfileStore.getState().name).toBe('')
    expect(localStorage.getItem('kinoshka:profile')).toBe('""')
  })

  it('неудачная запись → false, значение прежнее', () => {
    useProfileStore.getState().setName('Ada')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(useProfileStore.getState().setName('Bob')).toBe(false)
    expect(useProfileStore.getState().name).toBe('Ada')
    expect(useProfileStore.getState().clearName()).toBe(false)
    expect(useProfileStore.getState().name).toBe('Ada')
  })

  it('cross-tab: storage-событие обновляет стор', () => {
    localStorage.setItem('kinoshka:profile', JSON.stringify('Grace'))
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'kinoshka:profile' }),
    )

    expect(useProfileStore.getState().name).toBe('Grace')
  })

  it('seedStorage обновляет уже созданный стор', () => {
    seedStorage('kinoshka:profile', JSON.stringify('Linus'))

    expect(useProfileStore.getState().name).toBe('Linus')
  })
})
