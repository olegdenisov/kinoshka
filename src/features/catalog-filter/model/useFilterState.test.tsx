import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { EMPTY_FILTERS } from "../lib/searchParams"
import { useFilterState } from "./useFilterState"

/** Перехватывает опции (`replace: true`), с которыми хук вызывает `setSearchParams`. */
let setSearchParamsCalls: Array<[unknown, unknown]> = []

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router")
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
})

describe("useFilterState", () => {
  it("пустой URL → пустые фильтры, пустой sort, пустые activeChips", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search"]),
    })

    expect(result.current.filters).toEqual(EMPTY_FILTERS)
    expect(result.current.sort).toBe("")
    expect(result.current.activeChips).toEqual([])
  })

  it("читает фильтры из URL (?genres=Drama&yearFrom=2020)", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?genres=Drama&yearFrom=2020"]),
    })

    expect(result.current.filters).toEqual({
      ...EMPTY_FILTERS,
      genres: ["Drama"],
      yearFrom: 2020,
    })
  })

  it("читает sort из URL", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?sort=Newest"]),
    })

    expect(result.current.sort).toBe("Newest")
  })

  it("activeChips выводятся из URL-фильтров", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper([
        "/search?type=movie&genres=Drama,Action&yearFrom=2020&yearTo=2025&rating=7",
      ]),
    })

    const labels = result.current.activeChips.map((c) => c.label)
    expect(labels).toEqual([
      "Movies",
      "Drama",
      "Action",
      "2020–2025",
      "Rating 7+",
    ])
  })

  it('activeChips: только yearFrom задан (без yearTo) — лейбл не содержит "null"', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?yearFrom=2020"]),
    })

    const yearChip = result.current.activeChips.find((c) =>
      c.label.includes("2020"),
    )
    expect(yearChip?.label).toBe("2020+")
    expect(yearChip?.label).not.toContain("null")
  })

  it('activeChips: только yearTo задан (без yearFrom) — лейбл не содержит "null"', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?yearTo=2010"]),
    })

    const yearChip = result.current.activeChips.find((c) =>
      c.label.includes("2010"),
    )
    expect(yearChip?.label).toBe("–2010")
    expect(yearChip?.label).not.toContain("null")
  })

  it("activeChips onRemove: type-чип сбрасывает только type, оставляя остальные фильтры", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?type=movie&genres=Drama"]),
    })

    const typeChip = result.current.activeChips.find(
      (c) => c.label === "Movies",
    )!
    act(() => typeChip.onRemove())

    expect(result.current.filters).toEqual({
      ...EMPTY_FILTERS,
      genres: ["Drama"],
    })
  })

  it("activeChips onRemove: genre-чип убирает конкретный жанр (toggleGenre)", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?genres=Drama,Action"]),
    })

    const dramaChip = result.current.activeChips.find(
      (c) => c.label === "Drama",
    )!
    act(() => dramaChip.onRemove())

    expect(result.current.filters.genres).toEqual(["Action"])
  })

  it("activeChips onRemove: year-чип сбрасывает и yearFrom, и yearTo разом", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?yearFrom=2020&yearTo=2025"]),
    })

    const yearChip = result.current.activeChips.find(
      (c) => c.label === "2020–2025",
    )!
    act(() => yearChip.onRemove())

    expect(result.current.filters.yearFrom).toBeNull()
    expect(result.current.filters.yearTo).toBeNull()
  })

  it("activeChips onRemove: rating-чип сбрасывает rating", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?rating=7"]),
    })

    const ratingChip = result.current.activeChips.find(
      (c) => c.label === "Rating 7+",
    )!
    act(() => ratingChip.onRemove())

    expect(result.current.filters.rating).toBeNull()
  })

  it("toggleGenre добавляет жанр в ?genres с replace:true", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search"]),
    })

    act(() => result.current.toggleGenre("Drama"))

    expect(result.current.filters.genres).toEqual(["Drama"])
    const lastCall = setSearchParamsCalls.at(-1)
    expect(lastCall?.[1]).toEqual({ replace: true })
  })

  it("toggleGenre убирает жанр, если он уже активен", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?genres=Drama,Action"]),
    })

    act(() => result.current.toggleGenre("Drama"))

    expect(result.current.filters.genres).toEqual(["Action"])
  })

  it("setFilters пишет весь FilterState в URL с replace:true, не трогая ?q", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?q=matrix"]),
    })

    act(() =>
      result.current.setFilters({ ...EMPTY_FILTERS, type: "movie", rating: 8 }),
    )

    expect(result.current.filters).toEqual({
      ...EMPTY_FILTERS,
      type: "movie",
      rating: 8,
    })
    const lastCall = setSearchParamsCalls.at(-1)
    expect(lastCall?.[1]).toEqual({ replace: true })
  })

  it("setFilters принимает функцию-апдейтер (совместимость с useState-подобным API)", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?rating=5"]),
    })

    act(() => result.current.setFilters((f) => ({ ...f, rating: 9 })))

    expect(result.current.filters.rating).toBe(9)
  })

  it("resetFilters очищает фильтры с replace:true", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?type=movie&genres=Drama&rating=7"]),
    })

    act(() => result.current.resetFilters())

    expect(result.current.filters).toEqual(EMPTY_FILTERS)
    const lastCall = setSearchParamsCalls.at(-1)
    expect(lastCall?.[1]).toEqual({ replace: true })
  })

  it("setSort пишет ?sort с replace:true", () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search"]),
    })

    act(() => result.current.setSort("Highest rated"))

    expect(result.current.sort).toBe("Highest rated")
    const lastCall = setSearchParamsCalls.at(-1)
    expect(lastCall?.[1]).toEqual({ replace: true })
  })

  it('setSort("") очищает ?sort', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: wrapper(["/search?sort=Newest"]),
    })

    act(() => result.current.setSort(""))

    expect(result.current.sort).toBe("")
  })
})
