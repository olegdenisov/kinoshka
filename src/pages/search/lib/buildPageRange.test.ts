import { buildPageRange, clampPage } from './buildPageRange'

describe('clampPage', () => {
  it('page внутри диапазона — не меняется', () => {
    expect(clampPage(5, 10)).toBe(5)
  })

  it('page < 1 — клэмпится к 1', () => {
    expect(clampPage(0, 10)).toBe(1)
    expect(clampPage(-5, 10)).toBe(1)
  })

  it('page > totalPages — клэмпится к totalPages', () => {
    expect(clampPage(999, 5)).toBe(5)
  })

  it('totalPages < 1 — минимум 1 (не 0/отрицательное)', () => {
    expect(clampPage(1, 0)).toBe(1)
    expect(clampPage(5, -3)).toBe(1)
  })
})

describe('buildPageRange', () => {
  it('строит диапазон вокруг текущей страницы с эллипсисами по краям', () => {
    expect(buildPageRange(5, 10)).toEqual([1, '…L', 4, 5, 6, '…R', 10])
  })

  it('totalPages=1 — только страница 1, без эллипсисов', () => {
    expect(buildPageRange(1, 1)).toEqual([1])
  })

  it('без разрыва слева, когда текущая страница близко к началу', () => {
    expect(buildPageRange(2, 10)).toEqual([1, 2, 3, '…R', 10])
  })

  it('без разрыва справа, когда текущая страница близко к концу', () => {
    expect(buildPageRange(9, 10)).toEqual([1, '…L', 8, 9, 10])
  })

  it('page > totalPages — клэмпится, не крашит', () => {
    expect(buildPageRange(999, 5)).toEqual([1, '…L', 4, 5])
  })
})
