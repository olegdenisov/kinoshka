import { AsyncBoundary } from '@shared/ui'
import { act, cleanup, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { invalidatePersonDetail, usePersonDetail } from './usePersonDetail'

const personDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Person',
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

const mockPersonError = (id: number, status: number) => {
  server.use(
    http.get(`*/v1.5/person/${id}`, () =>
      HttpResponse.json(
        { statusCode: status, message: 'error', error: 'error' },
        { status },
      ),
    ),
  )
}

const Probe = ({ id }: { id: number }) => {
  const person = usePersonDetail(id)
  return <span data-testid='name'>{person.name}</span>
}

const renderProbe = async (id: number) => {
  await act(async () => {
    render(
      <AsyncBoundary>
        <Probe id={id} />
      </AsyncBoundary>,
    )
  })
}

describe('usePersonDetail — успешная загрузка', () => {
  it('после резолва в DOM видно имя персоны', async () => {
    mockPerson(801, { name: 'Anna Actress' })

    await renderProbe(801)

    expect(screen.getByTestId('name')).toHaveTextContent('Anna Actress')
  })
})

describe('usePersonDetail — ошибочный путь', () => {
  it('404 пробрасывается в ErrorBoundary, а не глотается', async () => {
    mockPersonError(802, 404)

    await renderProbe(802)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByTestId('name')).not.toBeInTheDocument()
  })
})

describe('usePersonDetail — стабильность промиса', () => {
  it('повторный рендер не вызывает повторный сетевой запрос', async () => {
    let requests = 0
    server.use(
      http.get('*/v1.5/person/803', () => {
        requests += 1

        return HttpResponse.json(personDoc(803))
      }),
    )

    const { rerender } = render(
      <AsyncBoundary>
        <Probe id={803} />
      </AsyncBoundary>,
    )
    await act(async () => {
      rerender(
        <AsyncBoundary>
          <Probe id={803} />
        </AsyncBoundary>,
      )
    })
    await act(async () => {
      rerender(
        <AsyncBoundary>
          <Probe id={803} />
        </AsyncBoundary>,
      )
    })

    expect(screen.getByTestId('name')).toHaveTextContent('Test Person')
    expect(requests).toBe(1)
  })
})

describe('invalidatePersonDetail', () => {
  it('после инвалидации следующий вызов снова ходит в сеть', async () => {
    let requests = 0
    server.use(
      http.get('*/v1.5/person/804', () => {
        requests += 1

        return HttpResponse.json(personDoc(804, { name: 'Before' }))
      }),
    )

    await renderProbe(804)
    expect(screen.getByTestId('name')).toHaveTextContent('Before')
    expect(requests).toBe(1)

    cleanup()
    invalidatePersonDetail(804)

    server.use(
      http.get('*/v1.5/person/804', () => {
        requests += 1

        return HttpResponse.json(personDoc(804, { name: 'After' }))
      }),
    )

    await renderProbe(804)
    expect(screen.getByTestId('name')).toHaveTextContent('After')
    expect(requests).toBe(2)
  })
})
