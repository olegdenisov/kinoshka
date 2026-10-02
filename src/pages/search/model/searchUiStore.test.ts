import { resetAllStores } from '@shared/lib'

import { useSearchUiStore } from './searchUiStore'

const state = () => useSearchUiStore.getState()

describe('useSearchUiStore', () => {
  it('по умолчанию шторки закрыты', () => {
    expect(state().filtersOpen).toBe(false)
    expect(state().sortOpen).toBe(false)
  })

  it('открывает и закрывает шторку фильтров', () => {
    state().openFilters()
    expect(state().filtersOpen).toBe(true)
    state().closeFilters()
    expect(state().filtersOpen).toBe(false)
  })

  it('открывает и закрывает шторку сортировки', () => {
    state().openSort()
    expect(state().sortOpen).toBe(true)
    state().closeSort()
    expect(state().sortOpen).toBe(false)
  })

  it('флаги независимы', () => {
    state().openFilters()
    expect(state().sortOpen).toBe(false)
    state().openSort()
    state().closeFilters()
    expect(state().sortOpen).toBe(true)
  })

  it('reset закрывает обе шторки', () => {
    state().openFilters()
    state().openSort()
    state().reset()
    expect(state().filtersOpen).toBe(false)
    expect(state().sortOpen).toBe(false)
  })

  it('resetAllStores закрывает шторки (регистрация в реестре)', () => {
    state().openFilters()
    resetAllStores()
    expect(state().filtersOpen).toBe(false)
  })
})
