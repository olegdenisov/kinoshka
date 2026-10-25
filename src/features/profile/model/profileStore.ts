import { createPersistedStore } from '@shared/lib'

import { normalizeProfileName, profileNameSlot } from './profileStorage'

type ProfileState = {
  name: string
  // false — хранилище недоступно, имя осталось прежним
  setName: (next: string) => boolean
  clearName: () => boolean
}

// name стора для devtools — константа: имя профиля это пользовательский ввод, в devtools и в
// сообщения об ошибках оно не попадает (sentry.md).
export const useProfileStore = createPersistedStore<ProfileState, string>({
  name: 'profile',
  slot: profileNameSlot,
  select: state => state.name,
  merge: (name, state) => ({ ...state, name }),
  // Нормализация (trim/обрезка по code points/отсев невидимых имён) — в profileStorage.ts, рядом
  // со схемой чтения: они обязаны совпадать. maxLength на инпуте — лишь UI-хинт: значение может
  // прийти из автозаполнения/вставки. /profile — единственное место, показывающее ошибку
  // сохранения в UI, поэтому commit-результат возвращается наружу; clearName пишет '', а не
  // удаляет ключ — недоступное хранилище должно быть видно вызывающему.
  creator: commit => ({
    name: profileNameSlot.get(),
    setName: next => commit({ name: normalizeProfileName(next) }),
    clearName: () => commit({ name: '' }),
  }),
})
