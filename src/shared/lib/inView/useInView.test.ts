import { renderHook } from '@testing-library/react'
import { act } from 'react'

import { useInView } from './useInView'

// Сохраняем дефолтный стаб из setup.ts до override и восстанавливаем после каждого кейса —
// изоляция между тест-кейсами внутри файла.
const original = window.IntersectionObserver

let savedCallback: IntersectionObserverCallback | null = null
let observedTarget: Element | null = null
const disconnect = vi.fn()

// Мок, который запоминает колбэк и НЕ вызывает его сам — срабатывание эмулируется вручную.
class ManualIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    savedCallback = callback
  }
  observe(target: Element) {
    observedTarget = target
  }
  unobserve() {}
  disconnect = disconnect
  takeRecords() {
    return []
  }
}

beforeEach(() => {
  savedCallback = null
  observedTarget = null
  disconnect.mockClear()
  window.IntersectionObserver =
    ManualIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  window.IntersectionObserver = original
})

const renderWithElement = () => {
  const element = document.createElement('div')
  return renderHook(() => {
    const result = useInView<HTMLDivElement>()
    // Эмулируем привязку ref к DOM-узлу до запуска эффекта.
    result.ref.current = element
    return result
  })
}

describe('useInView', () => {
  it('inView изначально false и становится true после пересечения; disconnect вызван один раз', () => {
    const { result } = renderWithElement()

    expect(result.current.inView).toBe(false)
    expect(observedTarget).not.toBeNull()

    act(() => {
      savedCallback?.(
        [
          {
            isIntersecting: true,
            target: observedTarget,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    expect(result.current.inView).toBe(true)
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('пересечение с isIntersecting: false не переключает inView', () => {
    const { result } = renderWithElement()

    act(() => {
      savedCallback?.(
        [
          {
            isIntersecting: false,
            target: observedTarget,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    expect(result.current.inView).toBe(false)
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('unmount до срабатывания вызывает disconnect (cleanup)', () => {
    const { unmount } = renderWithElement()

    expect(disconnect).not.toHaveBeenCalled()
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
