import { fireEvent, render, screen } from '@testing-library/react'

import { ThemeToggle } from './ThemeToggle'

beforeEach(() => localStorage.clear())

// jsdom document общий между тестами файла — без сброса data-theme, выставленный
// предыдущим тестом атрибут утёк бы в следующий (см. useTheme.test.tsx).
afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

// Глобальный стаб window.matchMedia (src/test/setup.ts) по умолчанию возвращает matches: false
// → theme === 'system' (localStorage пуст) резолвится в 'light' (resolveTheme('system', false)).

describe('ThemeToggle', () => {
  it('клик переключает document.documentElement.dataset.theme light → dark', () => {
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button'))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('повторный клик переключает обратно dark → light', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')

    fireEvent.click(button)
    expect(document.documentElement.dataset.theme).toBe('dark')

    fireEvent.click(button)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('aria-label синхронизирован с текущей темой: "Switch to dark theme", когда сейчас light', () => {
    render(<ThemeToggle />)

    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument()
  })

  it('после клика (light → dark) aria-label меняется на "Switch to light theme"', () => {
    render(<ThemeToggle />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    )

    expect(
      screen.getByRole('button', { name: 'Switch to light theme' }),
    ).toBeInTheDocument()
  })
})
