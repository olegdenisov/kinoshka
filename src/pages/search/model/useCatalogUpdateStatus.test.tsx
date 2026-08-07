import { renderHook, waitFor } from '@testing-library/react'
import type { FilterState } from '@features/catalog-filter'
import { useCatalogUpdateStatus } from './useCatalogUpdateStatus'

const EMPTY_FILTERS: FilterState = { type: null, genres: [], yearFrom: null, yearTo: null, rating: null }

describe('useCatalogUpdateStatus', () => {
  it('isUpdating=false, пока параметры не меняются между рендерами', () => {
    const { result } = renderHook(() =>
      useCatalogUpdateStatus({ query: '', filters: EMPTY_FILTERS, sort: '', page: 1 }),
    )

    expect(result.current.isUpdating).toBe(false)
    expect(result.current.deferredQuery).toBe('')
    expect(result.current.deferredPage).toBe(1)
  })

  it('смена query переводит isUpdating в true (stale deferredQuery), затем обратно в false с догнавшим deferredQuery', async () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useCatalogUpdateStatus({ query, filters: EMPTY_FILTERS, sort: '', page: 1 }),
      { initialProps: { query: 'inception' } },
    )

    expect(result.current.isUpdating).toBe(false)
    expect(result.current.deferredQuery).toBe('inception')

    rerender({ query: 'inception 2' })

    // React ещё не догнал новое live-значение — либо мы застаём переходное isUpdating=true
    // со старым deferredQuery, либо (если React синхронно проскочил обе фазы в act()) сразу
    // конечное состояние. Важно зафиксировать именно конечный результат ниже.
    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false)
    })
    expect(result.current.deferredQuery).toBe('inception 2')
  })

  it('смена page/filters/sort тоже отражается в deferred-полях после обновления', async () => {
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useCatalogUpdateStatus({ query: '', filters: EMPTY_FILTERS, sort: 'Newest', page }),
      { initialProps: { page: 1 } },
    )

    rerender({ page: 2 })

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false)
    })
    expect(result.current.deferredPage).toBe(2)
    expect(result.current.deferredSort).toBe('Newest')
  })

  it('фиксирует переходное isUpdating=true между сменой live-значения и тем, как deferred его догонит', async () => {
    const seenUpdatingStates: boolean[] = []
    const { rerender } = renderHook(
      ({ query }: { query: string }) => {
        const status = useCatalogUpdateStatus({ query, filters: EMPTY_FILTERS, sort: '', page: 1 })
        seenUpdatingStates.push(status.isUpdating)
        return status
      },
      { initialProps: { query: 'a' } },
    )

    rerender({ query: 'ab' })

    await waitFor(() => {
      expect(seenUpdatingStates[seenUpdatingStates.length - 1]).toBe(false)
    })

    // Где-то между первым и последним рендером isUpdating обязано было побывать true —
    // иначе deferred-значение обновилось бы синхронно и индикатор был бы бесполезен.
    expect(seenUpdatingStates).toContain(true)
  })

  it('одновременное изменение query+filters+sort+page в одном рендере (напр. вход в поиск, Task 2) переводит isUpdating в true и в итоге догоняет ВСЕ 4 поля разом', async () => {
    const filtersA: FilterState = EMPTY_FILTERS
    const filtersB: FilterState = { ...EMPTY_FILTERS, genres: ['Drama'] }

    const { result, rerender } = renderHook(
      (props: { query: string; filters: FilterState; sort: string; page: number }) =>
        useCatalogUpdateStatus(props),
      { initialProps: { query: 'a', filters: filtersA, sort: '', page: 1 } },
    )

    expect(result.current.isUpdating).toBe(false)

    rerender({ query: 'ab', filters: filtersB, sort: 'Newest', page: 2 })

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false)
    })

    expect(result.current.deferredQuery).toBe('ab')
    expect(result.current.deferredFilters).toBe(filtersB)
    expect(result.current.deferredSort).toBe('Newest')
    expect(result.current.deferredPage).toBe(2)
  })

  it('одновременное изменение всех 4 полей не даёт "смешанного" промежуточного состояния — deferred* либо все старые, либо все новые, никогда часть-старая-часть-новая', async () => {
    const filtersA: FilterState = EMPTY_FILTERS
    const filtersB: FilterState = { ...EMPTY_FILTERS, genres: ['Drama'] }
    const seen: Array<{ q: string; f: FilterState; s: string; p: number }> = []

    const { rerender } = renderHook(
      (props: { query: string; filters: FilterState; sort: string; page: number }) => {
        const status = useCatalogUpdateStatus(props)
        seen.push({
          q: status.deferredQuery,
          f: status.deferredFilters,
          s: status.deferredSort,
          p: status.deferredPage,
        })
        return status
      },
      { initialProps: { query: 'a', filters: filtersA, sort: '', page: 1 } },
    )

    rerender({ query: 'ab', filters: filtersB, sort: 'Newest', page: 2 })

    await waitFor(() => {
      const last = seen[seen.length - 1]
      expect(last).toEqual({ q: 'ab', f: filtersB, s: 'Newest', p: 2 })
    })

    seen.forEach((snapshot) => {
      const isAllOld = snapshot.q === 'a' && snapshot.f === filtersA && snapshot.s === '' && snapshot.p === 1
      const isAllNew =
        snapshot.q === 'ab' && snapshot.f === filtersB && snapshot.s === 'Newest' && snapshot.p === 2
      expect(isAllOld || isAllNew).toBe(true)
    })
  })
})
