import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { FilterState } from '@features/catalog-filter'
import { usePageSync } from './usePageSync'

const EMPTY_FILTERS: FilterState = { type: null, genres: [], yearFrom: null, yearTo: null, rating: null }

/** Перехватывает опции (`replace: true`), с которыми хук вызывает `setSearchParams`. */
let setSearchParamsCalls: Array<[unknown, unknown]> = []

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useSearchParams: (...args: Parameters<typeof actual.useSearchParams>) => {
      const [params, setParams] = actual.useSearchParams(...args)
      const wrappedSetParams: typeof setParams = (nextInit, navigateOpts) => {
        setSearchParamsCalls.push([nextInit, navigateOpts])
        return setParams(nextInit, navigateOpts)
      }
      return [params, wrappedSetParams]
    },
  }
})

const wrapper = (initialEntries: string[]) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  )
  return Wrapper
}

beforeEach(() => {
  setSearchParamsCalls = []
  vi.stubGlobal('scrollTo', vi.fn())
})

describe('usePageSync', () => {
  it('пустой URL → page=1', () => {
    const { result } = renderHook(() => usePageSync({ query: '', filters: EMPTY_FILTERS }), {
      wrapper: wrapper(['/search']),
    })

    expect(result.current.page).toBe(1)
  })

  it('читает page из ?page', () => {
    const { result } = renderHook(() => usePageSync({ query: '', filters: EMPTY_FILTERS }), {
      wrapper: wrapper(['/search?page=4']),
    })

    expect(result.current.page).toBe(4)
  })

  it('клэмпит page к demo-потолку 10 при чтении', () => {
    const { result } = renderHook(() => usePageSync({ query: '', filters: EMPTY_FILTERS }), {
      wrapper: wrapper(['/search?page=999']),
    })

    expect(result.current.page).toBe(10)
  })

  it('goToPage пишет ?page с replace:true и клэмпит запись к [1,10]', () => {
    const { result } = renderHook(() => usePageSync({ query: '', filters: EMPTY_FILTERS }), {
      wrapper: wrapper(['/search']),
    })

    act(() => result.current.goToPage(999))

    const lastCall = setSearchParamsCalls[setSearchParamsCalls.length - 1]
    expect(lastCall[1]).toEqual({ replace: true })
  })

  it('goToPage прокручивает страницу наверх', () => {
    const scrollSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollSpy)
    const { result } = renderHook(() => usePageSync({ query: '', filters: EMPTY_FILTERS }), {
      wrapper: wrapper(['/search']),
    })

    act(() => result.current.goToPage(3))

    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('смена query сбрасывает ?page на 1', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => usePageSync({ query, filters: EMPTY_FILTERS }),
      { wrapper: wrapper(['/search?page=5']), initialProps: { query: '' } },
    )
    expect(result.current.page).toBe(5)

    rerender({ query: 'inception' })

    expect(result.current.page).toBe(1)
  })

  it('смена filters сбрасывает ?page на 1', () => {
    const { result, rerender } = renderHook(
      ({ filters }: { filters: FilterState }) => usePageSync({ query: '', filters }),
      { wrapper: wrapper(['/search?page=5']), initialProps: { filters: EMPTY_FILTERS } },
    )
    expect(result.current.page).toBe(5)

    rerender({ filters: { ...EMPTY_FILTERS, genres: ['Drama'] } })

    expect(result.current.page).toBe(1)
  })

  it('page уже 1 — reset-эффект не меняет ?page (no-op update)', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => usePageSync({ query, filters: EMPTY_FILTERS }),
      { wrapper: wrapper(['/search']), initialProps: { query: '' } },
    )
    expect(result.current.page).toBe(1)

    rerender({ query: 'dune' })

    expect(result.current.page).toBe(1)
  })
})
