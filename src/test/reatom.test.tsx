// Проверки тестовой обвязки Reatom (src/test/setup.ts) и конвенции reatomComponent, на которые
// опираются все задачи миграции. Тесты внутри describe зависят от порядка: второй тест
// проверяет, что первый не оставил следов после общего afterEach.
import {
  abortVar,
  action,
  atom,
  computed,
  isConnected,
  sleep,
  urlAtom,
  withAbort,
  withAsync,
  withAsyncData,
  withLocalStorage,
  wrap,
} from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { apiClient } from '@shared/api'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { StrictMode, Suspense, use } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { seedPersisted } from './persist'
import { server } from './setup'

const PERSIST_KEY = 'kinoshka:test-persist'

const persisted = atom(0, 'test.persisted').extend(
  withLocalStorage(PERSIST_KEY),
)

const counter = atom(0, 'test.counter')

describe('persist-атом между тестами', () => {
  it('пишет значение в localStorage', () => {
    persisted.set(42)

    expect(persisted()).toBe(42)
    expect(JSON.parse(localStorage.getItem(PERSIST_KEY)!)).toMatchObject({
      data: 42,
    })
  })

  it('не видит значение прошлого теста', () => {
    expect(localStorage.getItem(PERSIST_KEY)).toBeNull()
    expect(persisted()).toBe(0)
  })

  it('читает значение, засеянное seedPersisted', () => {
    seedPersisted(PERSIST_KEY, 7)

    expect(persisted()).toBe(7)
  })
})

describe('состояние атома между тестами', () => {
  it('меняет атом', () => {
    counter.set(5)

    expect(counter()).toBe(5)
  })

  it('видит начальное состояние', () => {
    expect(counter()).toBe(0)
  })
})

describe('незавершённый запрос между тестами', () => {
  const LATE_ACTION_URL = 'https://api.test/late-action'
  const LATE_RESOURCE_URL = 'https://api.test/late-resource'

  const lateRequest = action(async () => {
    await wrap(sleep(20))
    await wrap(fetch(LATE_ACTION_URL))
  }, 'test.lateRequest').extend(withAsync())

  const lateResource = computed(async () => {
    await wrap(sleep(20))
    const response = await wrap(fetch(LATE_RESOURCE_URL))
    return (await wrap(response.json())) as unknown
  }, 'test.lateResource').extend(withAsyncData({ status: true }))

  const expectNoUnhandledRequests = async () => {
    const onUnhandled = vi.fn()
    server.events.on('request:unhandled', onUnhandled)

    await act(() => new Promise(resolve => setTimeout(resolve, 60)))

    server.events.removeListener('request:unhandled', onUnhandled)
    expect(onUnhandled).not.toHaveBeenCalled()
  }

  it('action: запускает запрос и не дожидается его', () => {
    server.use(http.get(LATE_ACTION_URL, () => HttpResponse.json({})))

    // Отказ из-за отмены ожидаем — гасим, чтобы не было unhandled rejection.
    lateRequest().catch(() => {})
  })

  it('action: следующий тест не получает чужой запрос', async () => {
    await expectNoUnhandledRequests()
  })

  it('ресурс в компоненте: монтирует и не дожидается ответа', () => {
    server.use(http.get(LATE_RESOURCE_URL, () => HttpResponse.json({})))
    const Status = reatomComponent(
      () => <p>{lateResource.status().isPending ? 'pending' : 'idle'}</p>,
      'Status',
    )

    render(<Status />)
  })

  it('ресурс в компоненте: следующий тест не получает чужой запрос', async () => {
    await expectNoUnhandledRequests()
  })
})

