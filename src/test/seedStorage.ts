// Сид localStorage для тестов. Persisted-сторы гидрируются один раз при импорте модуля, поэтому
// голый localStorage.setItem уже созданный стор не увидит. StorageEvent доставляет сид тем же
// путём, что запись из другой вкладки. value — сырая строка: тесты сидят и битый JSON.
export const seedStorage = (key: string, value: string): void => {
  localStorage.setItem(key, value)
  window.dispatchEvent(new StorageEvent('storage', { key }))
}
