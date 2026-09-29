import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Once-триггер на `IntersectionObserver`: `inView` становится `true` при первом попадании
 * элемента под `ref` во viewport (с учётом `rootMargin`) и остаётся `true` навсегда —
 * повторный выход из viewport не отслеживается, чтобы lazy-смонтированная секция не
 * размонтировалась и не теряла состояние при скролле туда-обратно.
 *
 * `rootMargin` по умолчанию `'200px'` — упреждающий маунт до фактического входа во viewport,
 * чтобы не было заметного pop-in.
 *
 * На DOM-call-site параметр типа передавать явно (`useInView<HTMLDivElement>()`):
 * `RefObject<T>` инвариантен по `T`, и `RefObject<HTMLElement | null>` не присваивается
 * `Ref<HTMLDivElement>`.
 *
 * Известная граница: `threshold`-массив попадает в deps эффекта по ссылке — немемоизированный
 * внешний массив пересоздавал бы observer на каждом рендере (инлайн-литерал на месте вызова
 * мемоизирует React Compiler). Сериализация в стабильный ключ осознанно не делается.
 */
export const useInView = <T extends Element = HTMLElement>(
  options?: IntersectionObserverInit,
): { ref: RefObject<T | null>; inView: boolean } => {
  // Деструктурируем в примитивы: объект options целиком в deps пересоздавал бы observer
  // на каждом рендере (инлайн-литерал — новая ссылка).
  const { root = null, rootMargin = '200px', threshold } = options ?? {}
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    // Уже сработал — observer больше не нужен (иначе смена inView в deps пересоздала бы его).
    if (inView) return
    const element = ref.current
    if (!element) return

    let triggered = false
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          triggered = true
          observer.disconnect()
          setInView(true)
        }
      },
      { root, rootMargin, threshold },
    )
    observer.observe(element)

    // Cleanup нужен только если observer ещё не отключился сам по срабатыванию.
    return () => {
      if (!triggered) observer.disconnect()
    }
  }, [inView, root, rootMargin, threshold])

  return { ref, inView }
}
