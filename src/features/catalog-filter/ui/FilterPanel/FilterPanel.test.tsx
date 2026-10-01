import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'

import { server } from '../../../../test/setup'
import { EMPTY_FILTERS } from '../../lib/searchParams'
import type { FilterState } from '../../model/useFilterState'
import { FilterPanel } from './FilterPanel'

const details = (title: string) =>
  screen.getByText(title).closest('details') as HTMLDetailsElement

const open = async (
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) => {
  await user.click(screen.getByText(title))
  await waitFor(() => expect(details(title).open).toBe(true))
}

// Словарь жанров с «лишним» жанром: по кнопке «Показать все» ждём конца фонового fetch,
// чтобы запрос не долетел в соседний тест.
const settleGenres = () => {
  server.use(
    http.get('*/v1.5/dictionary/genres', () =>
      HttpResponse.json({
        type: 'genres',
        total: 2,
        items: [
          { id: 1, name: 'драма', slug: null, enName: null },
          { id: 2, name: 'экзотика', slug: null, enName: null },
        ],
      }),
    ),
  )
}

const setup = (filters: FilterState = EMPTY_FILTERS, disabled?: boolean) => {
  settleGenres()
  const onFiltersChange = vi.fn()
  const user = userEvent.setup()
  render(
    <FilterPanel
      filters={filters}
      onFiltersChange={onFiltersChange}
      disabled={disabled}
    />,
  )
  return { onFiltersChange, user }
}

describe('FilterPanel', () => {
  it('базовые группы открыты, новые закрыты', async () => {
    setup()
    for (const t of ['Genre', 'Year', 'Rating']) {
      expect(details(t).open).toBe(true)
    }
    for (const t of ['Country', 'Duration', 'Streaming', 'Collection']) {
      expect(details(t).open).toBe(false)
    }
    // Фоновый fetch словаря жанров не должен долететь в соседний тест.
    await screen.findByRole('button', { name: /Показать все.*Genre/ })
  })

  it('группа с активным значением открыта и показывает счётчик', async () => {
    setup({ ...EMPTY_FILTERS, duration: 'long', list: 'top250' })
    expect(details('Duration').open).toBe(true)
    expect(details('Collection').open).toBe(true)
    expect(details('Duration')).toHaveTextContent('1')
    expect(
      screen.getByRole('button', { name: 'Over 2 hours' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await screen.findByRole('button', { name: /Показать все.*Genre/ })
  })

  it('кнопка рейтинга вызывает onFiltersChange', async () => {
    const { onFiltersChange, user } = setup()
    await user.click(screen.getByRole('button', { name: '7+' }))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      rating: 7,
    })
    await screen.findByRole('button', { name: /Показать все.*Genre/ })
  })

  it('выбор в каждой новой группе даёт ожидаемый FilterState', async () => {
    const { onFiltersChange, user } = setup()

    await open(user, 'Country')
    await user.click(screen.getByRole('button', { name: 'USA' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...EMPTY_FILTERS,
      countries: ['США'],
    })

    await open(user, 'Duration')
    await user.click(screen.getByRole('button', { name: '90–120 min' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...EMPTY_FILTERS,
      duration: 'medium',
    })

    await open(user, 'Streaming')
    await user.click(screen.getByRole('button', { name: 'Ivi' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...EMPTY_FILTERS,
      platforms: ['Иви'],
    })

    await open(user, 'Collection')
    await user.click(screen.getByRole('button', { name: 'Top 250' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...EMPTY_FILTERS,
      list: 'top250',
    })
  })

  it('повторный клик по активной длительности и подборке сбрасывает в null', async () => {
    const filters = {
      ...EMPTY_FILTERS,
      duration: 'short',
      list: 'top500',
    } as const
    const { onFiltersChange, user } = setup(filters)

    await user.click(screen.getByRole('button', { name: 'Under 90 min' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...filters,
      duration: null,
    })

    await user.click(screen.getByRole('button', { name: 'Top 500' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, list: null })
  })

  it('disabled блокирует контролы', async () => {
    const { user } = setup({ ...EMPTY_FILTERS, duration: 'short' }, true)
    expect(screen.getByRole('button', { name: '5+' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Under 90 min' })).toBeDisabled()
    await open(user, 'Streaming')
    expect(screen.getByRole('button', { name: 'Okko' })).toBeDisabled()
    await screen.findByRole('button', { name: /Показать все.*Genre/ })
  })

  it('закрытая группа Country не запрашивает словарь стран', async () => {
    let requests = 0
    server.use(
      http.get('*/v1.5/dictionary/countries', () => {
        requests += 1
        return HttpResponse.json({ type: 'countries', total: 0, items: [] })
      }),
    )
    setup()
    await screen.findByRole('button', { name: /Показать все.*Genre/ })
    expect(requests).toBe(0)
  })
})
