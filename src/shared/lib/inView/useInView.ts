import { useEffect, useState } from 'react'

type UseInViewOptions = {
  rootMargin?: string
}

/**
 * Once-триггер на `IntersectionObserver`: `inView` становится `true` при первом попадании
 * элемента под `ref` во viewport (с учётом `rootMargin`) и остаётся `true` навсегда —
 * повторный выход из viewport не отслеживается, чтобы lazy-смонтированная секция не
 * размонтировалась и не теряла состояние при скролле туда-обратно.
 *
 * `rootMargin` по умолчанию `'200px'` — упреждающий маунт до фактического входа во viewport,
 * чтобы не было заметного pop-in.
 *
 * `ref` — callback-ref: узел хранится в state и входит в deps эффекта, поэтому observer
 * создаётся и тогда, когда элемент появляется не на первом коммите (условный рендер).
 */
export const useInView = <T extends Element = HTMLElement>({
  rootMargin = '200px',
}: UseInViewOptions = {}): {
  ref: (node: T | null) => void
  inView: boolean
} => {
  const [node, setNode] = useState<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (inView || !node) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect()
          setInView(true)
        }
      },
      { rootMargin },
    )
    observer.observe(node)

    return () => observer.disconnect()
  }, [inView, node, rootMargin])

  return { ref: setNode, inView }
}
