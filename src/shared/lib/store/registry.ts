// Сторы Zustand — module-level синглтоны: без общего сброса стейт одного теста утёк бы в
// следующий. Фабрики регистрируют сброс каждого созданного стора здесь, а src/test/setup.ts
// вызывает resetAllStores() в afterEach — тот же приём, что был у resetAllCachedFetchers.
const resets = new Set<() => void>()

export const registerStoreReset = (reset: () => void): (() => void) => {
  resets.add(reset)

  return () => {
    resets.delete(reset)
  }
}

export const resetAllStores = (): void => {
  resets.forEach(reset => reset())
}
