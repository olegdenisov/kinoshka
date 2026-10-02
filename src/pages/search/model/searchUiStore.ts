import { registerStoreReset, withDevtools } from '@shared/lib'
import { create, type StateCreator } from 'zustand'

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
export const useSearchUiStore = create<SearchUiState>()(
  withDevtools('searchUi', initializer),
)

registerStoreReset(() => useSearchUiStore.getState().reset())
