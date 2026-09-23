import { z } from 'zod'

import { createStorageSlot, setStorageErrorReporter } from './storage'

const schema = z.array(z.number())

beforeEach(() => localStorage.clear())

describe('createStorageSlot', () => {
  it('возвращает fallback при невалидном JSON', () => {
    localStorage.setItem('test', 'not-json')
    const slot = createStorageSlot('test', schema, [])
    expect(slot.get()).toEqual([])
  })

  it('Невалидный JSON — get() возвращает fallback (не бросает)', () => {
    const fallback: number[] = []
    const slot = createStorageSlot('test', schema, fallback)

    localStorage.setItem('test', '{invalid json}')
    expect(() => slot.get()).not.toThrow()
    expect(slot.get()).toEqual(fallback)
  })

  it('Несовпадение схемы — значение не соответствует Zod-схеме → fallback', () => {
    const fallback: number[] = []
    const slot = createStorageSlot('test', schema, fallback)

    localStorage.setItem('test', 'not-json')
    expect(slot.get()).toEqual(fallback)
  })

  it('Валидное значение — set → get возвращает его)', () => {
    const value = [4, 5, 7]
    const slot = createStorageSlot('test', schema, [])

    slot.set(value)

    expect(slot.get()).toEqual(value)
  })

  it('remove — после remove() get() возвращает fallback', () => {
    const value = [4, 5, 7]
    const fallback: number[] = []
    const slot = createStorageSlot('test', schema, fallback)

    slot.set(value)

    expect(slot.get()).toEqual(value)
    slot.remove()

    expect(slot.get()).toEqual(fallback)
  })

  it('Cross-tab sync — subscribe вызывает callback при window StorageEvent с нужным key', () => {
    const slot = createStorageSlot('test', schema, [])
    const callback = vi.fn()
    const unsubscribe = slot.subscribe(callback)

    window.dispatchEvent(new StorageEvent('storage', { key: 'test' }))

    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('Изоляция по key — StorageEvent с чужим key не триггерит callback', () => {
    const slot = createStorageSlot('test', schema, [])
    const callback = vi.fn()
    const unsubscribe = slot.subscribe(callback)

    window.dispatchEvent(new StorageEvent('storage', { key: 'key' }))

    expect(callback).toHaveBeenCalledTimes(0)
    unsubscribe()
  })

  it('Отсутствие ключа - get() возвращает fallback', () => {
    const fallback: number[] = [1, 2, 3]
    const slot = createStorageSlot('test', schema, fallback)

    expect(slot.get()).toEqual(fallback)
  })

  it('Same-tab уведомление изолировано по key — set() на одном слоте не будит подписчика другого слота', () => {
    const slotA = createStorageSlot('key-a', schema, [])
    const slotB = createStorageSlot('key-b', schema, [])
    const callbackA = vi.fn()
    const callbackB = vi.fn()
    const unsubA = slotA.subscribe(callbackA)
    const unsubB = slotB.subscribe(callbackB)

    slotA.set([1, 2, 3])

    expect(callbackA).toHaveBeenCalledTimes(1)
    expect(callbackB).not.toHaveBeenCalled()

    unsubA()
    unsubB()
  })

  it('Референциальная стабильность — get() === get() без изменений localStorage между вызовами', () => {
    const slot = createStorageSlot('test', schema, [])
    slot.set([1, 2, 3])

    const first = slot.get()
    const second = slot.get()

    expect(first).toBe(second)
  })

  it('Инвалидация мемо — после set() следующий get() возвращает новое значение (не закэшированное старое)', () => {
    const slot = createStorageSlot('test', schema, [])
    slot.set([1, 2, 3])
    const first = slot.get()

    slot.set([4, 5, 6])
    const second = slot.get()

    expect(second).toEqual([4, 5, 6])
    expect(second).not.toBe(first)
  })
})

describe('createStorageSlot — недоступное хранилище', () => {
  afterEach(() => vi.restoreAllMocks())

  it('get() не бросает, если localStorage.getItem бросает (SecurityError) — отдаёт fallback', () => {
    const fallback: number[] = []
    const slot = createStorageSlot('test', schema, fallback)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(() => slot.get()).not.toThrow()
    expect(slot.get()).toBe(fallback)
  })

  it('set() возвращает false и не бросает, если setItem бросает (квота/private mode); подписчиков не будит', () => {
    const slot = createStorageSlot('test', schema, [])
    const callback = vi.fn()
    const unsubscribe = slot.subscribe(callback)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    expect(slot.set([1])).toBe(false)
    expect(callback).not.toHaveBeenCalled()
    expect(slot.get()).toEqual([])
    unsubscribe()
  })

  it('set() возвращает true при успешной записи', () => {
    const slot = createStorageSlot('test', schema, [])

    expect(slot.set([1])).toBe(true)
    expect(slot.get()).toEqual([1])
  })

  it('remove() не бросает, если removeItem бросает', () => {
    const slot = createStorageSlot('test', schema, [])
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(() => slot.remove()).not.toThrow()
  })
})

// Ключи для каждого теста — уникальные (не 'test', как выше): дедупликация репортера в
// storage.ts живёт на уровне модуля (на весь "сеанс", а не per-slot/per-test), и общий ключ
// между тестами этого блока заставил бы второй тест молча не увидеть вызов репортера из-за
// уже отмеченной комбинации "operation:key" первым тестом.
describe('createStorageSlot — репортер ошибок хранения (setStorageErrorReporter)', () => {
  afterEach(() => {
    // useRealTimers здесь, а не в конце теста с fake timers: упавший expect до него оставил бы
    // фейковые таймеры во всех последующих тестах файла
    vi.useRealTimers()
    vi.restoreAllMocks()
    setStorageErrorReporter(() => {})
  })

  // Свежий инстанс модуля: к этому месту файла общий репортер уже устанавливался afterEach'ем,
  // поэтому "репортер не подключен" проверяется только с чистого состояния модуля.
  it('без setStorageErrorReporter сбой не бросает и set() возвращает false', async () => {
    vi.resetModules()
    const { createStorageSlot: freshCreateStorageSlot } =
      await import('./storage')
    const slot = freshCreateStorageSlot('reporter-default', schema, [])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    expect(() => slot.set([1])).not.toThrow()
    expect(slot.set([1])).toBe(false)
  })

  it('get(): ошибка localStorage.getItem вызывает репортер с key/operation/error, без значения стора (репорт отложен на микротаску — см. следующий тест)', async () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-get', schema, [])
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    slot.get()
    await Promise.resolve()

    expect(reporter).toHaveBeenCalledWith({
      key: 'reporter-get',
      operation: 'get',
      error: expect.any(DOMException),
    })
  })

  it('get(): репорт откладывается на микротаску — getSnapshot остаётся синхронным чистым чтением', async () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-get-sync', schema, [])
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    slot.get()
    // сразу после синхронного возврата get() репортер ещё не вызван — вызов ушёл в очередь
    // микротасок, а не выполнился внутри getSnapshot
    expect(reporter).not.toHaveBeenCalled()

    await Promise.resolve()
    expect(reporter).toHaveBeenCalledTimes(1)
  })

  it('бросающий репортер не мешает get()/set() завершиться нормально (fallback/boolean по-прежнему верны)', async () => {
    const throwingReporter = vi.fn(() => {
      throw new Error('репортер сам сломан')
    })
    setStorageErrorReporter(throwingReporter)
    const getSlot = createStorageSlot('reporter-throws-get', schema, [])
    const setSlot = createStorageSlot('reporter-throws-set', schema, [])
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(() => getSlot.get()).not.toThrow()
    expect(getSlot.get()).toEqual([])
    await Promise.resolve()
    expect(throwingReporter).toHaveBeenCalled()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    expect(() => setSlot.set([1])).not.toThrow()
    expect(setSlot.set([1])).toBe(false)
  })

  it('set(): ошибка localStorage.setItem вызывает репортер один раз, повтор с тем же ключом в пределах cooldown дедуплицируется', () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-set', schema, [])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    slot.set([1])
    slot.set([2])

    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({
      key: 'reporter-set',
      operation: 'set',
      error: expect.any(DOMException),
    })
  })

  it('set(): дедуп не навсегда — после истечения cooldown тот же сбой того же ключа репортится снова', () => {
    vi.useFakeTimers()
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-set-cooldown', schema, [])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    slot.set([1])
    expect(reporter).toHaveBeenCalledTimes(1)

    // ещё в пределах cooldown (60s) — дедуплицируется, как в тесте выше
    vi.advanceTimersByTime(59_000)
    slot.set([2])
    expect(reporter).toHaveBeenCalledTimes(1)

    // cooldown истёк — тот же ключ/операция репортится снова, а не проглатывается навсегда
    vi.advanceTimersByTime(2_000)
    slot.set([3])
    expect(reporter).toHaveBeenCalledTimes(2)
  })

  it('дедуп по operation:key — разные ключи репортятся отдельно', () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const a = createStorageSlot('reporter-scope-a', schema, [])
    const b = createStorageSlot('reporter-scope-b', schema, [])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    a.set([1])
    b.set([1])

    expect(reporter).toHaveBeenCalledTimes(2)
  })

  it('дедуп по operation:key — set и remove одного ключа репортятся отдельно', () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-scope-ops', schema, [])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    slot.set([1])
    slot.remove()

    expect(reporter).toHaveBeenCalledTimes(2)
  })

  it('get(): повторные сбои того же ключа дедуплицируются и через путь микротаски', async () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-get-dedupe', schema, [])
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    slot.get()
    slot.get()
    await Promise.resolve()

    expect(reporter).toHaveBeenCalledTimes(1)
  })

  it('remove(): ошибка localStorage.removeItem вызывает репортер', () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-remove', schema, [])
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    slot.remove()

    expect(reporter).toHaveBeenCalledWith({
      key: 'reporter-remove',
      operation: 'remove',
      error: expect.any(DOMException),
    })
  })

  it('парсинг (невалидный JSON/схема) не вызывает репортер — это не сбой доступа к хранилищу', () => {
    const reporter = vi.fn()
    setStorageErrorReporter(reporter)
    const slot = createStorageSlot('reporter-parse', schema, [])
    localStorage.setItem('reporter-parse', 'not-json')

    slot.get()

    expect(reporter).not.toHaveBeenCalled()
  })

  // Свежий инстанс модуля (vi.resetModules + динамический импорт): репортер — module-level
  // singleton, а все тесты выше уже вызывали setStorageErrorReporter хотя бы раз через afterEach,
  // так что к этому месту файла он уже подключен. Проверить "до подключения реального репортера"
  // можно только с чистого состояния модуля.
  it('сбой до подключения реального репортера не блокируется дедупом навсегда — тот же сбой после подключения репортера репортится', async () => {
    vi.resetModules()
    const {
      createStorageSlot: freshCreateStorageSlot,
      setStorageErrorReporter: freshSetStorageErrorReporter,
    } = await import('./storage')

    const slot = freshCreateStorageSlot('reporter-late', schema, [])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    // До freshSetStorageErrorReporter() сбой не уходит никуда (репортер не подключен) — молча, без исключения,
    // и без дедуп-бухгалтерии по этому ключу.
    expect(slot.set([1])).toBe(false)

    const reporter = vi.fn()
    freshSetStorageErrorReporter(reporter)

    // Тот же ключ/операция после подключения реального репортера — не считается "уже
    // отправленным" из-за сбоя, случившегося до подключения.
    slot.set([2])

    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({
      key: 'reporter-late',
      operation: 'set',
      error: expect.any(DOMException),
    })
  })
})
