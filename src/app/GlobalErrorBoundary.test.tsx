import * as Sentry from '@sentry/react'
import { fireEvent, render, screen } from '@testing-library/react'

import { GlobalErrorBoundary } from './GlobalErrorBoundary'

// [deviation от плана]: план предлагал `vi.mock('@sentry/react', importOriginal, {
// captureException: vi.fn() })` и проверку "captureException вызван". На деле
// `Sentry.ErrorBoundary` (@sentry/react@10.71.0) репортит ошибку не через реэкспортированный
// `captureException` из '@sentry/react', а через внутренний `captureReactException` (bundle-
// файл error.js внутри самого пакета), который импортирует `captureException` напрямую из
// '@sentry/browser' — отдельного пакета, доступного только как вложенная (не хойстнутая pnpm)
// транзитивная зависимость `@sentry/react`, не резолвящаяся из тестового файла. Мокинг
// '@sentry/react' на уровне теста подменяет только внешний реэкспорт и не долетает до этого
// внутреннего вызова (проверено эмпирически) — добавление '@sentry/browser' в devDependencies
// для резолва тоже не помогло (Vite/Vitest создаёт для вложенного и корневого путей разные
// экземпляры модуля в графе). Поэтому здесь реальный (не замоканный) `Sentry.ErrorBoundary`
// проверяется по наблюдаемому контракту — что он ловит ошибку, показывает переданный fallback
// (ErrorState) и восстанавливается по `resetError` — а не по факту вызова `captureException`,
// который относится к внутренней реализации Sentry SDK, а не к логике GlobalErrorBoundary.
// Отдельно (см. describe "GlobalErrorBoundary — сообщает об ошибке в Sentry" ниже) это всё же
// проверяется — не мокингом '@sentry/react', а реальным `Sentry.init()` с тестовым
// transport/`beforeSend` в самом тесте.
// module-level флаг (не self-flipping внутри рендера) — React после ошибки в рендере
// синхронно повторяет попытку рендера ещё раз ДО того, как решит считать её настоящей
// ошибкой (см. AsyncBoundary.test.tsx, тот же паттерн); self-flipping флаг привёл бы к тому,
// что этот внутренний повтор рендера уже не бросает, и boundary вообще не перехватывает
// ошибку.
let shouldThrow = true
const Bomb = () => {
  if (shouldThrow) throw new Error('boom')
  return <div>recovered</div>
}

afterEach(() => {
  shouldThrow = true
})

describe('GlobalErrorBoundary — error path', () => {
  it('вместо краха показывает ErrorState-фолбэк, retry восстанавливает детей', () => {
    render(
      <GlobalErrorBoundary>
        <Bomb />
      </GlobalErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('An unexpected error occurred. Please try again.'),
    ).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByText('Попробовать снова'))

    expect(screen.getByText('recovered')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})

describe('GlobalErrorBoundary — happy path', () => {
  it('без ошибки в детях рендерит children как есть', () => {
    render(
      <GlobalErrorBoundary>
        <div>all good</div>
      </GlobalErrorBoundary>,
    )

    expect(screen.getByText('all good')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})

// Проверено эмпирически (не единственно по внешней документации): @sentry/react, @sentry/browser
// и @sentry/core в этом репозитории — ровно одна физическая версия (10.71.0) в
// content-addressable pnpm store, и обе "копии" — та, что резолвится вложенно из
// @sentry/react/node_modules/@sentry/browser внутри captureReactException, и та, что резолвится
// из этого тестового файла через `import * as Sentry from '@sentry/react'` (`export * from
// '@sentry/browser'` в его index.js) — читают состояние активного клиента из одного и того же
// `globalThis.__SENTRY__[SDK_VERSION]`-carrier (@sentry/core/carrier.js, getMainCarrier/
// getSentryCarrier) — сам SDK специально спроектирован так, чтобы несколько бандл-копий одной
// версии делили один активный клиент. Поэтому `Sentry.init()`, вызванный прямо в тесте с
// кастомным `transport`/`beforeSend`, реально перехватывает событие, порождённое внутренним
// `captureReactException` — в отличие от `vi.mock('@sentry/react', ...)`, который подменяет
// только внешний реэкспорт и не долетает до внутреннего вызова (см. комментарий выше).
describe('GlobalErrorBoundary — сообщает об ошибке в Sentry', () => {
  afterEach(() => {
    Sentry.getCurrentScope().setClient(undefined)
  })

  it('captureReactException долетает до реального Sentry-клиента (тестовый transport/beforeSend)', async () => {
    const capturedEvents: Sentry.ErrorEvent[] = []
    Sentry.init({
      dsn: 'https://public@o0.ingest.sentry.io/0',
      transport: () => ({
        send: async () => ({}),
        flush: async () => true,
      }),
      beforeSend: event => {
        capturedEvents.push(event)
        return event
      },
    })

    render(
      <GlobalErrorBoundary>
        <Bomb />
      </GlobalErrorBoundary>,
    )

    await vi.waitFor(() => expect(capturedEvents.length).toBeGreaterThan(0))
    expect(capturedEvents[0]?.exception?.values?.[0]?.value).toBe('boom')
  })
})