describe('use() внутри reatomComponent', () => {
  it('приостанавливается и возобновляется под Suspense', async () => {
    let resolve!: (value: string) => void
    const promise = new Promise<string>(r => {
      resolve = r
    })

    const Value = reatomComponent(() => {
      const value = use(promise)
      return (
        <p>
          {value}:{counter()}
        </p>
      )
    }, 'Value')

    // Рендер внутри async act: React инструментирует промис use() в микротаске.
    await act(async () => {
      render(
        <Suspense fallback={<p>loading</p>}>
          <Value />
        </Suspense>,
      )
    })

    expect(screen.getByText('loading')).toBeInTheDocument()

    await act(async () => resolve('done'))

    expect(screen.getByText('done:0')).toBeInTheDocument()

    await act(async () => counter.set(3))

    expect(screen.getByText('done:3')).toBeInTheDocument()
  })
})

describe('перехват ссылок urlAtom', () => {
  const clickLink = () => {
    // Чтение urlAtom вызывает urlAtom.init — он ставит слушатель click на body.
    urlAtom()
    render(<a href='/target'>link</a>)
    const pushState = vi.spyOn(window.history, 'pushState')

    fireEvent.click(screen.getByText('link'))

    const calls = pushState.mock.calls.length
    pushState.mockRestore()
    return calls
  }

  it('первый тест: один pushState на клик', () => {
    expect(clickLink()).toBe(1)
    expect(urlAtom().pathname).toBe('/target')
  })

  it('второй тест: слушатели не накопились', () => {
    expect(window.location.pathname).toBe('/')
    expect(clickLink()).toBe(1)
  })
})

describe('reatomComponent', () => {
  it('перерисовывается при изменении атома под React Compiler и StrictMode', async () => {
    const Counter = reatomComponent(() => <p>count:{counter()}</p>, 'Counter')

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count:0')).toBeInTheDocument()

    await act(async () => counter.set(1))
    expect(screen.getByText('count:1')).toBeInTheDocument()

    await act(async () => counter.set(2))
    expect(screen.getByText('count:2')).toBeInTheDocument()
  })

  it('обработчик через wrap обновляет атом; размонтирование снимает подписку', async () => {
    const Button = reatomComponent(
      () => (
        <button
          type='button'
          onClick={wrap(() => counter.set(value => value + 1))}
        >
          clicks:{counter()}
        </button>
      ),
      'Button',
    )

    const { unmount } = render(<Button />)

    expect(isConnected(counter)).toBe(true)

    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(counter()).toBe(1)
    expect(screen.getByRole('button')).toHaveTextContent('clicks:1')

    unmount()

    expect(isConnected(counter)).toBe(false)
  })
})

describe('apiClient с сигналом из abortVar', () => {
  const fetchMovie = action(async (id: number) => {
    const subscription = abortVar.subscribe()
    try {
      const response = await wrap(
        apiClient.getV15MovieById({
          path: { id },
          config: { signal: subscription.controller.signal },
        }),
      )
      return response.data
    } finally {
      subscription.unsubscribe()
    }
  }, 'test.fetchMovie').extend(withAsync(), withAbort())

  it('запрос проходит', async () => {
    server.use(
      http.get('*/v1.5/movie/:id', ({ params }) =>
        HttpResponse.json({ id: Number(params.id) }),
      ),
    )

    await expect(fetchMovie(1)).resolves.toEqual({ id: 1 })
  })

  it('abort отменяет запрос в клиенте', async () => {
    const signals: AbortSignal[] = []
    server.use(
      http.get('*/v1.5/movie/:id', async ({ request }) => {
        signals.push(request.signal)
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )

    const promise = fetchMovie(2)
    await vi.waitFor(() => expect(signals).toHaveLength(1))

    fetchMovie.abort()

    const error = await promise.catch((caught: unknown) => caught)
    // Клиент отклоняется нативным DOMException раньше, чем wrap — а он в jsdom не
    // instanceof Error, поэтому isAbort() из Reatom его не распознаёт: проверяем по name.
    expect(error).toHaveProperty('name', 'AbortError')
    expect(signals[0]?.aborted).toBe(true)
  })
})
