import { fireEvent, render, screen } from '@testing-library/react'

import { BottomSheet } from './BottomSheet'

describe('BottomSheet — a11y имена кнопок закрытия', () => {
  it('крестик в titleRow (.closeBtn) имеет aria-label="Dismiss", отдельный от backdrop-кнопки', () => {
    render(
      <BottomSheet open onClose={() => {}} title='Filters'>
        <div>content</div>
      </BottomSheet>,
    )

    // Раньше .closeBtn был иконкой без aria-label (axe critical button-name
    // violation, см. AGENTS.md/план 20260912-e2e-playwright-axe.md, Task 2) —
    // регресс-тест на конкретное accessible name.
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()

    // Backdrop-кнопка уже имела aria-label='Close' до этого фикса — разные
    // имена нужны, чтобы getByRole('button', { name: 'Close' }) внутри
    // одного открытого sheet не резолвился в оба узла сразу.
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('клик по Dismiss и по backdrop оба вызывают onClose', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose} title='Sort by'>
        <div>content</div>
      </BottomSheet>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
