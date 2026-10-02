import { act, fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { seedStorage } from '../../../../test/seedStorage'
import { server } from '../../../../test/setup'
import { Favorites } from './Favorites'

// Отдельный файл от Favorites.test.tsx: здесь счётчик сетевых запросов к одному id, а не набор сценариев.
// Первый ответ 500, затем успех — Retry (refetch стора) обязан реально перезапросить упавший
// detail, а не реплеить закешированную ошибку (fetch() не реплеит ошибки, см. createQueryStore).
const STORAGE_KEY = 'kinoshka:favorites'

let attempts = 0

beforeEach(() => {
  localStorage.clear()
  attempts = 0
  server.use(
    http.get('*/v1.5/movie/1', () => {
      attempts++
      if (attempts === 1) {
        return HttpResponse.json(
          { statusCode: 500, message: 'Network error', error: 'err' },
          { status: 500 },
        )
      }

      return HttpResponse.json({
        id: 1,
        name: 'Recovered Movie 1',
        year: 2024,
        type: 'movie',
        rating: { kp: 7.5, imdb: 7.5 },
        genres: [{ name: 'drama' }],
        movieLength: 120,
        poster: { previewUrl: 'https://example.com/poster.jpg' },
        persons: [],
        countries: [],
      })
    }),
  )
})

describe('Favorites — Retry перезапрашивает упавший запрос', () => {
  it('клик Retry повторно запрашивает данные и показывает их', async () => {
    seedStorage(STORAGE_KEY, JSON.stringify([1]))

    await act(async () => {
      render(
        <MemoryRouter>
          <Favorites />
        </MemoryRouter>,
      )
    })

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(attempts).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    })

    expect(await screen.findByText('Recovered Movie 1')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})
