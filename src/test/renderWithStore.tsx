import { makeStore as makeAppStore } from '@app/store'
import type { AppStore, RootState } from '@app/store'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import type { PropsWithChildren, ReactElement } from 'react'
import { Provider } from 'react-redux'
import { afterEach } from 'vitest'

export type { AppStore }

// Подписки стора на слоты висят на window и общем emitter'е слотов: без teardown стор из прошлого
// теста продолжал бы ловить storage-события и записи следующего. Все сторы, созданные через этот
// модуль, снимаются после каждого теста — afterEach на верхнем уровне модуля регистрируется в
// каждом тест-файле, который его импортирует (как auto-cleanup у Testing Library).
const createdStores = new Set<AppStore>()

afterEach(() => {
  for (const created of createdStores) created.teardown()
  createdStores.clear()
})

// Для тестов слоёв ниже app: им самим импортировать @app запрещает FSD-линтер, а тесту иногда нужен
// один стор на несколько render/renderHook.
export const makeStore = (preloadedState?: Partial<RootState>) => {
  const created = makeAppStore(preloadedState)
  createdStores.add(created)
  return created
}

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
