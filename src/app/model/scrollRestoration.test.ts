import { urlAtom } from '@reatom/core'
import type { MockInstance } from 'vitest'

import { setTestUrl } from '../../test/router'
import { initScrollRestoration } from './scrollRestoration'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

// jsdom не реализует ни скролл, ни раскладку: позицию и высоту документа задаём руками.
let scrollY = 0
let scrollHeight = 0
let scrollTo: MockInstance<typeof window.scrollTo>

const entryKey = () => (window.history.state as { key?: string } | null)?.key

// jsdom выполняет history.back() асинхронно — ждём сам popstate.
const goBack = async () => {
  const popped = new Promise(resolve =>
    window.addEventListener('popstate', resolve, { once: true }),
  )
  window.history.back()
  await popped
}

beforeEach(() => {
  scrollY = 0
  scrollHeight = 5000
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(
    () => scrollHeight,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

const start = (url = '/') => {
  setTestUrl(url)
  initScrollRestoration()
}

describe('scrollRestoration', () => {
  it('проставляет ключ текущей записи и переключает браузер на ручной режим', () => {
    start()

    expect(entryKey()).toEqual(expect.any(String))
    expect(window.history.scrollRestoration).toBe('manual')
  })

  it('клик по <a> сбрасывает скролл', async () => {
    start()
    scrollY = 600
    const link = document.createElement('a')
    link.href = '/movie/1'
    document.body.append(link)

    link.click()
    await tick()

    expect(window.location.pathname).toBe('/movie/1')
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    link.remove()
  })

  it('переход через urlAtom.go сбрасывает скролл и даёт новой записи свой ключ', async () => {
    start()
    const firstKey = entryKey()
    scrollY = 600

    urlAtom.go('/movie/1')
    await tick()

    expect(window.location.pathname).toBe('/movie/1')
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(entryKey()).toEqual(expect.any(String))
    expect(entryKey()).not.toBe(firstKey)
  })

  it('back восстанавливает позицию предыдущей записи', async () => {
    start()
    scrollY = 600
    urlAtom.go('/movie/1')
    await tick()
    scrollY = 0
    scrollTo.mockClear()

    await goBack()

    expect(urlAtom().pathname).toBe('/')
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 600))
  })

  it('back ждёт, пока контент дорастёт до сохранённой позиции', async () => {
    start()
    scrollY = 3000
    urlAtom.go('/movie/1')
    await tick()
    scrollY = 0
    // Пока страница короткая (рендерится спиннер), до 3000 не доскроллить.
    scrollHeight = 800
    scrollTo.mockClear()

    await goBack()
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(scrollTo).not.toHaveBeenCalled()

    scrollHeight = 5000
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 3000))
  })

  it('пользовательский скролл прекращает восстановление', async () => {
    start()
    scrollY = 3000
    urlAtom.go('/movie/1')
    await tick()
    scrollHeight = 800
    scrollTo.mockClear()

    await goBack()
    await tick()
    window.dispatchEvent(new Event('wheel'))
    scrollHeight = 5000
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('смена ?q не скроллит и сохраняет ключ записи', async () => {
    start('/search')
    const key = entryKey()
    scrollY = 600

    urlAtom.set(url => new URL('/search?q=matrix', url), true)
    await tick()

    expect(window.location.search).toBe('?q=matrix')
    expect(scrollTo).not.toHaveBeenCalled()
    expect(entryKey()).toBe(key)
  })

  it('после перезагрузки восстанавливает позицию, сохранённую при pagehide', async () => {
    start()
    const key = entryKey()
    scrollY = 900
    window.dispatchEvent(new Event('pagehide'))

    // Повторный запуск на той же записи истории — как после перезагрузки страницы.
    initScrollRestoration()

    expect(entryKey()).toBe(key)
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 900))
  })
})
