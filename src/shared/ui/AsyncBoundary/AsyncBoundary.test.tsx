import { act, fireEvent, render, screen } from '@testing-library/react'
import { use } from 'react'

import { AsyncBoundary } from './AsyncBoundary'

const Bomb = () => {
  throw new Error('boom')
}

const RETRY_BUTTON_TEXT = 'Попробовать снова'

describe('AsyncBoundary — errorFallback', () => {
  it('без errorFallback показывает дефолтный ErrorState', () => {
    render(
      <AsyncBoundary>
        <Bomb />
      </AsyncBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('с errorFallback показывает кастомный фолбэк вместо дефолтного ErrorState', () => {
    render(
      <AsyncBoundary
        errorFallback={({ error, reset }) => (
          <div>
            <span data-testid='custom-error'>{error?.message}</span>
            <button type='button' onClick={reset}>
              Custom retry
            </button>
          </div>
        )}
      >
        <Bomb />
      </AsyncBoundary>,
    )

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(screen.getByTestId('custom-error')).toHaveTextContent('boom')
    expect(screen.getByText('Custom retry')).toBeInTheDocument()
  })
})

describe('AsyncBoundary — onRetry + double-click guard', () => {
  it('вызывает onRetry один раз, перед reset', () => {
    let shouldThrow = true
    const callOrder: string[] = []
    const onRetry = vi.fn(() => callOrder.push('onRetry'))
    const Recoverable = () => {
      if (shouldThrow) throw new Error('boom')
      return <div>recovered</div>
    }

    render(
      <AsyncBoundary onRetry={onRetry}>
        <Recoverable />
      </AsyncBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['onRetry'])
    // reset действительно произошёл — дети перерендерились и больше не в error-состоянии
    expect(screen.getByText('recovered')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('два клика в одном синхронном тике (до того как React успел закоммитить первый retry) вызывают onRetry только один раз', () => {
    // Оба клика диспатчатся ВНУТРИ одного act() без разделяющего flush — только
    // так возможна настоящая гонка (единственный сценарий, который в
    // однопоточном JS вообще может ударить в guardedReset дважды до того, как
    // первый вызов успел закоммититься). Два ОТДЕЛЬНЫХ fireEvent.click() (каждый
    // со своим неявным act()) — это уже два полностью независимых, последовательно
    // обработанных клика, а не гонка; см. следующий тест ниже.
    const sameError = new Error('boom')
    const onRetry = vi.fn()
    const AlwaysThrowsSameError = () => {
      throw sameError
    }

    render(
      <AsyncBoundary onRetry={onRetry}>
        <AlwaysThrowsSameError />
      </AsyncBoundary>,
    )

    const retryButton = screen.getByText(RETRY_BUTTON_TEXT)

    act(() => {
      fireEvent.click(retryButton)
      fireEvent.click(retryButton)
    })

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('две ОТДЕЛЬНЫЕ (не гонка) попытки retry, каждая падающая с той же ссылкой на error, обе вызывают onRetry — гвард не залипает навсегда', () => {
    // Синхронный аналог MAJOR-регрессии ниже (там — асинхронный use()-сценарий,
    // как в реальном приложении). Раньше гвард сравнивал error по ссылке и не
    // переармировывался, если retry падал с тем же Error-объектом — вторая,
    // полностью отдельная попытка молча ничего не делала.
    const sameError = new Error('boom')
    const onRetry = vi.fn()
    const AlwaysThrowsSameError = () => {
      throw sameError
    }

    render(
      <AsyncBoundary onRetry={onRetry}>
        <AlwaysThrowsSameError />
      </AsyncBoundary>,
    )

    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    expect(onRetry).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('после падения повторной попытки с НОВОЙ ошибкой retry снова работает (гвард переармирован)', () => {
    // Каждый рендер бросает уникальную ошибку — не завязываемся на точное число
    // вызовов рендер-функции (React может ретраить рендер внутренне до коммита),
    // важно лишь, что закоммиченный текст ошибки меняется от попытки к попытке.
    const onRetry = vi.fn()
    const ThrowsNewErrorEachRender = () => {
      throw new Error(`boom-${Math.random()}`)
    }

    render(
      <AsyncBoundary onRetry={onRetry}>
        <ThrowsNewErrorEachRender />
      </AsyncBoundary>,
    )

    const firstMessage = screen.getByText(/^boom-/).textContent

    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    expect(onRetry).toHaveBeenCalledTimes(1)
    const secondMessage = screen.getByText(/^boom-/).textContent
    expect(secondMessage).not.toBe(firstMessage)

    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    expect(onRetry).toHaveBeenCalledTimes(2)
    const thirdMessage = screen.getByText(/^boom-/).textContent
    expect(thirdMessage).not.toBe(secondMessage)
  })

  it('retry через use(), получивший ТОТ ЖЕ закэшированный rejected-промис (onRetry не смог реально его вытеснить) — не залипает навсегда, гвард переармирован', async () => {
    // Регрессия: реальные фетчеры (createCachedFetcher/getMoviesPage) кэшируют
    // rejected-промис — повторный поход в кэш может вернуть ТОТ ЖЕ Promise/Error-
    // объект по ссылке (не просто с тем же message), напр. getMoviesPage
    // инвалидирует только первый шаг курсора — промежуточный шаг при retry
    // способен отдать тот же закэшированный rejected-промис. Здесь onRetry
    // намеренно НЕ вытесняет cachedPromise (моделирует "неполный" invalidate),
    // так что и getCached(), и use() на второй попытке видят тот же Error по
    // ссылке. Раньше AsyncBoundary сравнивал error по ссылке и никогда не
    // переармировывал гвард в этом случае — Retry становился нерабочим навсегда
    // (не просто «жди 20с cooldown»).
    const sharedError = new Error('boom')
    let cachedPromise: Promise<never> | undefined
    const getCached = (): Promise<never> => {
      if (!cachedPromise) {
        cachedPromise = Promise.reject(sharedError)
        cachedPromise.catch(() => {}) // не даём тесту упасть на unhandledRejection
      }
      return cachedPromise
    }
    const onRetry = vi.fn()

    const CachedBomb = () => {
      use(getCached())
      return null
    }

    // Первый рендер требует микротика, пока React инструментирует промис —
    // ждём его явно внутри act(), иначе findByText/getByText увидят Spinner.
    await act(async () => {
      render(
        <AsyncBoundary onRetry={onRetry}>
          <CachedBomb />
        </AsyncBoundary>,
      )
    })

    expect(screen.getByText(RETRY_BUTTON_TEXT)).toBeInTheDocument()

    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    expect(onRetry).toHaveBeenCalledTimes(1)

    // Кэш не был реально вытеснен — retry синхронно получает ТОТ ЖЕ Error по
    // ссылке из уже закэшированного (и уже инструментированного React) промиса.
    expect(screen.getByText(RETRY_BUTTON_TEXT)).toBeInTheDocument()

    // Гвард должен быть переармирован несмотря на reference-равенство ошибки —
    // повторный клик снова реально вызывает onRetry, а не молча ничего не делает.
    fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT))
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('без onRetry поведение существующих вызовов AsyncBoundary не меняется', () => {
    let shouldThrow = true
    const Recoverable = () => {
      if (shouldThrow) throw new Error('boom')
      return <div>recovered</div>
    }

    render(
      <AsyncBoundary>
        <Recoverable />
      </AsyncBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    shouldThrow = false
    expect(() =>
      fireEvent.click(screen.getByText(RETRY_BUTTON_TEXT)),
    ).not.toThrow()

    expect(screen.getByText('recovered')).toBeInTheDocument()
  })
})
