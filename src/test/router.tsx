import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

type RenderWithRouterOptions = {
  /** Начальный URL (pathname + search + hash). */
  url?: string
  /** Шаблон роута: нужен тестам, где компонент читает параметры пути (`/movie/:id`). */
  path?: string
}

// Единая точка, через которую тесты задают и читают URL: на Task 15 меняется только эта
// реализация (MemoryRouter -> urlAtom), а сами тесты остаются как есть.
export const renderWithRouter = (
  ui: ReactElement,
  { url = '/', path }: RenderWithRouterOptions = {},
) => {
  const location = { current: url }

  const LocationProbe = () => {
    const { pathname, search } = useLocation()
    // Побочная запись в объект вне React-состояния — допустимо только в эффекте-аналоге
    // рендера тестового пробника; значение читается лишь из getUrl() после коммита.
    location.current = pathname + search
    return null
  }

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      {path ? (
        <Routes>
          <Route path={path} element={children} />
        </Routes>
      ) : (
        children
      )}
      <LocationProbe />
    </MemoryRouter>
  )

  const result = render(ui, { wrapper: Wrapper })

  return { ...result, getUrl: () => location.current }
}
