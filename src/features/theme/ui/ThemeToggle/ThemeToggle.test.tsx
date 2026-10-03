import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { initThemeSync } from '../../model/theme'
import { ThemeToggle } from './ThemeToggle'

beforeEach(() => initThemeSync())

// jsdom document общий между тестами файла — без сброса data-theme, выставленный
// предыдущим тестом атрибут утёк бы в следующий (см. theme.test.ts).
afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

// Глобальный стаб window.matchMedia (src/test/setup.ts) по умолчанию возвращает matches: false
// → theme === 'system' (localStorage пуст) резолвится в 'light' (resolveTheme('system', false)).

describe('ThemeToggle', () => {
  it('клик переключает document.documentElement.dataset.theme light → dark', async () => {
    render(<ThemeToggle />)

    await act(async () => fireEvent.click(screen.getByRole('button')))

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )
  })

  it('повторный клик переключает обратно dark → light', async () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')

    await act(async () => fireEvent.click(button))
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )

    await act(async () => fireEvent.click(button))
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('light'),
    )
  })

  it('aria-label синхронизирован с текущей темой: "Switch to dark theme", когда сейчас light', () => {
    render(<ThemeToggle />)

    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument()
  })

  it('после клика (light → dark) aria-label меняется на "Switch to light theme"', async () => {
    render(<ThemeToggle />)

    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'Switch to dark theme' }),
      ),
    )

    expect(
      await screen.findByRole('button', { name: 'Switch to light theme' }),
    ).toBeInTheDocument()
  })
})
