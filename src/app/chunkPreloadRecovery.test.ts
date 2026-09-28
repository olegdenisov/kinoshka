import { registerChunkPreloadRecovery } from './chunkPreloadRecovery'

// window.location.reload недоступен для прямого мока в jsdom (window.location — read-only
// объект) — переопределяем через Object.defineProperty на самом window.location, как это принято
// для jsdom-стабов навигации (аналог vi.stubGlobal('scrollTo', ...) в usePageSync.test.tsx, но
// scrollTo можно переопределить напрямую, а location.reload — нет).
describe('registerChunkPreloadRecovery', () => {
  const reloadSpy = vi.fn()

  beforeEach(() => {
    reloadSpy.mockClear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })
  })

  it('на диспатч vite:preloadError вызывает preventDefault и перезагружает страницу один раз', () => {
    registerChunkPreloadRecovery()

    const event = new CustomEvent('vite:preloadError', { cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('без диспатча события не перезагружает страницу', () => {
    registerChunkPreloadRecovery()

    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
