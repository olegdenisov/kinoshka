import { makeStore } from '@app/store'
import type { AppStore } from '@app/store'
import { render, type RenderOptions } from '@testing-library/react'
import type { PropsWithChildren, ReactElement } from 'react'
import { Provider } from 'react-redux'

// Реэкспорт для тестов слоёв ниже app: им самим импортировать @app запрещает FSD-линтер, а тесту
// иногда нужен один стор на несколько render/renderHook.
export { makeStore }
export type { AppStore }

type RenderWithStoreOptions = RenderOptions & { store?: AppStore }

// Обёртка для renderHook: `renderHook(() => useX(), { wrapper: createStoreWrapper() })`.
// По умолчанию — свежий стор, поэтому состояние (включая кеш RTK Query) не течёт между тестами.
export const createStoreWrapper = (store: AppStore = makeStore()) => {
  const StoreWrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  )
  return StoreWrapper
}

export const renderWithStore = (
  ui: ReactElement,
  {
    store = makeStore(),
    wrapper: Wrapper,
    ...options
  }: RenderWithStoreOptions = {},
) => {
  const StoreWrapper = createStoreWrapper(store)
  const AllProviders = ({ children }: PropsWithChildren) => (
    <StoreWrapper>
      {Wrapper ? <Wrapper>{children}</Wrapper> : children}
    </StoreWrapper>
  )

  return { store, ...render(ui, { ...options, wrapper: AllProviders }) }
}
