import { useStorageSlot } from '@shared/lib'

import { watchedSlot } from './watchedStorage'

export const useWatched = () => {
  const [ids, setIds] = useStorageSlot(watchedSlot)

  return {
    ids,
    isWatched: (id: number) => ids.includes(id),
    // Читаем актуальное значение из слота, а не из замыкания: два toggle подряд в одном
    // тике не должны затирать друг друга. При недоступном хранилище set() вернёт false
    // и подписчики не уведомляются — состояние остаётся прежним.
    toggle: (id: number) => {
      const current = watchedSlot.get()
      setIds(
        current.includes(id)
          ? current.filter(existingId => existingId !== id)
          : [...current, id],
      )
    },
  }
}
