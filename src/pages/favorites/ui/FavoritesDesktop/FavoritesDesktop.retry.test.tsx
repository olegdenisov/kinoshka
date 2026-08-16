import type * as EntitiesMovie from '@entities/movie'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

import { FavoritesDesktop } from './FavoritesDesktop'

// Мокаем весь `getMoviesByIds` (а не MSW-эндпоинт) для точного контроля тайминга —
// реальная композиция (см. getMoviesByIds.ts) тоже умеет реджектиться при полном отказе
// (см. FavoritesDesktop.test.tsx — «полный отказ загрузки (сетевая/5xx ошибка)»), но здесь
// нужно детерминированно проверить именно порядок вызовов invalidate→refetch, а не сам факт
// реджекта. Мок ведёт себя как упрощённый `createCachedFetcher`: кэширует промис по
// `JSON.stringify(ids)`, счётчик `fetchAttempts` растёт только на реальный промах кэша — так
// тест проверяет то же самое свойство, что и `MoviePage.test.tsx` для Retry: `invalidate`
// вызывается ДО повторного запроса.
const { invalidate, getMoviesByIdsMock, getFetchAttempts } = vi.hoisted(() => {
  const cache = new Map<string, Promise<unknown>>()
  let fetchAttempts = 0

  const getMoviesByIdsMock = (ids: number[]) => {
    const key = JSON.stringify(ids)
    if (!cache.has(key)) {
      fetchAttempts++
      const promise =
        fetchAttempts === 1
          ? Promise.reject(new Error('Network error'))
          : Promise.resolve([
              {
                id: ids[0],
                title: `Recovered Movie ${ids[0]}`,
                poster: 'https://example.com/poster.jpg',
                year: 2024,
                rating: 7.5,
                genre: ['Drama'],
                runtime: '120 min',
                hue: 20,
                type: 'movie',
              },
            ])
      cache.set(key, promise)
    }
    return cache.get(key)
  }

  const invalidate = vi.fn((ids: number[]) => {
    cache.delete(JSON.stringify(ids))
  })

  return {
    invalidate,
    getMoviesByIdsMock,
    getFetchAttempts: () => fetchAttempts,
  }
})

vi.mock('@entities/movie', async importOriginal => {
  const actual = await importOriginal<typeof EntitiesMovie>()
  return {
    ...actual,
    getMoviesByIds: Object.assign(getMoviesByIdsMock, {
      invalidate,
      clear: vi.fn(),
    }),
  }
})

const FAVORITES_KEY = 'kinoshka:favorites'

beforeEach(() => {
  localStorage.clear()
  invalidate.mockClear()
})

describe('FavoritesDesktop — Retry реально переинвалидирует кэш и повторяет запрос', () => {
  it('клик Retry вызывает invalidate и повторно запрашивает данные', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([1]))

    await act(async () => {
      render(
        <MemoryRouter>
          <FavoritesDesktop />
        </MemoryRouter>,
      )
    })

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(getFetchAttempts()).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    })

    expect(invalidate).toHaveBeenCalledWith([1])
    expect(getFetchAttempts()).toBe(2)
    expect(await screen.findByText('Recovered Movie 1')).toBeInTheDocument()
  })
})
