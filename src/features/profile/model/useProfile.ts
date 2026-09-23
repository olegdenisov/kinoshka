import { useStorageSlot } from '@shared/lib'

import { getInitials } from '../lib/getInitials'
import { normalizeProfileName, profileNameSlot } from './profileStorage'

type UseProfileResult = {
  name: string
  initials: string
  setName: (next: string) => boolean
  clearName: () => boolean
}

export const useProfile = (): UseProfileResult => {
  const [name, setStoredName] = useStorageSlot(profileNameSlot)

  // Нормализация (trim/обрезка по code points/отсев невидимых имён) — в profileStorage.ts, рядом
  // со схемой чтения: они обязаны совпадать. maxLength на инпуте — лишь UI-хинт: значение может
  // прийти из автозаполнения/вставки. Возвращает false, если браузерное хранилище недоступно.
  const setName = (next: string): boolean =>
    setStoredName(normalizeProfileName(next))

  // set(''), а не remove(): remove() не диспатчит событие изменения, так что подписчики
  // useStorageSlot в текущей вкладке не перерисовались бы. Возвращает тот же boolean, что и
  // setName: недоступное хранилище должно быть видно вызывающему (Profile.tsx), а не тихо
  // проглатываться — иначе кнопка Clear name выглядела бы рабочей, ничего не делая.
  const clearName = (): boolean => setStoredName('')

  return { name, initials: getInitials(name), setName, clearName }
}
