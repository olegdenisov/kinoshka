vi.mock('./sentry', () => ({ captureChunkLoadError: vi.fn() }))

const { captureChunkLoadError } = await import('./sentry')

type PreloadErrorEvent = Event & { payload?: unknown }

const dispatchPreloadError = (payload: unknown = new Error('chunk 404')) => {
  const event: PreloadErrorEvent = new Event('vite:preloadError', {
    cancelable: true,
  })
  event.payload = payload
  window.dispatchEvent(event)
  return event
}

// window.location.reload недоступен для прямого мока в jsdom (window.location — read-only
// объект) — переопределяем через Object.defineProperty на самом window.location, как это принято
// для jsdom-стабов навигации (аналог vi.stubGlobal('scrollTo', ...) в usePageSync.test.tsx, но
// scrollTo можно переопределить напрямую, а location.reload — нет).
const reloadSpy = vi.fn()

// Один тест иногда вызывает setup() несколько раз (эмулируя несколько «загрузок страницы» подряд)
// — копим ВСЕ зарегистрированные за тест слушатели и снимаем все разом в afterEach, а не только
// последний, иначе более ранние остаются висеть на window и ловят диспетчи следующих тестов.
let registeredListeners: EventListenerOrEventListenerObject[] = []

// Модуль держит isReloading в памяти (не в sessionStorage) — в реальности его обнуляет только
// настоящий location.reload(), которого в тестах нет. vi.resetModules() + свежий импорт перед
// каждым тестом (или несколько раз внутри одного теста) эмулирует «новую загрузку страницы»: без
// этого isReloading, once true после первого успешного reload, навсегда гасил бы preventDefault во
// всех следующих тестах/дальнейших вызовах. Слушателя предыдущего инстанса снимаем сами (ловим
// ссылку на функцию через шпион на addEventListener) — модуль намеренно не даёт функцию отписки в
// публичном API (см. WHY в chunkPreloadRecovery.ts), это не повод добавлять её ради тестов.
const setup = async () => {
  // Симулируем полную перезагрузку страницы: старый слушатель реально снят — после настоящего
  // location.reload() прежнего модуля/слушателя в браузере уже не существует.
  for (const listener of registeredListeners) {
    window.removeEventListener('vite:preloadError', listener)
  }
  registeredListeners = []

  vi.resetModules()
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
  const { registerChunkPreloadRecovery } =
    await import('./chunkPreloadRecovery')
  registerChunkPreloadRecovery()
  const registerCall = addEventListenerSpy.mock.calls.find(
    ([type]) => type === 'vite:preloadError',
  )
  const listener = registerCall?.[1] as
    | EventListenerOrEventListenerObject
    | undefined
  if (listener) registeredListeners.push(listener)
  addEventListenerSpy.mockRestore()
  return { registerChunkPreloadRecovery }
}

// Guard сравнивает метку со стартом документа (performance.timeOrigin) и действует только первые
// минуты жизни документа (performance.now()) — в jsdom оба значения зависят от старта тестового
// окружения, поэтому в тестах guard-окна задаём их явно.
const mockTimeOrigin = (value: number) =>
  vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(value)
const mockDocAge = (ms: number) =>
  vi.spyOn(performance, 'now').mockReturnValue(ms)

beforeEach(() => {
  reloadSpy.mockClear()
  vi.mocked(captureChunkLoadError).mockClear()
  sessionStorage.clear()
  vi.stubEnv('PROD', true)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  })
})

afterEach(() => {
  for (const listener of registeredListeners) {
    window.removeEventListener('vite:preloadError', listener)
  }
  registeredListeners = []
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('registerChunkPreloadRecovery', () => {
  it('на диспатч vite:preloadError глушит ошибку, репортит её и перезагружает страницу один раз', async () => {
    await setup()

    const payload = new Error('chunk 404')
    const event = dispatchPreloadError(payload)

    expect(event.defaultPrevented).toBe(true)
    expect(captureChunkLoadError).toHaveBeenCalledWith(payload)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('без диспатча события не перезагружает страницу', async () => {
    await setup()

    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('вторая ошибка в той же пачке (до настоящего reload) тоже гасится, но без повторного репорта/reload', async () => {
    await setup()

    const first = dispatchPreloadError()
    const second = dispatchPreloadError()

    expect(first.defaultPrevented).toBe(true)
    expect(second.defaultPrevented).toBe(true)
    expect(captureChunkLoadError).toHaveBeenCalledTimes(1)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('повторный сбой в окне guard-а на СЛЕДУЮЩЕЙ загрузке страницы не перезагружает и не глушит ошибку (нет цикла reload)', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    await setup()
    dispatchPreloadError()
    reloadSpy.mockClear()
    vi.mocked(captureChunkLoadError).mockClear()

    // Новая загрузка страницы после настоящего reload — свежий модуль, isReloading снова false,
    // документ стартовал вскоре после sessionStorage-метки (переживает reload).
    mockTimeOrigin(1_000_000 + 200)
    mockDocAge(800)
    now.mockReturnValue(1_000_000 + 1_000)
    await setup()
    const second = dispatchPreloadError()

    expect(second.defaultPrevented).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(captureChunkLoadError).not.toHaveBeenCalled()
  })

  it('медленный сбой после recovery-reload (> окна после метки, но документ стартовал в окне) не перезагружает', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    await setup()
    dispatchPreloadError()
    reloadSpy.mockClear()
    vi.mocked(captureChunkLoadError).mockClear()

    // Страница после reload стартовала через 500ms, но чанк висел до таймаута и упал через 30s.
    mockTimeOrigin(1_000_000 + 500)
    mockDocAge(29_500)
    now.mockReturnValue(1_000_000 + 30_000)
    await setup()
    const event = dispatchPreloadError()

    expect(event.defaultPrevented).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(captureChunkLoadError).not.toHaveBeenCalled()
  })

  it('recovery-документ, новый сбой спустя час (следующий деплой) — снова перезагружает', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    await setup()
    dispatchPreloadError()
    reloadSpy.mockClear()
    vi.mocked(captureChunkLoadError).mockClear()

    // Документ стартовал recovery-reload-ом, но прожил час в той же вкладке — guard уже не действует.
    mockTimeOrigin(1_000_000 + 500)
    mockDocAge(3_600_000)
    now.mockReturnValue(1_000_000 + 3_600_500)
    await setup()
    const event = dispatchPreloadError()

    expect(event.defaultPrevented).toBe(true)
    expect(captureChunkLoadError).toHaveBeenCalledTimes(1)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('загрузка страницы, стартовавшая после окна guard-а, снова перезагружает', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    await setup()
    dispatchPreloadError()
    reloadSpy.mockClear()

    // Например, ручной reload на следующий день в той же вкладке.
    mockTimeOrigin(1_000_000 + 10_001)
    mockDocAge(9_999)
    now.mockReturnValue(1_000_000 + 20_000)
    await setup()
    const event = dispatchPreloadError()

    expect(event.defaultPrevented).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('если sessionStorage недоступен — не перезагружает (guard не записать, риск цикла)', async () => {
    await setup()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    const event = dispatchPreloadError()

    expect(event.defaultPrevented).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('в dev не вмешивается — ошибка всплывает как есть', async () => {
    await setup()
    vi.stubEnv('PROD', false)

    const event = dispatchPreloadError()

    expect(event.defaultPrevented).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('повторная регистрация не вешает второй слушатель', async () => {
    const { registerChunkPreloadRecovery } = await setup()

    registerChunkPreloadRecovery()
    dispatchPreloadError()

    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(captureChunkLoadError).toHaveBeenCalledTimes(1)
  })
})
