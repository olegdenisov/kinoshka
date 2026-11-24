import { initThemeSync } from '@features/theme'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import { seedPersisted } from '../../../../test/persist'
import { renderWithRouter } from '../../../../test/router'
import { MobileHeader } from './MobileHeader'

beforeEach(() => {
  localStorage.clear()
  initThemeSync()
})

// jsdom document общий между тестами файла — ThemeToggle (рендерится в MobileHeader
// безусловно, см. Task 7) применяет data-theme на document.documentElement, сбрасываем после
// каждого теста, чтобы значение не утекало в следующий (см. ThemeToggle.test.tsx).
afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('MobileHeader', () => {
  it('рендерится успешно с логотипом по умолчанию', () => {
    renderWithRouter(<MobileHeader />)

    expect(screen.getByText('kino')).toBeInTheDocument()
  })

  it('содержит кнопку-тоггл темы', () => {
    renderWithRouter(<MobileHeader />)

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  it('кнопка "назад" (onBack передан) имеет aria-label="Back" (a11y baseline, Task 2)', () => {
    renderWithRouter(<MobileHeader onBack={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('клик по тогглу темы меняет document.documentElement.dataset.theme', async () => {
    renderWithRouter(<MobileHeader />)

    const toggle = screen.getByRole('button', { name: /theme/i })

    await act(async () => fireEvent.click(toggle))

    // Global matchMedia stub (src/test/setup.ts) defaults matches: false → theme === 'system'
    // (localStorage empty) resolves to 'light' on mount, so one click flips it to 'dark'.
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )
  })

  it('аватар — ссылка на /profile с инициалами сохранённого имени', () => {
    seedPersisted('kinoshka:profile', 'Oleg Denisov')

    renderWithRouter(<MobileHeader />)

    const link = screen.getByRole('link', {
      name: 'Your profile: Oleg Denisov',
    })
    expect(link).toHaveAttribute('href', '/profile')
    expect(link).toHaveTextContent('OD')
  })

  it('переданный rightAction перекрывает аватар (регресс-гард для /movie/:id)', () => {
    renderWithRouter(
      <MobileHeader rightAction={<button type='button'>Share</button>} />,
    )

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /your profile/i }),
    ).not.toBeInTheDocument()
  })
})
