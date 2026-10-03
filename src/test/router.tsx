import { urlAtom } from '@reatom/core'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

type RenderWithRouterOptions = {
  /** Начальный URL (pathname + search + hash). */
  url?: string
}

/** Выставляет URL страницы и синхронизирует с ним urlAtom (до или после его инициализации). */
export const setTestUrl = (url: string) => {
  window.history.replaceState(null, '', url)
  // Первое чтение инициализирует urlAtom из location и ставит перехват кликов по <a>.
  // Повторный вызов в том же тесте: атом уже инициализирован — синхронизируем без записи в history.
  if (urlAtom().href !== window.location.href) {
    urlAtom.syncFromSource(new URL(window.location.href), true)
  }
}

// Единая точка, через которую тесты задают и читают URL. Провайдера роутера нет: компоненты
// читают urlAtom напрямую, параметры пути страницы получают пропом.
export const renderWithRouter = (
  ui: ReactElement,
  { url = '/' }: RenderWithRouterOptions = {},
) => {
  setTestUrl(url)
  const result = render(ui)

  // Читает атом, а не location: urlAtom пишет в history отложенно (setTimeout(0)).
  const getUrl = () => {
    const { pathname, search } = urlAtom()
    return pathname + search
  }

  return { ...result, getUrl }
}
