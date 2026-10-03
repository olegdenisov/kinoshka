import type { PersistRecord } from '@reatom/core'

// Тесты сидируют localStorage в формате конверта withLocalStorage: «сырое» значение без
// конверта Reatom читает как отсутствующее и отдаёт дефолт атома. version 0 — дефолт
// withPersist (иначе запись уходит в migration); `to` — «никогда не истекает».
export const seedPersisted = (key: string, data: unknown) => {
  const record: PersistRecord = {
    data,
    id: 0,
    timestamp: Date.now(),
    version: 0,
    to: Number.MAX_SAFE_INTEGER,
  }
  localStorage.setItem(key, JSON.stringify(record))
}

// Читает `data` из конверта; null — если ключа нет.
export const readPersisted = (key: string): unknown => {
  const raw = localStorage.getItem(key)
  return raw === null ? null : (JSON.parse(raw) as PersistRecord).data
}
