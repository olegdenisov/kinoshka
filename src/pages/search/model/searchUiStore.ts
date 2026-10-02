import { registerStoreReset } from '@shared/lib'
import { create, type StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'

type SearchUiState = {
  filtersOpen: boolean
  sortOpen: boolean
  openFilters: () => void
  closeFilters: () => void
  openSort: () => void
  closeSort: () => void
  reset: () => void
}

const INITIAL = { filtersOpen: false, sortOpen: false }

const initializer: StateCreator<SearchUiState> = set => ({
  ...INITIAL,
  openFilters: () => set({ filtersOpen: true }),
  closeFilters: () => set({ filtersOpen: false }),
  openSort: () => set({ sortOpen: true }),
  closeSort: () => set({ sortOpen: false }),
  reset: () => set(INITIAL),
})

// Фильтры, сортировка и страница живут в URL (ссылки, back/forward) — useFilterState не
// трогаем. В сторе только то, чего в URL нет: открытость шторок. Стор без persist: после
// перезагрузки шторки закрыты. Стор module-level, поэтому Search вызывает reset при уходе со
// страницы — иначе шторка «вспомнит» открытость после возврата на /search.
// devtools только в DEV: `enabled` не вырезает middleware из прод-сборки, ветка по DEV — вырезает.
export const useSearchUiStore = import.meta.env.DEV
  ? create<SearchUiState>()(
      devtools(initializer, {
        name: 'searchUi',
      }) as unknown as typeof initializer,
    )
  : create<SearchUiState>()(initializer)

registerStoreReset(() => useSearchUiStore.getState().reset())
