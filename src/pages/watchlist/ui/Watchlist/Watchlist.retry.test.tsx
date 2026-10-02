import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { renderWithStore } from '../../../../test/renderWithStore'
import { server } from '../../../../test/setup'
import { Watchlist } from './Watchlist'

const STORAGE_KEY = 'kinoshka:watchlist'

beforeEach(() => localStorage.clear())

describe('Watchlist — Retry', () => {
  it('клик Retry перезапрашивает данные и показывает результат', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1]))
    let attempts = 0
    server.use(
      http.get('*/v1.5/movie/1', () => {
        attempts++
        if (attempts === 1) {
          return HttpResponse.json(
            { statusCode: 500, message: 'boom', error: 'boom' },
            { status: 500 },
          )
        }
        return HttpResponse.json({
          id: 1,
          name: 'Recovered Movie 1',
          year: 2024,
          type: 'movie',
          rating: { kp: 8.1, imdb: 7.9 },
          genres: [{ name: 'drama' }],
          movieLength: 120,
          poster: { previewUrl: 'https://example.com/poster.jpg' },
          persons: [],
          countries: [],
        })
      }),
    )

    renderWithStore(
      <MemoryRouter>
        <Watchlist />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(attempts).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))

    expect(await screen.findByText('Recovered Movie 1')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})
