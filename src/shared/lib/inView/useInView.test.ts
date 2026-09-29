import { renderHook } from '@testing-library/react'
import { act } from 'react'
import type { Mock } from 'vitest'

import { useInView } from './useInView'

// Сохраняем дефолтный стаб из setup.ts до override и восстанавливаем после каждого кейса —
// изоляция между тест-кейсами внутри файла.
const original = window.IntersectionObserver

type Instance = {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  target: Element | null
  disconnect: Mock<() => void>
}

let instances: Instance[] = []

// Мок, который запоминает колбэк/опции и НЕ вызывает колбэк сам — срабатывание эмулируется
// вручную через fire().
class ManualIntersectionObserver {
  private readonly instance: Instance

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.instance = {
      callback,
      options,
      target: null,
      disconnect: vi.fn<() => void>(),
    }
    instances.push(this.instance)
  }
  observe(target: Element) {
    this.instance.target = target
  }
  unobserve() {}
  disconnect() {
    this.instance.disconnect()
  }
  takeRecords() {
    return []
  }
}

beforeEach(() => {
  instances = []
  window.IntersectionObserver =
    ManualIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  window.IntersectionObserver = original
})

const fire = (instance: Instance, isIntersecting: boolean) => {
  act(() => {
    instance.callback(
      [
        {
          isIntersecting,
          target: instance.target,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )
  })
}

// Привязка callback-ref к DOM-узлу — так же, как это делает React при коммите <div ref>.
const renderAttached = (options?: { rootMargin?: string }) => {
  const element = document.createElement('div')
  const hook = renderHook(() => useInView<HTMLDivElement>(options))
  act(() => hook.result.current.ref(element))
  return { ...hook, element }
}

describe('useInView', () => {
  it('inView изначально false и становится true после пересечения; observer отключён', () => {
    const { result, element } = renderAttached()

    expect(result.current.inView).toBe(false)
    expect(instances).toHaveLength(1)
    expect(instances[0].target).toBe(element)

    fire(instances[0], true)

    expect(result.current.inView).toBe(true)
    expect(instances[0].disconnect).toHaveBeenCalled()
  })

  it('после срабатывания новый observer не создаётся', () => {
    const { result, rerender } = renderAttached()

    fire(instances[0], true)
    rerender()

    expect(result.current.inView).toBe(true)
    expect(instances).toHaveLength(1)
  })

  it('пересечение с isIntersecting: false не переключает inView', () => {
    const { result } = renderAttached()

    fire(instances[0], false)

    expect(result.current.inView).toBe(false)
    expect(instances[0].disconnect).not.toHaveBeenCalled()
  })

  it('unmount до срабатывания вызывает disconnect (cleanup)', () => {
    const { unmount } = renderAttached()

    expect(instances[0].disconnect).not.toHaveBeenCalled()
    unmount()
    expect(instances[0].disconnect).toHaveBeenCalledTimes(1)
  })

  it('rootMargin по умолчанию 200px, переданный — пробрасывается в observer', () => {
    renderAttached()
    renderAttached({ rootMargin: '0px' })

    expect(instances[0].options?.rootMargin).toBe('200px')
    expect(instances[1].options?.rootMargin).toBe('0px')
  })

  it('без привязанного узла observer не создаётся; узел, появившийся позже, наблюдается', () => {
    const { result } = renderHook(() => useInView<HTMLDivElement>())

    expect(instances).toHaveLength(0)

    const element = document.createElement('div')
    act(() => result.current.ref(element))

    expect(instances).toHaveLength(1)
    expect(instances[0].target).toBe(element)
  })

  it('ререндер с инлайн-литералом options не пересоздаёт observer', () => {
    const element = document.createElement('div')
    const { result, rerender } = renderHook(() =>
      useInView<HTMLDivElement>({ rootMargin: '100px' }),
    )
    act(() => result.current.ref(element))
    rerender()
    rerender()

    expect(instances).toHaveLength(1)
  })
})
