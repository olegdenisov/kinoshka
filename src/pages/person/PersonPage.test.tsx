import { act, fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { renderWithRouter } from '../../test/router'
import { server } from '../../test/setup'
import { PersonPage } from './PersonPage'

const personDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Anna Actress',
  enName: 'Anna Actress EN',
  photo: 'https://avatars.mds.yandex.net/photo.jpg',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const mockPerson = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/person/${id}`, () =>
      HttpResponse.json(personDoc(id, overrides)),
    ),
  )
}

const renderPersonPage = async (initialEntry: string) => {
  let result: ReturnType<typeof renderWithRouter> | undefined

  await act(async () => {
    // id приходит пропом из render роута; здесь — сырой сегмент пути, как его отдаёт роут.
    result = renderWithRouter(
      <PersonPage id={decodeURIComponent(initialEntry.split('/')[2] ?? '')} />,
      { url: initialEntry },
    )
  })

  return result!
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('PersonPage — невалидный id', () => {
  it('/person/abc — рендерит not-found без сетевого запроса', async () => {
    // Ни один MSW-хендлер не зарегистрирован — onUnhandledRequest: 'error'
    // завалит тест, если компонент всё же попытается сделать запрос.
    await renderPersonPage('/person/abc')

    expect(await screen.findByText('Person not found')).toBeInTheDocument()
    expect(
      screen.getByText("This person doesn't exist or was removed."),
    ).toBeInTheDocument()
  })

  it('/person/0 — рендерит not-found без сетевого запроса', async () => {
    await renderPersonPage('/person/0')

    expect(await screen.findByText('Person not found')).toBeInTheDocument()
  })

  it('/person/-1 — рендерит not-found без сетевого запроса', async () => {
    await renderPersonPage('/person/-1')

    expect(await screen.findByText('Person not found')).toBeInTheDocument()
  })
})

describe('PersonPage — /person/1, пока запрос не завершён', () => {
  it('показывает PersonDetailSkeleton, а не реальные данные', () => {
    // Хендлер, который никогда не резолвится — фиксируем состояние
    // "запрос ушёл, ответа нет".
    server.use(http.get('*/v1.5/person/1', () => new Promise(() => {})))

    const { container } = renderWithRouter(<PersonPage id='1' />, {
      url: '/person/1',
    })

    expect(container.querySelector('[class*="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByText('Anna Actress')).not.toBeInTheDocument()
  })
})

describe('PersonPage — /person/1 happy path', () => {
  it('показывает имя персоны после резолва MSW', async () => {
    mockPerson(1)

    const result = await renderPersonPage('/person/1')

    expect(screen.getByText('Anna Actress')).toBeInTheDocument()
    expect(
      result.container.querySelector('[class*="skeleton"]'),
    ).not.toBeInTheDocument()
  })
})

describe('PersonPage — /person/666 не найден (404)', () => {
  it('рендерит ErrorState с not-found текстом и рабочей кнопкой retry (реальный повторный запрос без ожидания cooldown)', async () => {
    let requestCount = 0
    server.use(
      http.get('*/v1.5/person/666', () => {
        requestCount++
        return HttpResponse.json(
          {
            statusCode: 404,
            message: 'Not found person with id 666',
            error: 'Not Found',
          },
          { status: 404 },
        )
      }),
    )

    await renderPersonPage('/person/666')

    expect(await screen.findByText('Person not found')).toBeInTheDocument()
    expect(
      screen.getByText("This person doesn't exist or was removed."),
    ).toBeInTheDocument()
    expect(requestCount).toBe(1)

    const retryButton = screen.getByRole('button', {
      name: 'Попробовать снова',
    })

    // invalidatePersonDetail инвалидирует кэш-запись до reset(), поэтому клик
    // реально уходит в сеть сразу, без ожидания ERROR_CACHE_TTL_MS (20с) cooldown.
    await act(async () => {
      fireEvent.click(retryButton)
    })

    expect(await screen.findByText('Person not found')).toBeInTheDocument()
    expect(requestCount).toBe(2)
  })
})

describe('PersonPage — /person/888 общая ошибка (500) → Retry', () => {
  it('клик Retry делает реальный повторный запрос без ожидания 20с, рендерит данные', async () => {
    let requestCount = 0
    server.use(
      http.get('*/v1.5/person/888', () => {
        requestCount++
        return HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'error' },
          { status: 500 },
        )
      }),
    )

    await renderPersonPage('/person/888')

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByText('Person not found')).not.toBeInTheDocument()
    expect(requestCount).toBe(1)

    server.use(
      http.get('*/v1.5/person/888', () => {
        requestCount++
        return HttpResponse.json(personDoc(888, { name: 'Recovered Person' }))
      }),
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    })

    // Без реальной инвалидации кэша этот клик отдал бы тот же rejected-промис
    // из ERROR_CACHE_TTL_MS cooldown (20с), и ErrorState остался бы на месте —
    // сеть бы не была тронута (requestCount остался бы 1).
    expect(requestCount).toBe(2)
    expect(await screen.findByText('Recovered Person')).toBeInTheDocument()
  })
})
