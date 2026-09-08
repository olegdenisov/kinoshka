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
