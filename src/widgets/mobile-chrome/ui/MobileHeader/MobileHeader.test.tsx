import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { MobileHeader } from './MobileHeader'

beforeEach(() => localStorage.clear())

// jsdom document общий между тестами файла — ThemeToggle (рендерится в MobileHeader
// безусловно, см. Task 7) применяет data-theme на document.documentElement, сбрасываем после
// каждого теста, чтобы значение не утекало в следующий (см. ThemeToggle.test.tsx).
afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('MobileHeader', () => {
  it('рендерится успешно с логотипом по умолчанию', () => {
    render(
      <MemoryRouter>
        <MobileHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText('kino')).toBeInTheDocument()
  })

  it('содержит кнопку-тоггл темы', () => {
    render(
      <MemoryRouter>
        <MobileHeader />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  it('клик по тогглу темы меняет document.documentElement.dataset.theme', () => {
    render(
      <MemoryRouter>
        <MobileHeader />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: /theme/i })
    const themeBefore = document.documentElement.dataset.theme

    fireEvent.click(toggle)

    expect(document.documentElement.dataset.theme).not.toBe(themeBefore)
  })
})
