import { useDispatch, useSelector, useStore } from 'react-redux'

import { getInitials } from '../lib/getInitials'
import { nameSet, selectName } from './profileSlice'
import type { ProfileRootState } from './profileSlice'
import { normalizeProfileName } from './profileStorage'

type UseProfileResult = {
  name: string
  initials: string
  setName: (next: string) => boolean
  clearName: () => boolean
}

export const useProfile = (): UseProfileResult => {
  const name = useSelector((state: ProfileRootState) => selectName(state))
  const dispatch = useDispatch()
  const store = useStore<ProfileRootState>()

  // Эффект persist-listener'а стартует синхронно внутри dispatch (см. persistSlice): при отказе
  // записи откат уже применён к моменту возврата, поэтому сравнение стейта с ожидаемым значением
  // даёт boolean-результат. Если значение совпало с текущим, откат неотличим от успеха — это
  // безвредно: стейт и так верный.
  const commit = (next: string): boolean => {
    dispatch(nameSet(next))
    return selectName(store.getState()) === next
  }

  // Нормализация (trim/обрезка по code points/отсев невидимых имён) — в profileStorage.ts, рядом
  // со схемой чтения: они обязаны совпадать. maxLength на инпуте — лишь UI-хинт: значение может
  // прийти из автозаполнения/вставки. Возвращает false, если браузерное хранилище недоступно.
  const setName = (next: string): boolean => commit(normalizeProfileName(next))

  // Тот же boolean, что у setName: недоступное хранилище должно быть видно вызывающему
  // (Profile.tsx), а не тихо проглатываться — иначе кнопка Clear name выглядела бы рабочей,
  // ничего не делая.
  const clearName = (): boolean => commit('')

  return { name, initials: getInitials(name), setName, clearName }
}
