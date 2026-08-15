import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../../test/setup'
import { GenreSelector } from './GenreSelector'

const ENDPOINT = '*/v1.5/dictionary/genres'

const dictionaryItem = (name: string) => ({
  id: 1,
  name,
  slug: null,
  enName: null,
})

const mockDictionary = (names: string[]) => {
  server.use(
    http.get(ENDPOINT, () =>
      HttpResponse.json({
        type: 'genres',
        total: names.length,
        items: names.map(dictionaryItem),
      }),
    ),
  )
}

const STATIC_SHORTLIST_LABELS = [
  'Action',
  'Drama',
  'Thriller',
  'Horror',
  'Fantasy',
  'Adventure',
]

describe('GenreSelector', () => {
  it('по умолчанию рендерится статический шорт-лист (6 чипов)', async () => {
    mockDictionary([
      'боевик',
      'драма',
      'триллер',
      'ужасы',
      'фэнтези',
      'приключения',
    ])

    render(<GenreSelector selected={[]} onToggle={vi.fn()} />)

    STATIC_SHORTLIST_LABELS.forEach(label => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })
    expect(screen.queryByText(/Показать все/)).not.toBeInTheDocument()

    // даём фоновому фетчу осесть, чтобы он не долетел уже после конца теста
    await waitFor(() => {
      STATIC_SHORTLIST_LABELS.forEach(label => {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      })
    })
  })

  it('жанр из selected, не входящий в шорт-лист, тоже отрисован и подсвечен как активный', async () => {
    mockDictionary([
      'боевик',
      'драма',
      'триллер',
      'ужасы',
      'фэнтези',
      'приключения',
    ])

    render(<GenreSelector selected={['аниме']} onToggle={vi.fn()} />)

    const chip = screen.getByRole('button', { name: 'аниме' })
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'аниме' })).toBeInTheDocument()
    })
  })

  it('«Показать все» раскрывает остальное и сворачивает обратно', async () => {
    mockDictionary([
      'боевик',
      'драма',
      'триллер',
      'ужасы',
      'фэнтези',
      'приключения',
      'комедия',
    ])

    render(<GenreSelector selected={[]} onToggle={vi.fn()} />)

    const toggle = await screen.findByRole('button', {
      name: 'Показать все (1)',
    })
    expect(
      screen.queryByRole('button', { name: 'комедия' }),
    ).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'комедия' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Свернуть' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Свернуть' }))

    expect(
      screen.queryByRole('button', { name: 'комедия' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Показать все (1)' }),
    ).toBeInTheDocument()
  })

  it('выбор чипа вызывает onToggle', async () => {
    mockDictionary([
      'боевик',
      'драма',
      'триллер',
      'ужасы',
      'фэнтези',
      'приключения',
    ])
    const onToggle = vi.fn()

    render(<GenreSelector selected={[]} onToggle={onToggle} />)

    fireEvent.click(screen.getByRole('button', { name: 'Action' }))

    expect(onToggle).toHaveBeenCalledWith('боевик')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })
  })

  it('disabled проп дизейблит все кнопки-чипы', async () => {
    mockDictionary([
      'боевик',
      'драма',
      'триллер',
      'ужасы',
      'фэнтези',
      'приключения',
    ])

    render(<GenreSelector selected={[]} onToggle={vi.fn()} disabled />)

    STATIC_SHORTLIST_LABELS.forEach(label => {
      expect(screen.getByRole('button', { name: label })).toBeDisabled()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Action' })).toBeDisabled()
    })
  })

  it('после подгрузки справочника (MSW) список расширяется реальными данными', async () => {
    mockDictionary([
      'боевик',
      'драма',
      'триллер',
      'ужасы',
      'фэнтези',
      'приключения',
      'комедия',
    ])

    render(<GenreSelector selected={[]} onToggle={vi.fn()} />)

    expect(screen.queryByText(/Показать все/)).not.toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Показать все (1)' }),
      ).toBeInTheDocument()
    })
  })
})
