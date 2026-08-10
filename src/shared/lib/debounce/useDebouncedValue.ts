import { useEffect, useState } from "react"

/**
 * Возвращает `value`, обновлённое с задержкой `delayMs` после последнего изменения.
 * Быстрые последовательные изменения схлопываются — наружу уходит только финальное
 * значение, зафиксированное `delayMs` тишины. Таймер чистится при размонтировании
 * и при каждом новом изменении `value`.
 */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
