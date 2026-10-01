import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { server } from '../../../../test/setup'
import { CountrySelector } from './CountrySelector'

const mockDictionary = (names: string[]) => {
  server.use(
    http.get('*/v1.5/dictionary/countries', () =>
      HttpResponse.json({
        type: 'countries',
        total: names.length,
        items: names.map((name, i) => ({
          id: i,
          name,
          slug: null,
          enName: null,
        })),
      }),
    ),
  )
}

describe('CountrySelector', () => {
  it('до загрузки словаря показывает шорт-лист', async () => {
    mockDictionary(['США', 'Аргентина'])
    render(<CountrySelector selected={[]} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'USA' })).toBeInTheDocument()
    expect(screen.queryByText('Аргентина')).not.toBeInTheDocument()
    // Дожидаемся фоновой загрузки словаря, чтобы запрос не долетел в соседний тест.
    await screen.findByRole('button', { name: /Показать все/ })
  })

  it('«Показать все» открывает полный список из словаря', async () => {
    mockDictionary(['США', 'Аргентина', 'Чили'])
    const user = userEvent.setup()
    render(<CountrySelector selected={[]} onToggle={() => {}} />)

    const toggle = await screen.findByRole('button', {
      name: /Показать все.*Country/,
    })
    await user.click(toggle)
    await waitFor(() => {
      expect(screen.getByText('Аргентина')).toBeInTheDocument()
    })
    expect(screen.getByText('Чили')).toBeInTheDocument()
  })

  it('выбор вызывает onToggle с русским каноническим именем', async () => {
    mockDictionary(['США'])
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<CountrySelector selected={[]} onToggle={onToggle} />)

    await user.click(screen.getByRole('button', { name: 'USA' }))
    expect(onToggle).toHaveBeenCalledWith('США')
  })
})
