import { useStorageSlot } from '@shared/lib'

import { watchlistSlot } from './watchlistStorage'

export const useWatchlist = () => {
  const [ids, setIds] = useStorageSlot(watchlistSlot)

  return {
    ids,
    isInWatchlist: (id: number) => ids.includes(id),
    // Читаем актуальное значение из слота, а не из замыкания: два toggle подряд в одном
    // тике не должны затирать друг друга. При недоступном хранилище set() вернёт false
    // и подписчики не уведомляются — состояние остаётся прежним.
    toggle: (id: number) => {
      const current = watchlistSlot.get()
      setIds(
        current.includes(id)
          ? current.filter(existingId => existingId !== id)
          : [...current, id],
      )
    },
  }
}
